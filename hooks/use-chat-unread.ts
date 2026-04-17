'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'

/** Returns a map of channelId → unread count for internal chat (group + DMs) */
export function useChatUnread() {
  const [counts, setCounts] = useState<Record<string, number>>({})
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchCounts = useCallback(async () => {
    try {
      const res = await fetch('/api/chat/internal/unread')
      if (!res.ok) return
      const data = await res.json()
      setCounts(data)
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

  return { counts, totalUnread, refetch: fetchCounts }
}
