import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { sendInternalMessageSchema } from '@/lib/validations/internal-chat'
import { INTERNAL_CHAT_CHANNEL_ID } from '@/lib/constants'
import { notificationService } from '@/lib/notifications/service'
import { sendPushToUser } from '@/lib/crm/send-push'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const cursor = searchParams.get('cursor')
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 100)
    const channelId = searchParams.get('channelId') || INTERNAL_CHAT_CHANNEL_ID

    const db = supabase as unknown as {
      from: (table: string) => ReturnType<typeof supabase.from>
    }

    let query = db.from('internal_chat_messages')
      .select(`
        *,
        sender:dev_users(id, commercial_name, profile:dev_consultant_profiles(profile_photo_url)),
        parent_message:internal_chat_messages!parent_message_id(id, content, sender_id, sender:dev_users(id, commercial_name)),
        attachments:internal_chat_attachments(*),
        reactions:internal_chat_reactions(id, emoji, user_id, user:dev_users(commercial_name))
      `)
      .eq('channel_id', channelId)
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

    // Denormalize parent messages
    const parentIds = Array.from(
      new Set(
        (data || [])
          .map((msg: any) => msg.parent_message_id)
          .filter((id: string | null): id is string => Boolean(id))
      )
    )

    let parentMap = new Map<string, any>()
    if (parentIds.length > 0) {
      const { data: parents } = await db.from('internal_chat_messages')
        .select('id, content, sender_id, sender:dev_users(id, commercial_name)')
        .in('id', parentIds)

      if (parents) {
        parents.forEach((p: any) => parentMap.set(p.id, p))
      }
    }

    const normalized = (data || []).map((msg: any) => ({
      ...msg,
      parent_message: msg.parent_message_id
        ? parentMap.get(msg.parent_message_id) || null
        : null,
    }))

    return NextResponse.json(normalized)
  } catch {
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const validation = sendInternalMessageSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: validation.error.flatten() },
        { status: 400 }
      )
    }

    const db = supabase as unknown as {
      from: (table: string) => ReturnType<typeof supabase.from>
    }

    const channelId = body.channel_id || INTERNAL_CHAT_CHANNEL_ID
    const isDm = channelId !== INTERNAL_CHAT_CHANNEL_ID

    const { data: message, error: insertError } = await db.from('internal_chat_messages')
      .insert({
        channel_id: channelId,
        sender_id: user.id,
        content: validation.data.content,
        mentions: validation.data.mentions,
        parent_message_id: validation.data.parent_message_id || null,
      })
      .select(`
        *,
        sender:dev_users(id, commercial_name, profile:dev_consultant_profiles(profile_photo_url)),
        attachments:internal_chat_attachments(*),
        reactions:internal_chat_reactions(id, emoji, user_id, user:dev_users(commercial_name))
      `)
      .single()

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }

    let responseMessage = message as any
    if (validation.data.parent_message_id) {
      const { data: parent } = await db.from('internal_chat_messages')
        .select('id, content, sender_id, sender:dev_users(id, commercial_name)')
        .eq('id', validation.data.parent_message_id)
        .single()

      responseMessage = { ...responseMessage, parent_message: parent || null }
    }

    // --- Notifications & Push ---
    try {
      const senderName = responseMessage.sender?.commercial_name || 'Alguém'
      const contentPreview = validation.data.content.slice(0, 100)
      const adminSupabase = createAdminClient()

      if (isDm) {
        // DM: notify the other user in the channel
        // Parse the channel to find the other user — we get it from body
        const dmRecipientId = body.dm_recipient_id
        if (dmRecipientId && dmRecipientId !== user.id) {
          await notificationService.create({
            recipientId: dmRecipientId,
            senderId: user.id,
            notificationType: 'dm_message',
            entityType: 'internal_chat_message',
            entityId: responseMessage.id,
            title: `${senderName} enviou-lhe uma mensagem`,
            body: contentPreview,
            actionUrl: `/dashboard/comunicacao/chat?dm=${dmRecipientId}`,
          })

          await sendPushToUser(adminSupabase, dmRecipientId, {
            title: senderName,
            body: contentPreview,
            url: `/dashboard/comunicacao/chat?dm=${dmRecipientId}`,
            tag: `dm-${channelId}`,
          })
        }
      } else {
        // Group chat: notify all active users except sender
        const { data: activeUsers } = await adminSupabase
          .from('dev_users')
          .select('id')
          .eq('is_active', true)
          .neq('id', user.id)

        const recipientIds = (activeUsers || []).map((u: any) => u.id)

        // Mentions get a specific notification
        const mentionedIds = new Set(
          (validation.data.mentions || []).map((m: { user_id: string }) => m.user_id)
        )

        for (const recipientId of recipientIds) {
          const isMentioned = mentionedIds.has(recipientId)

          await notificationService.create({
            recipientId,
            senderId: user.id,
            notificationType: isMentioned ? 'internal_chat_mention' : 'internal_chat_message',
            entityType: 'internal_chat_message',
            entityId: responseMessage.id,
            title: isMentioned
              ? `${senderName} mencionou-o no Grupo Geral`
              : `${senderName} no Grupo Geral`,
            body: contentPreview,
            actionUrl: '/dashboard/comunicacao/chat',
          })

          await sendPushToUser(adminSupabase, recipientId, {
            title: isMentioned ? `${senderName} mencionou-o` : `Grupo Geral — ${senderName}`,
            body: contentPreview,
            url: '/dashboard/comunicacao/chat',
            tag: 'internal-chat',
          })
        }
      }
    } catch (notifError) {
      console.error('[InternalChat] Erro ao enviar notificações:', notifError)
    }

    return NextResponse.json(responseMessage, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
