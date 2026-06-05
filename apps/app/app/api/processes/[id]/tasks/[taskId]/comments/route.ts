import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { commentSchema } from '@/lib/validations/comment'
import { notificationService } from '@/lib/notifications/service'
import { sendPushToUser } from '@/lib/crm/send-push'
import { logTaskActivity } from '@/lib/processes/activity-logger'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string; taskId: string }> }
) {
  try {
    const { taskId } = await params
    const supabase = await createClient()
    const db = supabase as unknown as {
      from: (table: string) => ReturnType<typeof supabase.from>
      auth: typeof supabase.auth
    }

    // Verificar autenticação
    const { data: { user }, error: authError } = await db.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    // Buscar comentários com dados do utilizador
    const { data, error } = await (db.from('proc_task_comments') as ReturnType<typeof supabase.from>)
      .select('*, user:dev_users(id, commercial_name, profile:dev_consultant_profiles(profile_photo_url))')
      .eq('proc_task_id', taskId)
      .order('created_at', { ascending: true })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; taskId: string }> }
) {
  try {
    const { id, taskId } = await params
    const supabase = await createClient()
    const db = supabase as unknown as {
      from: (table: string) => ReturnType<typeof supabase.from>
      auth: typeof supabase.auth
    }

    // Verificar autenticação
    const { data: { user }, error: authError } = await db.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    // Validar body
    const body = await request.json()
    const validation = commentSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: validation.error.flatten() },
        { status: 400 }
      )
    }

    // Verificar que a tarefa pertence ao processo
    const { data: task, error: taskError } = await supabase
      .from('proc_tasks')
      .select('id, title, assigned_to, proc_instance:proc_instances(external_ref)')
      .eq('id', taskId)
      .eq('proc_instance_id', id)
      .single()

    if (taskError || !task) {
      return NextResponse.json({ error: 'Tarefa não encontrada' }, { status: 404 })
    }

    // Inserir comentário
    const { data: comment, error: insertError } = await (db.from('proc_task_comments') as ReturnType<typeof supabase.from>)
      .insert({
        proc_task_id: taskId,
        user_id: user.id,
        content: validation.data.content,
        mentions: validation.data.mentions,
      })
      .select('*, user:dev_users(id, commercial_name, profile:dev_consultant_profiles(profile_photo_url))')
      .single()

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }

    // --- Registar actividade de comentário ---
    try {
      const commentUserName = (comment as any).user?.commercial_name || 'Utilizador'
      await logTaskActivity(supabase, taskId, user.id, 'comment', `${commentUserName} adicionou um comentário`, {
        comment_id: comment.id,
        content_preview: validation.data.content.substring(0, 100),
      })
    } catch (activityError) {
      console.error('[Comments] Erro ao registar actividade:', activityError)
    }

    // --- Notificações ---
    try {
      const procRef = (task as any).proc_instance?.external_ref || ''
      const taskTitle = (task as any).title || ''
      const notifiedUserIds = new Set<string>()

      // Cliente admin para web-push (RLS-bypass; Realtime+push não dependem
      // da sessão do caller).
      const pushDb = createAdminClient()
      const pushUrl = `/dashboard/processos/${id}?task=${taskId}&tab=comments`

      // #7: Menções em comentário — notificar cada mencionado
      if (validation.data.mentions && validation.data.mentions.length > 0) {
        for (const mention of validation.data.mentions) {
          if (mention.user_id !== user.id) {
            notifiedUserIds.add(mention.user_id)
            const mentionTitle = 'Mencionado num comentário'
            const mentionBody = `${(comment as any).user?.commercial_name || 'Alguém'} mencionou-o na tarefa "${taskTitle}"`
            await notificationService.create({
              recipientId: mention.user_id,
              senderId: user.id,
              notificationType: 'comment_mention',
              entityType: 'proc_task_comment',
              entityId: comment.id,
              title: mentionTitle,
              body: mentionBody,
              actionUrl: pushUrl,
              metadata: { process_ref: procRef, task_title: taskTitle },
            })
            // Push imediato (mention prioritário)
            try {
              await sendPushToUser(pushDb, mention.user_id, {
                title: mentionTitle,
                body: mentionBody,
                url: pushUrl,
                tag: `comment_mention:${comment.id}`,
              })
            } catch (err) {
              console.error('[proc comments] push mention:', err)
            }
          }
        }
      }

      // #5: Novo comentário — notificar responsável da tarefa (se não é o autor e não foi já notificado por menção)
      const taskAssignedTo = (task as any).assigned_to
      if (taskAssignedTo && taskAssignedTo !== user.id && !notifiedUserIds.has(taskAssignedTo)) {
        const commentTitle = 'Novo comentário na tarefa'
        const commentBody = `Novo comentário na tarefa "${taskTitle}" do processo ${procRef}`
        await notificationService.create({
          recipientId: taskAssignedTo,
          senderId: user.id,
          notificationType: 'task_comment',
          entityType: 'proc_task_comment',
          entityId: comment.id,
          title: commentTitle,
          body: commentBody,
          actionUrl: pushUrl,
          metadata: { process_ref: procRef, task_title: taskTitle },
        })
        // Push imediato ao responsável da task
        try {
          await sendPushToUser(pushDb, taskAssignedTo, {
            title: commentTitle,
            body: commentBody,
            url: pushUrl,
            tag: `task_comment:${comment.id}`,
          })
        } catch (err) {
          console.error('[proc comments] push assignee:', err)
        }
      }
    } catch (notifError) {
      console.error('[Comments] Erro ao enviar notificações:', notifError)
    }

    return NextResponse.json(comment, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
