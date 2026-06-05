'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { PresenceState } from '@/lib/types/whatsapp-web'

export function useWhatsAppPresence(instanceId: string | null) {
  const [presences, setPresences] = useState<Record<string, PresenceState>>({})
  const channelRef = useRef<ReturnType<ReturnType<typeof createClient>['channel']> | null>(null)
  const timeoutsRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

  useEffect(() => {
    if (!instanceId) {
      setPresences({})
      return
    }

    const supabase = createClient()
    const channel = supabase
      .channel(`wpp-presence-${instanceId}`)
      .on('broadcast', { event: 'presence' }, (payload) => {
        const { chatId, type } = payload.payload as { chatId: string; type: string }

        if (type === 'unavailable' || type === 'paused') {
          setPresences((prev) => {
            const next = { ...prev }
            delete next[chatId]
            return next
          })

          // Clear existing timeout
          if (timeoutsRef.current[chatId]) {
            clearTimeout(timeoutsRef.current[chatId])
            delete timeoutsRef.current[chatId]
          }
        } else {
          setPresences((prev) => ({
            ...prev,
            [chatId]: {
              type: type as PresenceState['type'],
              chatId,
              timestamp: Date.now(),
            },
          }))

          // Auto-clear after 30s
          if (timeoutsRef.current[chatId]) {
            clearTimeout(timeoutsRef.current[chatId])
          }
          timeoutsRef.current[chatId] = setTimeout(() => {
            setPresences((prev) => {
              const next = { ...prev }
              delete next[chatId]
              return next
            })
            delete timeoutsRef.current[chatId]
          }, 30_000)
        }
      })
      .subscribe()

    channelRef.current = channel

    return () => {
      supabase.removeChannel(channel)
      channelRef.current = null
      // Clear all timeouts
      for (const t of Object.values(timeoutsRef.current)) {
        clearTimeout(t)
      }
      timeoutsRef.current = {}
    }
  }, [instanceId])

  const sendPresence = useCallback(
    async (chatId: string, type: string) => {
      if (!chatId) return
      try {
        await fetch(`/api/whatsapp/chats/${chatId}/presence`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type }),
        })
      } catch { /* silently ignore presence errors */ }
    },
    []
  )

  const isTyping = useCallback(
    (chatId: string): boolean => {
      const p = presences[chatId]
      return !!p && (p.type === 'composing' || p.type === 'recording')
    },
    [presences]
  )

  return { presences, sendPresence, isTyping }
}
