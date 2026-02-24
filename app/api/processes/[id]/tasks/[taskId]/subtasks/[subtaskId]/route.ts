import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { recalculateProgress } from '@/lib/process-engine'
import { z } from 'zod'

const subtaskToggleSchema = z.object({
  is_completed: z.boolean(),
})

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string; taskId: string; subtaskId: string }> }
) {
  try {
    const { id, taskId, subtaskId } = await params
    const supabase = await createClient()
    // Cast para aceder a tabelas não presentes no database.ts gerado
    const db = supabase as unknown as {
      from: (table: string) => ReturnType<typeof supabase.from>
      auth: typeof supabase.auth
    }

    // Verificar autenticação
    const {
      data: { user },
      error: authError,
    } = await db.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    // Parse e validação
    const body = await request.json()
    const validation = subtaskToggleSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: validation.error.flatten() },
        { status: 400 }
      )
    }

    const { is_completed } = validation.data

    // Verificar que a subtarefa existe e pertence à tarefa
    const { data: subtask, error: subtaskError } = await (db.from('proc_subtasks') as ReturnType<typeof supabase.from>)
      .select('id, config, proc_task_id')
      .eq('id', subtaskId)
      .eq('proc_task_id', taskId)
      .single()

    if (subtaskError || !subtask) {
      return NextResponse.json(
        { error: 'Subtarefa não encontrada' },
        { status: 404 }
      )
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

    // Verificar que é uma subtarefa manual
    const config = ((subtask as Record<string, unknown>).config as Record<string, string>) || {}
    if (config.check_type !== 'manual') {
      return NextResponse.json(
        { error: 'Apenas subtarefas manuais podem ser alteradas' },
        { status: 400 }
      )
    }

    // Actualizar subtarefa
    const { error: updateError } = await (db.from('proc_subtasks') as ReturnType<typeof supabase.from>)
      .update({
        is_completed,
        completed_at: is_completed ? new Date().toISOString() : null,
        completed_by: is_completed ? user.id : null,
      })
      .eq('id', subtaskId)

    if (updateError) {
      return NextResponse.json(
        { error: 'Erro ao actualizar subtarefa', details: updateError.message },
        { status: 500 }
      )
    }

    // Verificar estado de todas as subtarefas da tarefa pai
    const { data: allSubtasks, error: allSubtasksError } = await (db.from('proc_subtasks') as ReturnType<typeof supabase.from>)
      .select('is_completed, is_mandatory')
      .eq('proc_task_id', taskId)

    if (allSubtasksError) {
      return NextResponse.json(
        { error: 'Erro ao verificar subtarefas' },
        { status: 500 }
      )
    }

    // Determinar novo status da tarefa pai
    const subtasksList = (allSubtasks || []) as Array<{ is_completed: boolean; is_mandatory: boolean }>
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

    // Actualizar status da tarefa pai
    const taskUpdate: Record<string, unknown> = {
      status: newTaskStatus,
      updated_at: new Date().toISOString(),
    }
    if (newTaskStatus === 'completed') {
      taskUpdate.completed_at = new Date().toISOString()
    } else {
      taskUpdate.completed_at = null
    }

    await supabase
      .from('proc_tasks')
      .update(taskUpdate)
      .eq('id', taskId)

    // Recalcular progresso do processo
    await recalculateProgress(id)

    return NextResponse.json({
      success: true,
      taskStatus: newTaskStatus,
    })
  } catch (error) {
    console.error('Erro ao actualizar subtarefa:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
