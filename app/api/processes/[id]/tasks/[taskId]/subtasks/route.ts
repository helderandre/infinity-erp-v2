import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { recalculateProgress } from '@/lib/process-engine'
import { logTaskActivity } from '@/lib/processes/activity-logger'
import { ADHOC_TASK_ROLES, PROCESS_MANAGER_ROLES } from '@/lib/auth/roles'
import { requirePermission } from '@/lib/auth/permissions'
import { z } from 'zod'

const uuidRegex = /^[0-9a-f-]{36}$/

const createSubtaskSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  is_mandatory: z.boolean().default(true),
  order_index: z.number().int().min(0),
  priority: z.enum(['urgent', 'normal', 'low']).default('normal'),
  assigned_role: z.string().optional(),
  sla_days: z.number().int().positive().optional(),
  owner_id: z.string().regex(uuidRegex).optional(),
  dependency_type: z.enum(['none', 'subtask', 'task']).default('none'),
  dependency_proc_subtask_id: z.string().optional().nullable(),
  dependency_proc_task_id: z.string().optional().nullable(),
  config: z.object({
    type: z.enum(['upload', 'checklist', 'email', 'generate_doc', 'form', 'field']),
    doc_type_id: z.string().optional(),
    email_library_id: z.string().optional(),
    doc_library_id: z.string().optional(),
    sections: z.any().optional(),
    field: z.any().optional(),
  }),
})

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; taskId: string }> }
) {
  try {
    const auth = await requirePermission('processes')
    if (!auth.authorized) return auth.response

    const { id, taskId } = await params
    const supabase = await createClient()
    const admin = createAdminClient()
    const adminDb = admin as unknown as { from: (t: string) => ReturnType<typeof supabase.from> }

    // Verificar role autorizado para adicionar subtarefas
    const { data: devUser } = await supabase
      .from('dev_users')
      .select('id, commercial_name')
      .eq('id', auth.user.id)
      .single()

    const { data: userRole } = await supabase
      .from('user_roles')
      .select('role:roles(name)')
      .eq('user_id', auth.user.id)
      .limit(1)
      .single()

    const roleName = (userRole?.role as any)?.name
    if (!roleName || !ADHOC_TASK_ROLES.includes(roleName as any)) {
      return NextResponse.json(
        { error: 'Sem permissão para adicionar subtarefas' },
        { status: 403 }
      )
    }

    // 3. Parse e validação
    const body = await request.json()
    const validation = createSubtaskSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: validation.error.flatten() },
        { status: 400 }
      )
    }

    const data = validation.data

    // 4. Validar tarefa existe e pertence ao processo
    const { data: task, error: taskError } = await supabase
      .from('proc_tasks')
      .select('id, title, proc_instance_id, action_type')
      .eq('id', taskId)
      .eq('proc_instance_id', id)
      .single()

    if (taskError || !task) {
      return NextResponse.json({ error: 'Tarefa não encontrada' }, { status: 404 })
    }

    // 5. Validar processo activo
    const { data: process } = await supabase
      .from('proc_instances')
      .select('current_status')
      .eq('id', id)
      .single()

    const isProcessManager = auth.roles.some((r: string) => (PROCESS_MANAGER_ROLES as readonly string[]).includes(r))
    if (!process || (!['active', 'on_hold'].includes(process.current_status as string) && !isProcessManager)) {
      return NextResponse.json(
        { error: 'Apenas processos activos ou pausados permitem adicionar subtarefas' },
        { status: 400 }
      )
    }

    // 6. Calcular due_date e is_blocked
    const dueDate = data.sla_days
      ? new Date(Date.now() + data.sla_days * 86400000).toISOString()
      : null
    const isBlocked = data.dependency_type !== 'none' &&
      (!!data.dependency_proc_subtask_id || !!data.dependency_proc_task_id)

    // 7. INSERT subtarefa
    const { data: newSubtask, error: insertError } = await adminDb.from('proc_subtasks')
      .insert({
        proc_task_id: taskId,
        tpl_subtask_id: null,
        title: data.title,
        is_mandatory: data.is_mandatory,
        order_index: data.order_index,
        priority: data.priority,
        assigned_role: data.assigned_role || null,
        due_date: dueDate,
        owner_id: data.owner_id || null,
        dependency_type: data.dependency_type,
        dependency_proc_subtask_id: data.dependency_proc_subtask_id || null,
        dependency_proc_task_id: data.dependency_proc_task_id || null,
        is_blocked: isBlocked,
        is_completed: false,
        config: data.config,
      })
      .select('id')
      .single()

    if (insertError || !newSubtask) {
      return NextResponse.json(
        { error: 'Erro ao criar subtarefa', details: insertError?.message },
        { status: 500 }
      )
    }

    // 8. Actualizar action_type da tarefa-pai
    const { data: subtaskCount } = await adminDb.from('proc_subtasks')
      .select('id, config')
      .eq('proc_task_id', taskId)

    const stList = (subtaskCount || []) as Array<{ id: string; config: any }>
    let newActionType: string
    if (stList.length === 0) {
      newActionType = 'MANUAL'
    } else if (stList.length === 1) {
      const typeMap: Record<string, string> = {
        upload: 'UPLOAD', email: 'EMAIL', generate_doc: 'GENERATE_DOC',
        form: 'FORM', checklist: 'MANUAL', field: 'FORM',
      }
      newActionType = typeMap[stList[0].config?.type] || 'MANUAL'
    } else {
      newActionType = 'COMPOSITE'
    }

    if (newActionType !== task.action_type) {
      await supabase.from('proc_tasks').update({ action_type: newActionType }).eq('id', taskId)
    }

    // 9. Recalcular progresso
    await recalculateProgress(id)

    // 10. Registar actividade
    try {
      const userName = devUser?.commercial_name || 'Utilizador'
      await logTaskActivity(
        supabase, taskId, auth.user.id,
        'subtask_added',
        `${userName} adicionou subtarefa "${data.title}" (${data.config.type}) à tarefa "${task.title}"`,
        {
          is_adhoc: true,
          subtask_title: data.title,
          subtask_type: data.config.type,
          parent_task_title: task.title,
          parent_task_id: taskId,
          owner_id: data.owner_id || null,
          added_by_role: roleName,
        }
      )
    } catch (activityError) {
      console.error('[AdhocSubtask] Erro ao registar actividade:', activityError)
    }

    return NextResponse.json(
      { id: (newSubtask as any).id, title: data.title },
      { status: 201 }
    )
  } catch (error) {
    console.error('Erro ao adicionar subtarefa:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
