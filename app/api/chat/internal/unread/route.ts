import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const db = supabase as unknown as {
      from: (table: string) => ReturnType<typeof supabase.from>
    }

    // Read receipts: por canal, quando o utilizador leu pela última vez.
    const { data: receipts } = await db.from('internal_chat_read_receipts')
      .select('channel_id, last_read_at')
      .eq('user_id', user.id)

    const receiptMap = new Map<string, string>()
    for (const r of (receipts || [])) {
      receiptMap.set((r as any).channel_id, (r as any).last_read_at)
    }

    // Última actividade + preview da última mensagem por canal — usado
    // para ordenar a lista de conversas pela mais recente e mostrar um
    // snippet do estilo WhatsApp ("Hoje 13:50 | última mensagem...").
    // Buscamos as 2000 mensagens mais recentes (ordenadas desc) e
    // colapsamos por channel_id, ficando com a primeira ocorrência (que
    // é a mais recente porque já vêm ordenadas).
    const { data: allMessages } = await db.from('internal_chat_messages')
      .select('id, channel_id, created_at, sender_id, content, has_attachments')
      .eq('is_deleted', false)
      .order('created_at', { ascending: false })
      .limit(2000)

    const lastActivity: Record<string, string> = {}
    const lastMessage: Record<
      string,
      {
        id: string
        content: string
        sender_id: string
        created_at: string
        has_attachments: boolean
      }
    > = {}
    const channelsWithIncoming = new Set<string>()
    const messagesArr = ((allMessages || []) as unknown) as Array<{
      id: string
      channel_id: string
      created_at: string
      sender_id: string
      content: string | null
      has_attachments: boolean | null
    }>
    for (const m of messagesArr) {
      if (!lastActivity[m.channel_id]) {
        lastActivity[m.channel_id] = m.created_at
        lastMessage[m.channel_id] = {
          id: m.id,
          content: m.content || '',
          sender_id: m.sender_id,
          created_at: m.created_at,
          has_attachments: Boolean(m.has_attachments),
        }
      }
      if (m.sender_id !== user.id) {
        channelsWithIncoming.add(m.channel_id)
      }
    }

    // Count unread per channel — só interessa para canais que têm
    // mensagens vindas de outros utilizadores (canais "ouvidos").
    const counts: Record<string, number> = {}

    for (const channelId of channelsWithIncoming) {
      const lastReadAt = receiptMap.get(channelId)

      let query = db.from('internal_chat_messages')
        .select('id', { count: 'exact', head: true } as any)
        .eq('channel_id', channelId)
        .eq('is_deleted', false)
        .neq('sender_id', user.id)

      if (lastReadAt) {
        query = query.gt('created_at', lastReadAt)
      }

      const { count } = await query

      if (count && count > 0) {
        counts[channelId] = count
      }
    }

    return NextResponse.json({ counts, lastActivity, lastMessage })
  } catch {
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
