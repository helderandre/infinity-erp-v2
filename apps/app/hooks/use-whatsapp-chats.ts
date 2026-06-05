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
  const hasLoadedRef = useRef(false)
  // AbortController for the chat-list fetch — without this, leaving the
  // WhatsApp page leaves the request in flight and the eventual setChats
  // fires on an unmounted component, holding state work during navigation.
  const abortRef = useRef<AbortController | null>(null)

  const fetchChats = useCallback(async () => {
    if (!instanceId) {
      setChats([])
      setTotal(0)
      return
    }

    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    // Only show skeleton on first load
    if (!hasLoadedRef.current) setIsLoading(true)

    try {
      const params = new URLSearchParams({
        instance_id: instanceId,
        archived: String(archived),
      })
      if (search) params.set("search", search)

      const res = await fetch(`/api/whatsapp/chats?${params}`, {
        signal: controller.signal,
      })
      if (!res.ok) throw new Error("Erro ao carregar chats")

      const data = await res.json()
      if (controller.signal.aborted) return
      setChats(data.chats)
      setTotal(data.total)
      hasLoadedRef.current = true
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return
      // silently fail
    } finally {
      if (!controller.signal.aborted) setIsLoading(false)
    }
  }, [instanceId, search, archived])

  // Fetch + subscribe to realtime
  useEffect(() => {
    if (!instanceId) {
      setChats([])
      setTotal(0)
      hasLoadedRef.current = false
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
      abortRef.current?.abort()
      abortRef.current = null
      supabase.removeChannel(channel)
      channelRef.current = null
    }
  }, [instanceId, fetchChats])

  return { chats, isLoading, total, refetch: fetchChats }
}
