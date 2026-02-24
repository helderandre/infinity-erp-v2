'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { ChatPresenceUser } from '@/types/process'

export function useChatPresence(
  processId: string,
  currentUser: { id: string; name: string }
) {
  const [onlineUsers, setOnlineUsers] = useState<ChatPresenceUser[]>([])
  const [typingUsers, setTypingUsers] = useState<ChatPresenceUser[]>([])
  const channelRef = useRef<ReturnType<ReturnType<typeof createClient>['channel']> | null>(null)

  useEffect(() => {
    if (!processId || !currentUser.id) return

    const supabase = createClient()
    const channel = supabase.channel(`process-presence-${processId}`, {
      config: { presence: { key: currentUser.id } },
    })

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState<ChatPresenceUser>()
        const users: ChatPresenceUser[] = []

        Object.values(state).forEach((presences) => {
          presences.forEach((p) => {
            users.push(p as unknown as ChatPresenceUser)
          })
        })

        setOnlineUsers(users)
        setTypingUsers(
          users.filter(
            (u) => u.typing && u.user_id !== currentUser.id
          )
        )
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({
            user_id: currentUser.id,
            user_name: currentUser.name,
            typing: false,
            online_at: new Date().toISOString(),
          })
        }
      })

    channelRef.current = channel

    return () => {
      supabase.removeChannel(channel)
      channelRef.current = null
    }
  }, [processId, currentUser.id, currentUser.name])

  const setTyping = useCallback(
    (isTyping: boolean) => {
      if (!channelRef.current) return
      channelRef.current.track({
        user_id: currentUser.id,
        user_name: currentUser.name,
        typing: isTyping,
        online_at: new Date().toISOString(),
      })
    },
    [currentUser.id, currentUser.name]
  )

  return { onlineUsers, typingUsers, setTyping }
}
