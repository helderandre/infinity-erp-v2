'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { WppMessage, QuotedMessageMap } from '@/lib/types/whatsapp-web'

export function useWhatsAppMessages(chatId: string | null) {
  const [messages, setMessages] = useState<WppMessage[]>([])
  const [quotedMessages, setQuotedMessages] = useState<QuotedMessageMap>({})
  const [isLoading, setIsLoading] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const channelRef = useRef<ReturnType<ReturnType<typeof createClient>['channel']> | null>(null)
  const initialLoadRef = useRef(true)

  const fetchMessages = useCallback(
    async (opts?: { append?: boolean; before?: number }) => {
      if (!chatId) return

      if (!opts?.append) setIsLoading(true)
      try {
        const params = new URLSearchParams({ limit: "50" })
        if (opts?.before) params.set("before", String(opts.before))

        const res = await fetch(`/api/whatsapp/chats/${chatId}/messages?${params}`)
        if (!res.ok) throw new Error("Erro ao carregar mensagens")

        const data = await res.json()

        if (opts?.append) {
          // Prepend older messages
          setMessages((prev) => {
            const existingIds = new Set(prev.map((m) => m.id))
            const newMsgs = (data.messages as WppMessage[]).filter((m) => !existingIds.has(m.id))
            return [...newMsgs, ...prev]
          })
        } else {
          setMessages(data.messages)
        }

        // Merge quoted messages
        setQuotedMessages((prev) => ({ ...prev, ...data.quoted_messages }))
        setHasMore(data.has_more)
      } catch {
        // silently fail
      } finally {
        setIsLoading(false)
      }
    },
    [chatId]
  )

  const loadMore = useCallback(() => {
    if (!messages.length) return
    const oldest = messages[0]
    fetchMessages({ append: true, before: oldest.timestamp })
  }, [messages, fetchMessages])

  // Initial fetch + realtime subscription
  useEffect(() => {
    if (!chatId) {
      setMessages([])
      setQuotedMessages({})
      setHasMore(false)
      return
    }

    const showLoading = initialLoadRef.current
    if (showLoading) setIsLoading(true)
    fetchMessages()
    initialLoadRef.current = false

    const supabase = createClient()
    const channel = supabase
      .channel(`wpp-messages-${chatId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'wpp_messages',
          filter: `chat_id=eq.${chatId}`,
        },
        (payload) => {
          const newMsg = payload.new as WppMessage
          setMessages((prev) => {
            // Check if already exists by DB id
            if (prev.find((m) => m.id === newMsg.id)) return prev

            // Check if same wa_message_id already exists (e.g. from fetchMessages)
            if (newMsg.wa_message_id && prev.find((m) => m.wa_message_id === newMsg.wa_message_id)) return prev

            // Check if this replaces an optimistic message
            const optimisticIdx = prev.findIndex(
              (m) => m.id.startsWith('optimistic-') &&
                m.from_me === newMsg.from_me &&
                m.text === newMsg.text
            )

            if (optimisticIdx >= 0) {
              // Replace optimistic with real message
              const updated = [...prev]
              updated[optimisticIdx] = newMsg
              return updated
            }

            return [...prev, newMsg]
          })
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'wpp_messages',
          filter: `chat_id=eq.${chatId}`,
        },
        (payload) => {
          const updated = payload.new as WppMessage
          setMessages((prev) =>
            prev.map((m) => (m.id === updated.id ? { ...m, ...updated } : m))
          )
        }
      )
      .subscribe()

    channelRef.current = channel

    return () => {
      supabase.removeChannel(channel)
      channelRef.current = null
    }
  }, [chatId, fetchMessages])

  // ── Actions ──

  const sendText = useCallback(
    async (text: string, replyId?: string) => {
      if (!chatId || isSending) return
      setIsSending(true)

      // Optimistic message
      const optimistic: WppMessage = {
        id: `optimistic-${Date.now()}`,
        chat_id: chatId,
        instance_id: '',
        wa_message_id: '',
        from_me: true,
        sender: null,
        sender_name: null,
        sender_phone: null,
        text,
        message_type: 'text',
        status: 'sent',
        timestamp: Math.floor(Date.now() / 1000),
        media_url: null,
        media_mime_type: null,
        media_file_name: null,
        media_file_size: null,
        media_duration: null,
        media_thumbnail_url: null,
        quoted_message_id: replyId || null,
        is_forwarded: false,
        is_starred: false,
        is_deleted: false,
        is_edited: false,
        reactions: null,
        location_latitude: null,
        location_longitude: null,
        location_name: null,
        vcard: null,
        poll_data: null,
        event_data: null,
        raw_data: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
      setMessages((prev) => [...prev, optimistic])

      try {
        await fetch(`/api/whatsapp/chats/${chatId}/messages`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'send_text', text, reply_id: replyId }),
        })
      } finally {
        setIsSending(false)
      }
    },
    [chatId, isSending]
  )

  const sendMedia = useCallback(
    async (file: File, type: string, caption?: string, replyId?: string) => {
      if (!chatId || isSending) return
      setIsSending(true)

      try {
        // 1. Upload to R2
        const formData = new FormData()
        formData.append('file', file)
        formData.append('instance_id', chatId) // will use chat's instance_id on server
        formData.append('chat_id', chatId)

        const uploadRes = await fetch('/api/whatsapp/media/upload', {
          method: 'POST',
          body: formData,
        })

        if (!uploadRes.ok) throw new Error('Erro ao fazer upload')
        const uploadData = await uploadRes.json()

        // 2. Send via messaging (include file metadata for DB storage)
        await fetch(`/api/whatsapp/chats/${chatId}/messages`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'send_media',
            type,
            file_url: uploadData.url,
            caption,
            reply_id: replyId,
            file_name: uploadData.file_name || file.name,
            mime_type: uploadData.mime_type || file.type,
            file_size: uploadData.size || file.size,
          }),
        })
      } finally {
        setIsSending(false)
      }
    },
    [chatId, isSending]
  )

  const sendAudio = useCallback(
    async (file: File, replyId?: string) => {
      if (!chatId || isSending) return
      setIsSending(true)

      try {
        // 1. Upload to R2
        const formData = new FormData()
        formData.append('file', file)
        formData.append('instance_id', chatId)
        formData.append('chat_id', chatId)

        const uploadRes = await fetch('/api/whatsapp/media/upload', {
          method: 'POST',
          body: formData,
        })

        if (!uploadRes.ok) throw new Error('Erro ao fazer upload')
        const uploadData = await uploadRes.json()

        // 2. Send as PTT (voice note) — uses /send/ptt on UAZAPI
        await fetch(`/api/whatsapp/chats/${chatId}/messages`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'send_audio',
            file_url: uploadData.url,
            ptt: true,
            reply_id: replyId,
          }),
        })
      } finally {
        setIsSending(false)
      }
    },
    [chatId, isSending]
  )

  const sendPoll = useCallback(
    async (question: string, options: string[], selectableCount: number = 1, replyId?: string) => {
      if (!chatId || !question.trim() || options.length < 2) return
      setIsSending(true)
      try {
        const optimistic: WppMessage = {
          id: `optimistic-${Date.now()}`,
          chat_id: chatId,
          instance_id: '',
          wa_message_id: '',
          from_me: true,
          message_type: 'poll',
          text: question,
          status: 'sent',
          timestamp: Math.floor(Date.now() / 1000),
          poll_data: {
            name: question,
            options: options.map(o => ({ name: o, votes: 0 })),
            selectableCount,
          },
          sender: null, sender_name: null, sender_phone: null,
          media_url: null, media_mime_type: null, media_file_name: null,
          media_file_size: null, media_duration: null, media_thumbnail_url: null,
          quoted_message_id: replyId || null,
          is_forwarded: false, is_starred: false, is_deleted: false, is_edited: false,
          reactions: null, location_latitude: null, location_longitude: null,
          location_name: null, vcard: null, event_data: null, raw_data: null,
          created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
        }
        setMessages(prev => [...prev, optimistic])

        await fetch(`/api/whatsapp/chats/${chatId}/messages`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'send_poll',
            poll_question: question,
            poll_options: options,
            poll_selectable_count: selectableCount,
            reply_id: replyId,
          }),
        })
      } catch (err) {
        console.error('sendPoll error:', err)
      } finally {
        setIsSending(false)
      }
    },
    [chatId]
  )

  const sendContact = useCallback(
    async (contactName: string, contactPhone: string, organization?: string, email?: string, replyId?: string) => {
      if (!chatId || !contactName.trim() || !contactPhone.trim()) return
      setIsSending(true)
      try {
        const optimistic: WppMessage = {
          id: `optimistic-${Date.now()}`,
          chat_id: chatId,
          instance_id: '',
          wa_message_id: '',
          from_me: true,
          message_type: 'contact',
          text: contactName,
          status: 'sent',
          timestamp: Math.floor(Date.now() / 1000),
          vcard: [
            'BEGIN:VCARD', 'VERSION:3.0',
            `FN:${contactName}`,
            `TEL;TYPE=CELL:${contactPhone}`,
            ...(organization ? [`ORG:${organization}`] : []),
            ...(email ? [`EMAIL;TYPE=INTERNET:${email}`] : []),
            'END:VCARD',
          ].join('\n'),
          sender: null, sender_name: null, sender_phone: null,
          media_url: null, media_mime_type: null, media_file_name: null,
          media_file_size: null, media_duration: null, media_thumbnail_url: null,
          quoted_message_id: replyId || null,
          is_forwarded: false, is_starred: false, is_deleted: false, is_edited: false,
          reactions: null, poll_data: null, event_data: null,
          location_latitude: null, location_longitude: null, location_name: null,
          raw_data: null,
          created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
        }
        setMessages(prev => [...prev, optimistic])

        await fetch(`/api/whatsapp/chats/${chatId}/messages`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'send_contact',
            contact_name: contactName,
            contact_phone: contactPhone,
            organization,
            email,
          }),
        })
      } catch (err) {
        console.error('sendContact error:', err)
      } finally {
        setIsSending(false)
      }
    },
    [chatId]
  )

  const react = useCallback(
    async (messageId: string, emoji: string) => {
      await fetch(`/api/whatsapp/messages/${messageId}/react`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emoji }),
      })
    },
    []
  )

  const deleteMessage = useCallback(
    async (messageId: string, forEveryone?: boolean) => {
      // Optimistic
      setMessages((prev) =>
        prev.map((m) => (m.id === messageId ? { ...m, is_deleted: true } : m))
      )

      await fetch(`/api/whatsapp/messages/${messageId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ for_everyone: forEveryone }),
      })
    },
    []
  )

  const markRead = useCallback(async () => {
    if (!chatId) return
    await fetch(`/api/whatsapp/chats/${chatId}/read`, { method: 'POST' })
  }, [chatId])

  return {
    messages,
    quotedMessages,
    isLoading,
    isSending,
    hasMore,
    loadMore,
    sendText,
    sendMedia,
    sendAudio,
    sendPoll,
    sendContact,
    react,
    deleteMessage,
    markRead,
    refetch: fetchMessages,
  }
}
