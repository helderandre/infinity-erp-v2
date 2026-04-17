import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { INTERNAL_CHAT_CHANNEL_ID } from '@/lib/constants'

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

    // Get all read receipts for this user
    const { data: receipts } = await db.from('internal_chat_read_receipts')
      .select('channel_id, last_read_at')
      .eq('user_id', user.id)

    const receiptMap = new Map<string, string>()
    for (const r of (receipts || [])) {
      receiptMap.set((r as any).channel_id, (r as any).last_read_at)
    }

    // Get all channels this user has messages in (group + DMs)
    const { data: channels } = await db.from('internal_chat_messages')
      .select('channel_id')
      .neq('sender_id', user.id)
      .eq('is_deleted', false)

    const uniqueChannelIds = Array.from(
      new Set((channels || []).map((c: any) => c.channel_id))
    )

    // Count unread per channel
    const counts: Record<string, number> = {}

    for (const channelId of uniqueChannelIds) {
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

    return NextResponse.json(counts)
  } catch {
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
