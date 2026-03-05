import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { recalculateProgress } from '@/lib/process-engine'
import { z } from 'zod'

const subtaskUpdateSchema = z
  .object({
    is_completed: z.boolean().optional(),
    rendered_content: z
      .object({
        subject: z.string().optional(),
        body_html: z.string().optional(),
        content_html: z.string().optional(),
        editor_state: z.any().optional(),
      })
      .optional(),
  })
  .refine(
    (data) => data.is_completed !== undefined || data.rendered_content !== undefined,
    { message: 'is_completed ou rendered_content são obrigatórios' }
  )

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string; taskId: string; subtaskId: string }> }
) {
  try {
    const { id, taskId, subtaskId } = await params
    const supabase = await createClient()
    const admin = createAdminClient()
    const adminDb = admin as unknown as { from: (t: string) => ReturnType<typeof supabase.from> }

    // Verificar autenticação
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    // Parse e validação
    const body = await request.json()
    const validation = subtaskUpdateSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: validation.error.flatten() },
        { status: 400 }
      )
    }

    const { is_completed, rendered_content } = validation.data

    // Verificar que a subtarefa existe e pertence à tarefa (admin — tabela não está nos types)
    const { data: subtask, error: subtaskError } = await adminDb.from('proc_subtasks')
      .select('id, config, proc_task_id')
      .eq('id', subtaskId)
      .eq('proc_task_id', taskId)
      .single()

    if (subtaskError || !subtask) {
      return NextResponse.json({ error: 'Subtarefa não encontrada' }, { status: 404 })
    }

    // Verificar que a tarefa pertence ao processo correcto
    const { data: parentTask, error: parentTaskError } = await supabase
      .from('proc_tasks')
      .select('id, proc_instance_id')
      .eq('id', taskId)
      .eq('proc_instance_id', id)
      .single()

    if (parentTaskError || !parentTask) {
      return NextResponse.json(
        { error: 'Subtarefa não pertence a este processo' },
        { status: 404 }
      )
    }

    // Verificar que o tipo de subtarefa permite a operação
    const config = ((subtask as Record<string, unknown>).config as Record<string, unknown>) || {}
    const subtaskType = config.type as string | undefined
    const checkType = config.check_type as string | undefined

    const isAllowedType =
      subtaskType === 'checklist' ||
      subtaskType === 'email' ||
      subtaskType === 'generate_doc' ||
      checkType === 'manual'

    if (!isAllowedType) {
      return NextResponse.json(
        { error: 'Este tipo de subtarefa não suporta actualização manual' },
        { status: 400 }
      )
    }

    // Construir o update
    const updateData: Record<string, unknown> = {}

    if (rendered_content) {
      updateData.config = { ...config, rendered: rendered_content }
    }

    if (is_completed !== undefined) {
      updateData.is_completed = is_completed
      updateData.completed_at = is_completed ? new Date().toISOString() : null
      updateData.completed_by = is_completed ? user.id : null
    }

    // Executar update (admin bypassa RLS)
    const { error: updateError } = await adminDb.from('proc_subtasks')
      .update(updateData)
      .eq('id', subtaskId)

    if (updateError) {
      return NextResponse.json(
        { error: 'Erro ao actualizar subtarefa', details: updateError.message },
        { status: 500 }
      )
    }

    // Rascunho guardado — retornar
    if (is_completed === undefined) {
      return NextResponse.json({ success: true, taskStatus: null })
    }

    // Verificar estado de todas as subtarefas para recalcular a tarefa pai
    const { data: allSubtasks, error: allSubtasksError } = await adminDb.from('proc_subtasks')
      .select('is_completed, is_mandatory')
      .eq('proc_task_id', taskId)

    if (allSubtasksError) {
      return NextResponse.json({ error: 'Erro ao verificar subtarefas' }, { status: 500 })
    }

    const subtasksList = (allSubtasks || []) as Array<{
      is_completed: boolean
      is_mandatory: boolean
    }>
    const mandatorySubtasks = subtasksList.filter((s) => s.is_mandatory)
    const allMandatoryComplete = mandatorySubtasks.every((s) => s.is_completed)
    const anyComplete = subtasksList.some((s) => s.is_completed)

    let newTaskStatus: string
    if (allMandatoryComplete && mandatorySubtasks.length > 0) {
      newTaskStatus = 'completed'
    } else if (anyComplete) {
      newTaskStatus = 'in_progress'
    } else {
      newTaskStatus = 'pending'
    }

    const taskUpdate: Record<string, unknown> = {
      status: newTaskStatus,
      updated_at: new Date().toISOString(),
      completed_at: newTaskStatus === 'completed' ? new Date().toISOString() : null,
    }

    await supabase.from('proc_tasks').update(taskUpdate).eq('id', taskId)
    await recalculateProgress(id)

    return NextResponse.json({ success: true, taskStatus: newTaskStatus })
  } catch (error) {
    console.error('Erro ao actualizar subtarefa:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
