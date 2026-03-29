import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/permissions'
import { updateTaskSchema } from '@/lib/validations/task'
import { getNextOccurrence } from '@/lib/tasks/recurrence'
import { notificationService } from '@/lib/notifications/service'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth()
    if (!auth.authorized) return auth.response

    const { id } = await params
    const supabase = createAdminClient()

    const { data: task, error } = await supabase
      .from('tasks')
      .select(`
        *,
        assignee:assigned_to(id, commercial_name),
        creator:created_by(id, commercial_name),
        completer:completed_by(id, commercial_name),
        sub_tasks:tasks!parent_task_id(
          id, title, is_completed, priority, due_date, assigned_to, order_index, completed_at,
          assignee:assigned_to(id, commercial_name)
        ),
        task_comments(count),
        task_attachments(count)
      `)
      .eq('id', id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Tarefa não encontrada' }, { status: 404 })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(task)
  } catch (error) {
    console.error('Erro ao obter tarefa:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth()
    if (!auth.authorized) return auth.response

    const { id } = await params
    const body = await request.json()
    const validation = updateTaskSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: validation.error.flatten() },
        { status: 400 }
      )
    }

    const data = validation.data
    const supabase = createAdminClient()

    // Fetch current task for recurring logic and notifications
    const { data: currentTask } = await supabase
      .from('tasks')
      .select('id, title, is_completed, is_recurring, recurrence_rule, due_date, assigned_to, created_by')
      .eq('id', id)
      .single()

    if (!currentTask) {
      return NextResponse.json({ error: 'Tarefa não encontrada' }, { status: 404 })
    }

    // Build update object
    const updateData: Record<string, unknown> = { ...data }

    // Handle completion
    if (data.is_completed === true && !currentTask.is_completed) {
      updateData.completed_at = new Date().toISOString()
      updateData.completed_by = auth.user.id
    } else if (data.is_completed === false) {
      updateData.completed_at = null
      updateData.completed_by = null
    }

    const { data: updated, error } = await supabase
      .from('tasks')
      .update(updateData)
      .eq('id', id)
      .select('id, title, is_completed, assigned_to, created_by')
      .single()

    if (error) {
      console.error('Erro ao actualizar tarefa:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Handle recurring: spawn next occurrence when completed
    if (
      data.is_completed === true &&
      !currentTask.is_completed &&
      currentTask.is_recurring &&
      currentTask.recurrence_rule &&
      currentTask.due_date
    ) {
      const nextDue = getNextOccurrence(currentTask.due_date, currentTask.recurrence_rule)
      if (nextDue) {
        await supabase.from('tasks').insert({
          title: currentTask.title,
          assigned_to: currentTask.assigned_to,
          created_by: currentTask.created_by,
          priority: data.priority ?? 4,
          due_date: nextDue,
          is_recurring: true,
          recurrence_rule: currentTask.recurrence_rule,
        })
      }
    }

    // Notify: task completed (notify creator if completer is different)
    if (data.is_completed === true && !currentTask.is_completed) {
      const notifyId = currentTask.created_by !== auth.user.id
        ? currentTask.created_by
        : currentTask.assigned_to !== auth.user.id
          ? currentTask.assigned_to
          : null

      if (notifyId) {
        await notificationService.create({
          recipientId: notifyId,
          senderId: auth.user.id,
          notificationType: 'task_completed',
          entityType: 'proc_task',
          entityId: id,
          title: 'Tarefa concluída',
          body: currentTask.title,
          actionUrl: `/dashboard/tarefas?task=${id}`,
        })
      }
    }

    // Notify: reassignment
    if (data.assigned_to && data.assigned_to !== currentTask.assigned_to && data.assigned_to !== auth.user.id) {
      await notificationService.create({
        recipientId: data.assigned_to,
        senderId: auth.user.id,
        notificationType: 'task_assigned',
        entityType: 'proc_task',
        entityId: id,
        title: 'Tarefa atribuída',
        body: currentTask.title,
        actionUrl: `/dashboard/tarefas?task=${id}`,
      })
    }

    return NextResponse.json(updated)
  } catch (error) {
    console.error('Erro ao actualizar tarefa:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth()
    if (!auth.authorized) return auth.response

    const { id } = await params
    const supabase = createAdminClient()

    const { error } = await supabase
      .from('tasks')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Erro ao eliminar tarefa:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Erro ao eliminar tarefa:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
