'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { ChatMessage, ChatMention, ChatReadReceipt } from '@/types/process'

export function useChatMessages(processId: string) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [readReceipts, setReadReceipts] = useState<ChatReadReceipt[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const channelRef = useRef<ReturnType<ReturnType<typeof createClient>['channel']> | null>(null)
  const initialLoadRef = useRef(true)

  const fetchMessages = useCallback(async (options?: { showLoading?: boolean }) => {
    if (!processId) return
    const showLoading = options?.showLoading ?? false
    if (showLoading) setIsLoading(true)
    try {
      const res = await fetch(`/api/processes/${processId}/chat`)
      if (!res.ok) throw new Error('Erro ao carregar mensagens')
      const data = await res.json()
      setMessages(data)
    } catch {
      // silently fail
    } finally {
      if (showLoading) setIsLoading(false)
    }
  }, [processId])

  const fetchReadReceipts = useCallback(async () => {
    if (!processId) return
    try {
      const res = await fetch(`/api/processes/${processId}/chat/read`)
      console.log('[DEBUG read-receipts] GET /chat/read status:', res.status)
      if (!res.ok) {
        console.warn('[DEBUG read-receipts] GET failed:', res.status, res.statusText)
        return
      }
      const data = await res.json()
      console.log('[DEBUG read-receipts] Receipts fetched:', data)
      setReadReceipts(data)
    } catch (err) {
      console.error('[DEBUG read-receipts] Fetch error:', err)
    }
  }, [processId])

  // Fetch initial + subscribe to realtime
  useEffect(() => {
    if (!processId) {
      setMessages([])
      setReadReceipts([])
      return
    }

    const showLoading = initialLoadRef.current
    fetchMessages({ showLoading })
    fetchReadReceipts()
    initialLoadRef.current = false

    const supabase = createClient()
    const channel = supabase
      .channel(`process-chat-${processId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'proc_chat_messages',
          filter: `proc_instance_id=eq.${processId}`,
        },
        () => {
          fetchMessages()
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'proc_chat_messages',
          filter: `proc_instance_id=eq.${processId}`,
        },
        () => {
          fetchMessages()
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'proc_chat_reactions',
        },
        () => {
          fetchMessages()
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'proc_chat_read_receipts',
          filter: `proc_instance_id=eq.${processId}`,
        },
        () => {
          fetchReadReceipts()
        }
      )
      .subscribe()

    channelRef.current = channel

    return () => {
      supabase.removeChannel(channel)
      channelRef.current = null
    }
  }, [processId, fetchMessages, fetchReadReceipts])

  const sendMessage = useCallback(
    async (content: string, mentions: ChatMention[], parentMessageId?: string | null): Promise<ChatMessage | undefined> => {
      if (!processId || isSending) return undefined
      setIsSending(true)
      try {
        const res = await fetch(`/api/processes/${processId}/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content,
            mentions,
            parent_message_id: parentMessageId || null,
          }),
        })
        if (!res.ok) {
          const err = await res.json()
          throw new Error(err.error || 'Erro ao enviar mensagem')
        }
        const message = await res.json()
        // Optimistic: add immediately (realtime will also fire but deduplicates)
        setMessages((prev) => {
          if (prev.find((m) => m.id === message.id)) return prev
          return [...prev, message]
        })
        return message
      } finally {
        setIsSending(false)
      }
    },
    [processId, isSending]
  )

  const editMessage = useCallback(
    async (messageId: string, content: string) => {
      const res = await fetch(`/api/processes/${processId}/chat/${messageId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Erro ao editar mensagem')
      }
    },
    [processId]
  )

  const deleteMessage = useCallback(
    async (messageId: string) => {
      const res = await fetch(`/api/processes/${processId}/chat/${messageId}`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Erro ao eliminar mensagem')
      }
    },
    [processId]
  )

  const toggleReaction = useCallback(
    async (messageId: string, emoji: string) => {
      const res = await fetch(
        `/api/processes/${processId}/chat/${messageId}/reactions`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ emoji }),
        }
      )
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Erro ao reagir')
      }
      fetchMessages()
    },
    [processId, fetchMessages]
  )

  const markAsRead = useCallback(
    async (messageId: string) => {
      console.log('[DEBUG markAsRead] Marking message as read:', messageId, 'for process:', processId)
      try {
        const res = await fetch(`/api/processes/${processId}/chat/read`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ last_read_message_id: messageId }),
        })
        const result = await res.json()
        console.log('[DEBUG markAsRead] POST response:', res.status, result)
        if (!res.ok) {
          console.error('[DEBUG markAsRead] POST failed:', result)
        }
      } catch (err) {
        console.error('[DEBUG markAsRead] Error:', err)
      }
    },
    [processId]
  )

  return {
    messages,
    readReceipts,
    isLoading,
    isSending,
    sendMessage,
    editMessage,
    deleteMessage,
    toggleReaction,
    markAsRead,
    refetch: fetchMessages,
  }
}
