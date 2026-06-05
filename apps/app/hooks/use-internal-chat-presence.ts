'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'

interface PresenceUser {
  user_id: string
  user_name: string
  typing: boolean
  online_at: string
}

export function useInternalChatPresence(currentUser: { id: string; name: string }) {
  const [onlineUsers, setOnlineUsers] = useState<PresenceUser[]>([])
  const [typingUsers, setTypingUsers] = useState<PresenceUser[]>([])
  const channelRef = useRef<ReturnType<ReturnType<typeof createClient>['channel']> | null>(null)

  useEffect(() => {
    const supabase = createClient()
    const channel = supabase.channel('internal-chat-presence', {
      config: { presence: { key: currentUser.id } },
    })

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState<PresenceUser>()
        const users: PresenceUser[] = []
        for (const key of Object.keys(state)) {
          const entries = state[key]
          if (entries && entries.length > 0) {
            users.push(entries[0])
          }
        }
        setOnlineUsers(users)
        setTypingUsers(users.filter((u) => u.typing && u.user_id !== currentUser.id))
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
    }
  }, [currentUser.id, currentUser.name])

  const setTyping = useCallback(
    async (isTyping: boolean) => {
      if (channelRef.current) {
        await channelRef.current.track({
          user_id: currentUser.id,
          user_name: currentUser.name,
          typing: isTyping,
          online_at: new Date().toISOString(),
        })
      }
    },
    [currentUser.id, currentUser.name]
  )

  return { onlineUsers, typingUsers, setTyping }
}
