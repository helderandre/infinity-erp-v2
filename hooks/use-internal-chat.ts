'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { INTERNAL_CHAT_CHANNEL_ID } from '@/lib/constants'
import type { InternalChatMessage, InternalChatMention, InternalChatReadReceipt } from '@/types/internal-chat'

const API_BASE = '/api/chat/internal'

export function useInternalChat(channelId?: string) {
  const activeChannelId = channelId || INTERNAL_CHAT_CHANNEL_ID
  const [messages, setMessages] = useState<InternalChatMessage[]>([])
  const [readReceipts, setReadReceipts] = useState<InternalChatReadReceipt[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const channelRef = useRef<ReturnType<ReturnType<typeof createClient>['channel']> | null>(null)
  const prevChannelIdRef = useRef<string | null>(null)

  const channelParam = `channelId=${activeChannelId}`

  const upsertMessage = useCallback((message: InternalChatMessage) => {
    setMessages((prev) => {
      const existingIndex = prev.findIndex((m) => m.id === message.id)
      if (existingIndex >= 0) {
        const next = [...prev]
        next[existingIndex] = message
        return next
      }
      const next = [...prev, message]
      next.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
      return next
    })
  }, [])

  const fetchMessageById = useCallback(async (messageId: string) => {
    try {
      const res = await fetch(`${API_BASE}/${messageId}`)
      if (!res.ok) return
      const data = await res.json()
      upsertMessage(data)
    } catch {
      // silently fail
    }
  }, [upsertMessage])

  const fetchMessages = useCallback(async (options?: { showLoading?: boolean }) => {
    const showLoading = options?.showLoading ?? false
    if (showLoading) setIsLoading(true)
    try {
      const res = await fetch(`${API_BASE}?${channelParam}`)
      if (!res.ok) throw new Error('Erro ao carregar mensagens')
      const data = await res.json()
      setMessages(data)
    } catch {
      // silently fail
    } finally {
      if (showLoading) setIsLoading(false)
    }
  }, [channelParam])

  const fetchReadReceipts = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/read?${channelParam}`)
      if (!res.ok) return
      const data = await res.json()
      setReadReceipts(data)
    } catch {
      // silently fail
    }
  }, [channelParam])

  const sendMessage = useCallback(async (content: string, mentions: InternalChatMention[], parentMessageId?: string | null) => {
    setIsSending(true)
    try {
      const res = await fetch(API_BASE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content,
          mentions,
          parent_message_id: parentMessageId || null,
          channel_id: activeChannelId,
        }),
      })
      if (!res.ok) throw new Error('Erro ao enviar mensagem')
      const message = await res.json()
      upsertMessage(message)
      return message as InternalChatMessage
    } catch {
      return undefined
    } finally {
      setIsSending(false)
    }
  }, [upsertMessage, activeChannelId])

  const editMessage = useCallback(async (messageId: string, content: string) => {
    try {
      const res = await fetch(`${API_BASE}/${messageId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      })
      if (!res.ok) throw new Error('Erro ao editar')
      const updated = await res.json()
      upsertMessage(updated)
    } catch {
      // silently fail
    }
  }, [upsertMessage])

  const deleteMessage = useCallback(async (messageId: string) => {
    try {
      const res = await fetch(`${API_BASE}/${messageId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Erro ao eliminar')
      setMessages((prev) =>
        prev.map((m) =>
          m.id === messageId
            ? { ...m, is_deleted: true, deleted_at: new Date().toISOString(), content: '' }
            : m
        )
      )
    } catch {
      // silently fail
    }
  }, [])

  const toggleReaction = useCallback(async (messageId: string, emoji: string) => {
    try {
      const res = await fetch(`${API_BASE}/${messageId}/reactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emoji }),
      })
      if (!res.ok) throw new Error('Erro na reação')
      await fetchMessageById(messageId)
    } catch {
      // silently fail
    }
  }, [fetchMessageById])

  const markAsRead = useCallback(async (lastMessageId: string) => {
    try {
      await fetch(`${API_BASE}/read`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          last_read_message_id: lastMessageId,
          channel_id: activeChannelId,
        }),
      })
    } catch {
      // silently fail
    }
  }, [activeChannelId])

  // Realtime subscription
  useEffect(() => {
    const supabase = createClient()

    const channel = supabase
      .channel(`internal-chat-${activeChannelId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'internal_chat_messages',
          filter: `channel_id=eq.${activeChannelId}`,
        },
        (payload) => {
          fetchMessageById(payload.new.id)
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'internal_chat_messages',
          filter: `channel_id=eq.${activeChannelId}`,
        },
        (payload) => {
          fetchMessageById(payload.new.id)
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'internal_chat_reactions',
        },
        (payload) => {
          const messageId = (payload.new as any)?.message_id || (payload.old as any)?.message_id
          if (messageId) fetchMessageById(messageId)
        }
      )
      .subscribe()

    channelRef.current = channel

    return () => {
      supabase.removeChannel(channel)
    }
  }, [fetchMessageById, activeChannelId])

  // Load on channel change
  useEffect(() => {
    if (prevChannelIdRef.current !== activeChannelId) {
      prevChannelIdRef.current = activeChannelId
      setMessages([])
      fetchMessages({ showLoading: true })
      fetchReadReceipts()
    }
  }, [activeChannelId, fetchMessages, fetchReadReceipts])

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
