'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'

export type ChatLastMessage = {
  id: string
  content: string
  sender_id: string
  created_at: string
  has_attachments: boolean
}

/** Returns maps de channelId para unread count, última actividade (timestamp)
 *  e última mensagem (preview) — usados pela lista de conversas para
 *  ordenar e mostrar snippets ao estilo WhatsApp. */
export function useChatUnread() {
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [lastActivity, setLastActivity] = useState<Record<string, string>>({})
  const [lastMessage, setLastMessage] = useState<Record<string, ChatLastMessage>>({})
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchCounts = useCallback(async () => {
    try {
      const res = await fetch('/api/chat/internal/unread')
      if (!res.ok) return
      const data = await res.json()
      // Backwards compat: aceita tanto a forma antiga `Record<string, number>`
      // como a nova `{ counts, lastActivity, lastMessage }`.
      if (data && typeof data === 'object' && 'counts' in data) {
        setCounts(data.counts || {})
        setLastActivity(data.lastActivity || {})
        setLastMessage(data.lastMessage || {})
      } else {
        setCounts(data || {})
      }
    } catch {
      // silent
    }
  }, [])

  // Initial load
  useEffect(() => {
    fetchCounts()
  }, [fetchCounts])

  // Poll every 15s
  useEffect(() => {
    intervalRef.current = setInterval(fetchCounts, 15000)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [fetchCounts])

  // Also subscribe to realtime for instant updates
  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel('internal-chat-unread')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'internal_chat_messages' },
        () => { fetchCounts() }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [fetchCounts])

  const totalUnread = Object.values(counts).reduce((sum, c) => sum + c, 0)

  return { counts, lastActivity, lastMessage, totalUnread, refetch: fetchCounts }
}
