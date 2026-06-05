import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { chatMessageSchema } from '@/lib/validations/chat'
import { notificationService } from '@/lib/notifications/service'
import { sendPushToUser } from '@/lib/crm/send-push'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: processId } = await params
    const supabase = await createClient()
    const db = supabase as unknown as {
      from: (table: string) => ReturnType<typeof supabase.from>
      auth: typeof supabase.auth
    }

    const { data: { user }, error: authError } = await db.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const cursor = searchParams.get('cursor')
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 100)

    let query = (db.from('proc_chat_messages') as ReturnType<typeof supabase.from>)
      .select(`
        *,
        sender:dev_users(id, commercial_name, profile:dev_consultant_profiles(profile_photo_url)),
        parent_message:proc_chat_messages!parent_message_id(id, content, sender_id, sender:dev_users(id, commercial_name)),
        attachments:proc_chat_attachments(*),
        reactions:proc_chat_reactions(id, emoji, user_id, user:dev_users(commercial_name))
      `)
      .eq('proc_instance_id', processId)
      .eq('is_deleted', false)
      .order('created_at', { ascending: true })
      .limit(limit)

    if (cursor) {
      query = query.lt('created_at', cursor)
    }

    const { data, error } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const parentIds = Array.from(
      new Set(
        (data || [])
          .map((msg: { parent_message_id: string | null }) => msg.parent_message_id)
          .filter((id: string | null): id is string => Boolean(id))
      )
    )

    let parentMap = new Map<string, { id: string; content: string; sender_id: string; sender?: { id: string; commercial_name: string } }>()
    if (parentIds.length > 0) {
      const { data: parents, error: parentError } = await (db.from('proc_chat_messages') as ReturnType<typeof supabase.from>)
        .select('id, content, sender_id, sender:dev_users(id, commercial_name)')
        .in('id', parentIds)

      if (!parentError && parents) {
        parents.forEach((p: { id: string; content: string; sender_id: string; sender?: { id: string; commercial_name: string } }) => parentMap.set(p.id, p))
      }
    }

    const normalized = (data || []).map((msg: Record<string, unknown> & { parent_message_id?: string | null }) => {
      const parentId = msg.parent_message_id
      return {
        ...msg,
        parent_message: parentId ? parentMap.get(parentId) || null : null,
      }
    })

    return NextResponse.json(normalized)
  } catch {
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: processId } = await params
    const supabase = await createClient()
    const db = supabase as unknown as {
      from: (table: string) => ReturnType<typeof supabase.from>
      auth: typeof supabase.auth
    }

    const { data: { user }, error: authError } = await db.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const validation = chatMessageSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: validation.error.flatten() },
        { status: 400 }
      )
    }

    // Verificar que o processo existe
    const { data: proc, error: procError } = await supabase
      .from('proc_instances')
      .select('id, external_ref')
      .eq('id', processId)
      .is('deleted_at', null)
      .single()

    if (procError || !proc) {
      return NextResponse.json({ error: 'Processo não encontrado' }, { status: 404 })
    }

    const { data: message, error: insertError } = await (db.from('proc_chat_messages') as ReturnType<typeof supabase.from>)
      .insert({
        proc_instance_id: processId,
        sender_id: user.id,
        content: validation.data.content,
        mentions: validation.data.mentions,
        parent_message_id: validation.data.parent_message_id || null,
      })
      .select(`
        *,
        sender:dev_users(id, commercial_name, profile:dev_consultant_profiles(profile_photo_url)),
        parent_message:proc_chat_messages!parent_message_id(id, content, sender_id, sender:dev_users(id, commercial_name))
      `)
      .single()

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }

    // --- Notificações ---
    try {
      const procRef = (proc as any).external_ref || ''
      const senderName = (message as any).sender?.commercial_name || 'Alguém'
      const messageId = (message as any).id
      const chatUrl = `/dashboard/processos/${processId}?tab=chat&message=${messageId}`

      // Cliente admin para web-push (push correr fora da sessão).
      const pushDb = createAdminClient()

      // Set de quem já vai receber push para evitar dupla notificação de
      // chat_mention + chat_message para a mesma pessoa.
      const notifiedUserIds = new Set<string>()

      // #8: Menções no chat
      if (validation.data.mentions && validation.data.mentions.length > 0) {
        for (const mention of validation.data.mentions) {
          if (mention.user_id !== user.id) {
            notifiedUserIds.add(mention.user_id)
            const mentionTitle = 'Mencionado no chat'
            const mentionBody = `${senderName} mencionou-o no chat do processo ${procRef}`
            await notificationService.create({
              recipientId: mention.user_id,
              senderId: user.id,
              notificationType: 'chat_mention',
              entityType: 'proc_chat_message',
              entityId: messageId,
              title: mentionTitle,
              body: mentionBody,
              actionUrl: chatUrl,
              metadata: { process_ref: procRef },
            })
            try {
              await sendPushToUser(pushDb, mention.user_id, {
                title: mentionTitle,
                body: mentionBody,
                url: chatUrl,
                tag: `chat_mention:${messageId}`,
              })
            } catch (err) {
              console.error('[proc chat] push mention:', err)
            }
          }
        }
      }

      // Mensagem nova → notificar participantes da thread (DISTINCT
      // sender_ids de mensagens anteriores, excluindo self e quem já foi
      // notificado por @mention). 1ª mensagem da thread → ninguém é
      // notificado (esperado); próximas pingam quem já participou.
      const { data: priorSenders } = await (pushDb.from('proc_chat_messages') as any)
        .select('sender_id')
        .eq('proc_instance_id', processId)
        .neq('sender_id', user.id)
        .neq('id', messageId)
      const participantIds = new Set<string>()
      for (const row of (priorSenders || []) as Array<{ sender_id: string }>) {
        if (row.sender_id && !notifiedUserIds.has(row.sender_id)) {
          participantIds.add(row.sender_id)
        }
      }

      if (participantIds.size > 0) {
        const msgTitle = `Nova mensagem no chat ${procRef}`.trim()
        const preview = (validation.data.content || '').slice(0, 120)
        const msgBody = `${senderName}: ${preview}`
        for (const participantId of participantIds) {
          notifiedUserIds.add(participantId)
          await notificationService.create({
            recipientId: participantId,
            senderId: user.id,
            notificationType: 'chat_message',
            entityType: 'proc_chat_message',
            entityId: messageId,
            title: msgTitle,
            body: msgBody,
            actionUrl: chatUrl,
            metadata: { process_ref: procRef },
          })
          try {
            await sendPushToUser(pushDb, participantId, {
              title: msgTitle,
              body: msgBody,
              url: chatUrl,
              tag: `chat_message:${messageId}`,
            })
          } catch (err) {
            console.error('[proc chat] push message:', err)
          }
        }
      }
    } catch (notifError) {
      console.error('[Chat] Erro ao enviar notificações:', notifError)
    }

    let responseMessage = message as any
    if (validation.data.parent_message_id) {
      const { data: parent } = await (db.from('proc_chat_messages') as ReturnType<typeof supabase.from>)
        .select('id, content, sender_id, sender:dev_users(id, commercial_name)')
        .eq('id', validation.data.parent_message_id)
        .single()

      responseMessage = {
        ...responseMessage,
        parent_message: parent || null,
      }
    }

    return NextResponse.json(responseMessage, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
