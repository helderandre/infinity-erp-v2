import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { sendInternalMessageSchema } from '@/lib/validations/internal-chat'
import { INTERNAL_CHAT_CHANNEL_ID } from '@/lib/constants'

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

    return NextResponse.json(responseMessage, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
