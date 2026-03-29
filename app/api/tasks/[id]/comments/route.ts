import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/permissions'
import { createTaskCommentSchema } from '@/lib/validations/task'
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

    const { data, error } = await supabase
      .from('task_comments')
      .select(`
        *,
        user:dev_users(id, commercial_name)
      `)
      .eq('task_id', id)
      .order('created_at', { ascending: true })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data || [])
  } catch (error) {
    console.error('Erro ao listar comentários:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth()
    if (!auth.authorized) return auth.response

    const { id } = await params
    const body = await request.json()
    const validation = createTaskCommentSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: validation.error.flatten() },
        { status: 400 }
      )
    }

    const supabase = createAdminClient()

    const { data: comment, error } = await supabase
      .from('task_comments')
      .insert({
        task_id: id,
        user_id: auth.user.id,
        content: validation.data.content,
      })
      .select(`
        *,
        user:dev_users(id, commercial_name)
      `)
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Notify task assignee and creator about new comment
    const { data: task } = await supabase
      .from('tasks')
      .select('id, title, assigned_to, created_by')
      .eq('id', id)
      .single()

    if (task) {
      const recipients = new Set<string>()
      if (task.assigned_to) recipients.add(task.assigned_to)
      if (task.created_by) recipients.add(task.created_by)
      recipients.delete(auth.user.id) // Don't notify yourself

      for (const recipientId of recipients) {
        await notificationService.create({
          recipientId,
          senderId: auth.user.id,
          notificationType: 'task_comment',
          entityType: 'proc_task',
          entityId: id,
          title: 'Novo comentário na tarefa',
          body: task.title,
          actionUrl: `/dashboard/tarefas?task=${id}`,
        })
      }
    }

    return NextResponse.json(comment, { status: 201 })
  } catch (error) {
    console.error('Erro ao criar comentário:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
