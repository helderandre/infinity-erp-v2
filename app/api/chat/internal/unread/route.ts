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

    // Última actividade por canal — última mensagem em qualquer direcção
    // (recebida OU enviada pelo próprio). Usado para ordenar a lista de
    // conversas pela mais recente, à WhatsApp.
    const { data: allMessages } = await db.from('internal_chat_messages')
      .select('channel_id, created_at, sender_id')
      .eq('is_deleted', false)
      .order('created_at', { ascending: false })
      .limit(2000)

    const lastActivity: Record<string, string> = {}
    const channelsWithIncoming = new Set<string>()
    const messagesArr = ((allMessages || []) as unknown) as Array<{
      channel_id: string
      created_at: string
      sender_id: string
    }>
    for (const m of messagesArr) {
      if (!lastActivity[m.channel_id]) {
        lastActivity[m.channel_id] = m.created_at
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

    return NextResponse.json({ counts, lastActivity })
  } catch {
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
