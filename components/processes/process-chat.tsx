'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { MessageSquare } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { useChatMessages } from '@/hooks/use-chat-messages'
import { useChatPresence } from '@/hooks/use-chat-presence'
import { ChatMessageItem } from './chat-message'
import { ChatInput } from './chat-input'
import { CHAT_LABELS } from '@/lib/constants'
import type { ChatMessage, ChatReadReceipt } from '@/types/process'

interface ProcessChatProps {
  processId: string
  currentUser: { id: string; name: string; avatarUrl?: string }
}

export function ProcessChat({ processId, currentUser }: ProcessChatProps) {
  const {
    messages,
    readReceipts,
    isLoading,
    isSending,
    sendMessage,
    editMessage,
    deleteMessage,
    toggleReaction,
    markAsRead,
  } = useChatMessages(processId)

  const { onlineUsers, typingUsers, setTyping } = useChatPresence(processId, currentUser)
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  // Build a map of messageId -> readers for read receipt display
  const messageReadersMap = useMemo(() => {
    const map = new Map<string, { userName: string; readAt: string }[]>()
    if (!messages.length || !readReceipts.length) return map

    const idxMap = new Map<string, number>()
    messages.forEach((m, i) => idxMap.set(m.id, i))

    for (const receipt of readReceipts) {
      const r = receipt as ChatReadReceipt
      if (!r.last_read_message_id) continue

      const lastReadIdx = idxMap.get(r.last_read_message_id)
      if (lastReadIdx === undefined) continue

      for (let i = 0; i <= lastReadIdx; i++) {
        const msgId = messages[i].id
        // Don't show read receipt on sender's own messages
        if (messages[i].sender_id === r.user_id) continue
        const existing = map.get(msgId) || []
        existing.push({
          userName: (r.user as { commercial_name: string })?.commercial_name || 'Utilizador',
          readAt: r.last_read_at,
        })
        map.set(msgId, existing)
      }
    }

    return map
  }, [messages, readReceipts])

  // Auto-scroll when new messages arrive
  useEffect(() => {
    if (scrollRef.current && messages.length > 0) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages.length])

  // Mark last message as read when messages change
  useEffect(() => {
    if (messages.length > 0) {
      const lastMessage = messages[messages.length - 1]
      if (lastMessage.sender_id !== currentUser.id) {
        markAsRead(lastMessage.id)
      }
    }
  }, [messages, currentUser.id, markAsRead])

  const handleSend = async (content: string, mentions: { user_id: string; display_name: string }[]) => {
    const msg = await sendMessage(content, mentions, replyTo?.id)
    setReplyTo(null)
    return msg
  }

  const onlineCount = onlineUsers.filter((u) => u.user_id !== currentUser.id).length

  const typingText =
    typingUsers.length === 1
      ? `${typingUsers[0].user_name} ${CHAT_LABELS.typing_one}`
      : typingUsers.length > 1
        ? `${typingUsers.map((u) => u.user_name).join(', ')} ${CHAT_LABELS.typing_many}`
        : null

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b px-4 py-2.5 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-semibold">{CHAT_LABELS.title}</span>
          {messages.length > 0 && (
            <Badge variant="secondary" className="h-5 min-w-5 px-1.5 text-[10px] font-medium rounded-full">
              {messages.length}
            </Badge>
          )}
        </div>
        {onlineCount > 0 && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            {onlineCount} {CHAT_LABELS.online}
          </div>
        )}
      </div>

      {/* Body */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className={`flex gap-3 ${i % 2 === 0 ? '' : 'justify-end'}`}>
              {i % 2 === 0 && <Skeleton className="h-8 w-8 rounded-full shrink-0" />}
              <div className={`space-y-1 ${i % 2 === 0 ? '' : 'items-end'}`}>
                <Skeleton className="h-3 w-20" />
                <Skeleton className={`h-12 ${i % 2 === 0 ? 'w-56' : 'w-44'} rounded-2xl`} />
              </div>
              {i % 2 !== 0 && <Skeleton className="h-8 w-8 rounded-full shrink-0" />}
            </div>
          ))
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
            <MessageSquare className="h-10 w-10 mb-2 opacity-40" />
            <p className="text-sm">{CHAT_LABELS.no_messages}</p>
          </div>
        ) : (
          <>
            {messages.map((msg) => (
              <ChatMessageItem
                key={msg.id}
                message={msg}
                currentUserId={currentUser.id}
                processId={processId}
                onReply={() => setReplyTo(msg)}
                onToggleReaction={toggleReaction}
                onEdit={editMessage}
                onDelete={deleteMessage}
                readers={messageReadersMap.get(msg.id)}
              />
            ))}
          </>
        )}

        {/* Typing indicator */}
        {typingText && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="flex gap-0.5">
              <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: '300ms' }} />
            </span>
            {typingText}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="border-t px-4 py-3 shrink-0">
        <ChatInput
          processId={processId}
          onSend={handleSend}
          onTypingChange={setTyping}
          disabled={isSending}
          replyTo={
            replyTo
              ? {
                  id: replyTo.id,
                  senderName: replyTo.sender?.commercial_name || 'Utilizador',
                  content: replyTo.content,
                }
              : null
          }
          onCancelReply={() => setReplyTo(null)}
        />
      </div>
    </div>
  )
}
