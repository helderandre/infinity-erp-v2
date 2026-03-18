'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { WppChat } from '@/lib/types/whatsapp-web'

interface UseWhatsAppChatsOptions {
  instanceId: string | null
  search?: string
  archived?: boolean
}

export function useWhatsAppChats({ instanceId, search, archived = false }: UseWhatsAppChatsOptions) {
  const [chats, setChats] = useState<WppChat[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [total, setTotal] = useState(0)
  const channelRef = useRef<ReturnType<ReturnType<typeof createClient>['channel']> | null>(null)

  const fetchChats = useCallback(async () => {
    if (!instanceId) {
      setChats([])
      setTotal(0)
      return
    }

    setIsLoading(true)
    try {
      const params = new URLSearchParams({
        instance_id: instanceId,
        archived: String(archived),
      })
      if (search) params.set("search", search)

      const res = await fetch(`/api/whatsapp/chats?${params}`)
      if (!res.ok) throw new Error("Erro ao carregar chats")

      const data = await res.json()
      setChats(data.chats)
      setTotal(data.total)
    } catch {
      // silently fail
    } finally {
      setIsLoading(false)
    }
  }, [instanceId, search, archived])

  // Fetch + subscribe to realtime
  useEffect(() => {
    if (!instanceId) {
      setChats([])
      setTotal(0)
      return
    }

    fetchChats()

    const supabase = createClient()
    const channel = supabase
      .channel(`wpp-chats-${instanceId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'wpp_chats',
          filter: `instance_id=eq.${instanceId}`,
        },
        () => {
          fetchChats()
        }
      )
      .subscribe()

    channelRef.current = channel

    return () => {
      supabase.removeChannel(channel)
      channelRef.current = null
    }
  }, [instanceId, fetchChats])

  return { chats, isLoading, total, refetch: fetchChats }
}
