'use client'

import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import { isToday, isYesterday, format, isSameDay } from 'date-fns'
import { pt } from 'date-fns/locale'
import { Skeleton } from '@/components/ui/skeleton'
import { useWhatsAppMessages } from '@/hooks/use-whatsapp-messages'
import { useWhatsAppPresence } from '@/hooks/use-whatsapp-presence'
import { useUser } from '@/hooks/use-user'
import { ADMIN_ROLES } from '@/lib/auth/roles'
import { ChatHeader } from './chat-header'
import { ChatInput } from './chat-input'
import { MessageBubble } from './message-bubble'
import { TypingIndicator } from './typing-indicator'
import type { WppChat, WppMessage } from '@/lib/types/whatsapp-web'

interface ChatThreadProps {
  chatId: string
  instanceId: string
  onToggleInfo: () => void
}

function formatDateSeparator(ts: number): string {
  const date = new Date(ts * 1000)
  if (isToday(date)) return 'Hoje'
  if (isYesterday(date)) return 'Ontem'
  return format(date, "d 'de' MMMM 'de' yyyy", { locale: pt })
}

export function ChatThread({ chatId, instanceId, onToggleInfo }: ChatThreadProps) {
  const {
    messages,
    quotedMessages,
    isLoading,
    isSending,
    hasMore,
    loadMore,
    sendText,
    sendMedia,
    react,
    deleteMessage,
    markRead,
  } = useWhatsAppMessages(chatId)

  const { isTyping, sendPresence } = useWhatsAppPresence(instanceId)
  const { user } = useUser()
  const isAdmin = useMemo(
    () => ADMIN_ROLES.some((r) => r.toLowerCase() === user?.role?.name?.toLowerCase()),
    [user?.role?.name]
  )
  const [replyTo, setReplyTo] = useState<WppMessage | null>(null)
  const [chat, setChat] = useState<WppChat | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const isAtBottomRef = useRef(true)

  // Fetch chat info
  useEffect(() => {
    if (!chatId) return
    fetch(`/api/whatsapp/chats?instance_id=${instanceId}&limit=1`)
      .then((r) => r.json())
      .then((data) => {
        const found = data.chats?.find((c: WppChat) => c.id === chatId)
        if (found) setChat(found)
      })
      .catch(() => {})
  }, [chatId, instanceId])

  // Mark as read on open
  useEffect(() => {
    markRead()
  }, [chatId, markRead])

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (isAtBottomRef.current && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages])

  // Initial scroll to bottom
  useEffect(() => {
    if (!isLoading && bottomRef.current) {
      bottomRef.current.scrollIntoView()
    }
  }, [isLoading, chatId])

  const handleScroll = useCallback(() => {
    const el = scrollRef.current
    if (!el) return

    // Check if at bottom
    isAtBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 50

    // Load more when scrolled to top
    if (el.scrollTop < 100 && hasMore && !isLoading) {
      loadMore()
    }
  }, [hasMore, isLoading, loadMore])

  const handleSendPresence = useCallback(() => {
    sendPresence(chatId, 'composing')
  }, [chatId, sendPresence])

  // Group messages by date
  const groupedMessages: { date: string; messages: WppMessage[] }[] = []
  let currentGroup: { date: string; messages: WppMessage[] } | null = null

  for (const msg of messages) {
    const msgDate = new Date(msg.timestamp * 1000)
    if (!currentGroup || !isSameDay(msgDate, new Date(currentGroup.messages[0].timestamp * 1000))) {
      currentGroup = { date: formatDateSeparator(msg.timestamp), messages: [] }
      groupedMessages.push(currentGroup)
    }
    currentGroup.messages.push(msg)
  }

  const chatTyping = isTyping(chatId)

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <ChatHeader
        chat={chat}
        isTyping={chatTyping}
        onToggleInfo={onToggleInfo}
      />

      {/* Messages */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-4 py-2 bg-muted/30"
      >
        {isLoading ? (
          <div className="space-y-4 py-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className={`flex ${i % 2 === 0 ? 'justify-start' : 'justify-end'}`}>
                <Skeleton className="h-12 w-48 rounded-lg" />
              </div>
            ))}
          </div>
        ) : (
          <>
            {hasMore && (
              <div className="text-center py-2">
                <button
                  type="button"
                  onClick={loadMore}
                  className="text-xs text-primary hover:underline"
                >
                  Carregar mensagens anteriores
                </button>
              </div>
            )}

            {groupedMessages.map((group) => (
              <div key={group.date}>
                {/* Date Separator */}
                <div className="flex items-center justify-center my-3">
                  <span className="bg-background/80 backdrop-blur-sm text-xs text-muted-foreground px-3 py-1 rounded-full shadow-sm">
                    {group.date}
                  </span>
                </div>

                {group.messages.map((msg) => (
                  <MessageBubble
                    key={msg.id}
                    message={msg}
                    quotedMessage={msg.quoted_message_id ? quotedMessages[msg.quoted_message_id] : undefined}
                    onReply={() => setReplyTo(msg)}
                    onReact={(emoji) => react(msg.id, emoji)}
                    onDelete={(forEveryone) => deleteMessage(msg.id, forEveryone)}
                    onForward={() => {/* TODO: forward dialog */}}
                    showSenderName={chat?.is_group}
                    isAdmin={isAdmin}
                  />
                ))}
              </div>
            ))}

            {chatTyping && (
              <div className="flex justify-start mb-2">
                <TypingIndicator />
              </div>
            )}

            <div ref={bottomRef} />
          </>
        )}
      </div>

      {/* Input */}
      <ChatInput
        onSendText={(text) => sendText(text, replyTo?.wa_message_id)}
        onSendMedia={(file, type, caption) => sendMedia(file, type, caption, replyTo?.wa_message_id)}
        onSendPresence={handleSendPresence}
        replyTo={replyTo}
        onCancelReply={() => setReplyTo(null)}
        disabled={isSending}
      />
    </div>
  )
}
