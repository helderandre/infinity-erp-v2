import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { recalculateProgress } from '@/lib/process-engine'
import { logTaskActivity } from '@/lib/processes/activity-logger'
import { ADHOC_TASK_ROLES, PROCESS_MANAGER_ROLES } from '@/lib/auth/roles'
import { requirePermission } from '@/lib/auth/permissions'
import { z } from 'zod'

const uuidRegex = /^[0-9a-f-]{36}$/

const createAdhocTaskSchema = z.object({
  title: z.string().min(1, 'Título obrigatório'),
  description: z.string().optional(),
  stage_name: z.string().min(1, 'Fase obrigatória'),
  stage_order_index: z.number().int().min(0),
  is_mandatory: z.boolean().default(true),
  priority: z.enum(['urgent', 'normal', 'low']).default('normal'),
  assigned_role: z.string().optional(),
  assigned_to: z.string().regex(uuidRegex).optional(),
  sla_days: z.number().int().positive().optional(),
  owner_id: z.string().regex(uuidRegex).optional(),
  dependency_proc_task_id: z.string().regex(uuidRegex).optional(),
  alerts_config: z.any().optional(),
  subtasks: z.array(z.object({
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
      type: z.enum(['upload', 'checklist', 'email', 'generate_doc', 'form', 'field', 'whatsapp']),
      doc_type_id: z.string().optional(),
      email_library_id: z.string().optional(),
      doc_library_id: z.string().optional(),
      sections: z.any().optional(),
      field: z.any().optional(),
    }),
  })).default([]),
})

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requirePermission('processes')
    if (!auth.authorized) return auth.response

    const { id } = await params
    const supabase = await createClient()
    const admin = createAdminClient()
    const adminDb = admin as unknown as { from: (t: string) => ReturnType<typeof supabase.from> }

    // Verificar role autorizado para tarefas ad-hoc
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
        { error: 'Sem permissão para criar tarefas ad-hoc' },
        { status: 403 }
      )
    }

    // 3. Parse e validação
    const body = await request.json()
    const validation = createAdhocTaskSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: validation.error.flatten() },
        { status: 400 }
      )
    }

    const data = validation.data

    // 4. Validar processo existe e status é active ou on_hold
    const { data: process, error: procError } = await supabase
      .from('proc_instances')
      .select('id, current_status, property_id, external_ref')
      .eq('id', id)
      .single()

    if (procError || !process) {
      return NextResponse.json({ error: 'Processo não encontrado' }, { status: 404 })
    }

    const isProcessManager = auth.roles.some((r: string) => (PROCESS_MANAGER_ROLES as readonly string[]).includes(r))
    if (!['active', 'on_hold'].includes(process.current_status as string) && !isProcessManager) {
      return NextResponse.json(
        { error: 'Apenas processos activos ou pausados permitem criar tarefas ad-hoc' },
        { status: 400 }
      )
    }

    // 5. Se owner_id fornecido, validar que é proprietário do processo
    if (data.owner_id && process.property_id) {
      const { data: ownerLink } = await supabase
        .from('property_owners')
        .select('owner_id')
        .eq('property_id', process.property_id)
        .eq('owner_id', data.owner_id)
        .single()

      if (!ownerLink) {
        return NextResponse.json(
          { error: 'Proprietário não está vinculado ao imóvel do processo' },
          { status: 400 }
        )
      }
    }

    // 6. Se dependency_proc_task_id fornecido, validar que pertence ao processo
    if (data.dependency_proc_task_id) {
      const { data: depTask } = await supabase
        .from('proc_tasks')
        .select('id')
        .eq('id', data.dependency_proc_task_id)
        .eq('proc_instance_id', id)
        .single()

      if (!depTask) {
        return NextResponse.json(
          { error: 'Tarefa de dependência não pertence a este processo' },
          { status: 400 }
        )
      }
    }

    // 7. Calcular order_index
    const { data: maxOrderResult } = await supabase
      .from('proc_tasks')
      .select('order_index')
      .eq('proc_instance_id', id)
      .eq('stage_name', data.stage_name)
      .order('order_index', { ascending: false })
      .limit(1)
      .single()

    const orderIndex = (maxOrderResult?.order_index ?? -1) + 1

    // 8. Determinar action_type
    let actionType: string
    if (data.subtasks.length === 0) {
      actionType = 'MANUAL'
    } else if (data.subtasks.length === 1) {
      const typeMap: Record<string, string> = {
        upload: 'UPLOAD',
        email: 'EMAIL',
        generate_doc: 'GENERATE_DOC',
        form: 'FORM',
        checklist: 'MANUAL',
        field: 'FORM',
        whatsapp: 'EMAIL',
      }
      actionType = typeMap[data.subtasks[0].config.type] || 'MANUAL'
    } else {
      actionType = 'COMPOSITE'
    }

    // 9. Calcular due_date e is_blocked
    const dueDate = data.sla_days
      ? new Date(Date.now() + data.sla_days * 86400000).toISOString()
      : null
    const isBlocked = !!data.dependency_proc_task_id

    // 10. INSERT proc_tasks com tpl_task_id = NULL
    const taskConfig = data.alerts_config
      ? { alerts: data.alerts_config, description: data.description || null }
      : data.description
        ? { description: data.description }
        : {}

    const { data: newTask, error: insertError } = await adminDb.from('proc_tasks')
      .insert({
        proc_instance_id: id,
        tpl_task_id: null,
        title: data.title,
        action_type: actionType,
        stage_name: data.stage_name,
        stage_order_index: data.stage_order_index,
        order_index: orderIndex,
        is_mandatory: data.is_mandatory,
        priority: data.priority,
        assigned_role: data.assigned_role || null,
        assigned_to: data.assigned_to || null,
        due_date: dueDate,
        owner_id: data.owner_id || null,
        dependency_proc_task_id: data.dependency_proc_task_id || null,
        is_blocked: isBlocked,
        status: 'pending',
        config: taskConfig,
      })
      .select('id')
      .single()

    if (insertError || !newTask) {
      return NextResponse.json(
        { error: 'Erro ao criar tarefa', details: insertError?.message },
        { status: 500 }
      )
    }

    const taskId = (newTask as any).id as string

    // 11. INSERT subtarefas
    const insertedSubtasks: string[] = []
    for (const st of data.subtasks) {
      const stDueDate = st.sla_days
        ? new Date(Date.now() + st.sla_days * 86400000).toISOString()
        : null
      const stIsBlocked = st.dependency_type !== 'none' &&
        (!!st.dependency_proc_subtask_id || !!st.dependency_proc_task_id)

      const subtaskConfig = st.description
        ? { ...st.config, description: st.description }
        : st.config

      const { data: newSt, error: stError } = await adminDb.from('proc_subtasks')
        .insert({
          proc_task_id: taskId,
          tpl_subtask_id: null,
          title: st.title,
          is_mandatory: st.is_mandatory,
          order_index: st.order_index,
          priority: st.priority,
          assigned_role: st.assigned_role || null,
          due_date: stDueDate,
          owner_id: st.owner_id || null,
          dependency_type: st.dependency_type,
          dependency_proc_subtask_id: st.dependency_proc_subtask_id || null,
          dependency_proc_task_id: st.dependency_proc_task_id || null,
          is_blocked: stIsBlocked,
          is_completed: false,
          config: subtaskConfig,
        })
        .select('id')
        .single()

      if (stError) {
        console.error('[AdhocTask] Erro ao inserir subtarefa:', stError)
      } else {
        insertedSubtasks.push((newSt as any).id)
      }
    }

    // 12. Recalcular progresso
    await recalculateProgress(id)

    // 13. Registar actividade
    try {
      const userName = devUser?.commercial_name || 'Utilizador'
      await logTaskActivity(
        supabase, taskId, auth.user.id,
        'task_created',
        `${userName} criou tarefa ad-hoc "${data.title}" na fase "${data.stage_name}"`,
        {
          is_adhoc: true,
          stage_name: data.stage_name,
          subtask_count: data.subtasks.length,
          subtask_types: data.subtasks.map(s => s.config.type),
          owner_id: data.owner_id || null,
          created_by_role: roleName,
          priority: data.priority,
          is_mandatory: data.is_mandatory,
        }
      )
    } catch (activityError) {
      console.error('[AdhocTask] Erro ao registar actividade:', activityError)
    }

    // 14. Retornar tarefa criada
    return NextResponse.json(
      { id: taskId, title: data.title, subtasks: insertedSubtasks },
      { status: 201 }
    )
  } catch (error) {
    console.error('Erro ao criar tarefa ad-hoc:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
