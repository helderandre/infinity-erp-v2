'use client'

import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { MentionsInput, Mention } from 'react-mentions'
import { MessageSquare, Paperclip, Send, X, Mic } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Spinner } from '@/components/kibo-ui/spinner'
import { toast } from 'sonner'
import { useInternalChat } from '@/hooks/use-internal-chat'
import { useInternalChatPresence } from '@/hooks/use-internal-chat-presence'
import { ChatMessageItem } from '@/components/processes/chat-message'
import { VoiceRecorder } from '@/components/processes/voice-recorder'
import { CHAT_LABELS, VOICE_LABELS } from '@/lib/constants'
import type { InternalChatMessage, InternalChatMention, InternalChatReadReceipt } from '@/types/internal-chat'

const INTERNAL_CHAT_LABELS = {
  ...CHAT_LABELS,
  title: 'Grupo Geral',
  no_messages: 'Sem mensagens ainda — comece a conversa!',
  placeholder: 'Escrever mensagem... @ mencionar',
}

const mentionsInputStyle = {
  control: { fontSize: 14, fontWeight: 'normal' as const },
  '&multiLine': {
    control: { minHeight: 40 },
    highlighter: { padding: 9, border: '1px solid transparent' },
    input: {
      padding: 9,
      border: '1px solid hsl(var(--border))',
      borderRadius: 8,
      outline: 'none',
    },
  },
  suggestions: {
    list: {
      backgroundColor: 'hsl(var(--popover))',
      border: '1px solid hsl(var(--border))',
      borderRadius: 8,
      boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
      overflow: 'hidden',
      maxHeight: 200,
      overflowY: 'auto' as const,
    },
    item: {
      '&focused': { backgroundColor: 'hsl(var(--muted))' },
    },
  },
}

const mentionStyle = {
  backgroundColor: 'hsl(var(--primary) / 0.1)',
  borderRadius: 4,
  padding: '1px 2px',
}

interface InternalChatPanelProps {
  currentUser: { id: string; name: string; avatarUrl?: string }
  channelId?: string
  header?: React.ReactNode
}

export function InternalChatPanel({ currentUser, channelId, header }: InternalChatPanelProps) {
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
  } = useInternalChat(channelId)

  const { onlineUsers, typingUsers, setTyping } = useInternalChatPresence(currentUser)

  const [replyTo, setReplyTo] = useState<InternalChatMessage | null>(null)
  const [value, setValue] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [mentionUsers, setMentionUsers] = useState<{ id: string; display: string }[]>([])
  const [attachments, setAttachments] = useState<File[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const firstRenderRef = useRef(true)

  // Fetch users for @ mentions
  useEffect(() => {
    const loadUsers = async () => {
      try {
        const res = await fetch('/api/users/consultants')
        if (!res.ok) return
        const data: { id: string; commercial_name: string }[] = await res.json()
        setMentionUsers(data.map((u) => ({ id: u.id, display: u.commercial_name })))
      } catch {
        // silent
      }
    }
    loadUsers()
  }, [])

  // Build readers map from read receipts
  const messageReadersMap = useMemo(() => {
    const map = new Map<string, { userName: string; readAt: string }[]>()
    if (!messages.length || !readReceipts.length) return map

    const idxMap = new Map<string, number>()
    messages.forEach((m, i) => idxMap.set(m.id, i))

    for (const receipt of readReceipts) {
      const r = receipt as InternalChatReadReceipt
      if (!r.last_read_message_id) continue
      const lastReadIdx = idxMap.get(r.last_read_message_id)
      if (lastReadIdx === undefined) continue

      for (let i = 0; i <= lastReadIdx; i++) {
        const msgId = messages[i].id
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

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current && messages.length > 0) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: firstRenderRef.current ? 'auto' : 'smooth',
      })
      firstRenderRef.current = false
    }
  }, [messages.length])

  // Mark as read
  useEffect(() => {
    if (messages.length > 0) {
      const lastMessage = messages[messages.length - 1]
      if (lastMessage.sender_id !== currentUser.id) {
        markAsRead(lastMessage.id)
      }
    }
  }, [messages, currentUser.id, markAsRead])

  // Typing
  const handleValueChange = useCallback(
    (newValue: string) => {
      setValue(newValue)
      if (newValue.trim()) setTyping(true)
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)
      typingTimeoutRef.current = setTimeout(() => setTyping(false), 2000)
    },
    [setTyping]
  )

  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)
    }
  }, [])

  // Upload
  const uploadAttachments = useCallback(async (messageId: string, files: File[]) => {
    for (const file of files) {
      try {
        const formData = new FormData()
        formData.append('file', file)
        formData.append('messageId', messageId)

        const res = await fetch('/api/chat/internal/upload', { method: 'POST', body: formData })
        if (!res.ok) {
          const err = await res.json()
          throw new Error(err.error || INTERNAL_CHAT_LABELS.upload_error)
        }
        toast.success(`${file.name} — ${INTERNAL_CHAT_LABELS.upload_success}`)
      } catch (err) {
        toast.error(`${file.name} — ${err instanceof Error ? err.message : INTERNAL_CHAT_LABELS.upload_error}`)
      }
    }
  }, [])

  // Submit
  const handleSubmit = useCallback(async () => {
    if (!value.trim() || isSubmitting) return
    setIsSubmitting(true)
    setTyping(false)

    try {
      const mentions: InternalChatMention[] = []
      const mentionRegex = /@\[([^\]]+)\]\(([^)]+)\)/g
      let match
      while ((match = mentionRegex.exec(value)) !== null) {
        mentions.push({ display_name: match[1], user_id: match[2] })
      }

      const msg = await sendMessage(value, mentions, replyTo?.id)

      if (msg?.id && attachments.length > 0) {
        uploadAttachments(msg.id, attachments)
      }

      setValue('')
      setAttachments([])
      setReplyTo(null)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao enviar mensagem')
    } finally {
      setIsSubmitting(false)
    }
  }, [value, isSubmitting, sendMessage, setTyping, replyTo, attachments, uploadAttachments])

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    const maxSize = 20 * 1024 * 1024
    const valid = files.filter((f) => {
      if (f.size > maxSize) {
        toast.error(`${f.name}: ${INTERNAL_CHAT_LABELS.max_file_size}`)
        return false
      }
      return true
    })
    setAttachments((prev) => [...prev, ...valid])
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleVoiceSend = useCallback(async (audioBlob: Blob, durationMs: number) => {
    try {
      const durationSec = Math.ceil(durationMs / 1000)
      const minutes = Math.floor(durationSec / 60)
      const seconds = durationSec % 60
      const durationLabel = `${minutes}:${seconds.toString().padStart(2, '0')}`

      const msg = await sendMessage(`🎤 ${VOICE_LABELS.voice_message} (${durationLabel})`, [])
      if (!msg?.id) throw new Error('Mensagem não criada')

      const ext = audioBlob.type.includes('webm') ? 'webm' : 'ogg'
      const file = new File([audioBlob], `voice-message-${Date.now()}.${ext}`, {
        type: audioBlob.type,
      })

      const formData = new FormData()
      formData.append('file', file)
      formData.append('messageId', msg.id)

      const res = await fetch('/api/chat/internal/upload', { method: 'POST', body: formData })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || VOICE_LABELS.error)
      }

      toast.success(VOICE_LABELS.sent)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : VOICE_LABELS.error)
    }
  }, [sendMessage])

  const onlineCount = onlineUsers.filter((u) => u.user_id !== currentUser.id).length

  const typingText =
    typingUsers.length === 1
      ? `${typingUsers[0].user_name} ${INTERNAL_CHAT_LABELS.typing_one}`
      : typingUsers.length > 1
        ? `${typingUsers.map((u) => u.user_name).join(', ')} ${INTERNAL_CHAT_LABELS.typing_many}`
        : null

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      {header || (
        <div className="border-b px-4 py-2.5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-semibold">{INTERNAL_CHAT_LABELS.title}</span>
            {messages.length > 0 && (
              <Badge variant="secondary" className="h-5 min-w-5 px-1.5 text-[10px] font-medium rounded-full">
                {messages.length}
              </Badge>
            )}
          </div>
          {onlineCount > 0 && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              {onlineCount} {INTERNAL_CHAT_LABELS.online}
            </div>
          )}
        </div>
      )}

      {/* Messages */}
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
            <p className="text-sm">{INTERNAL_CHAT_LABELS.no_messages}</p>
          </div>
        ) : (
          <>
            {messages.map((msg) => (
              <ChatMessageItem
                key={msg.id}
                message={msg as any}
                currentUserId={currentUser.id}
                processId=""
                onReply={() => setReplyTo(msg)}
                onToggleReaction={toggleReaction}
                onEdit={editMessage}
                onDelete={deleteMessage}
                readers={messageReadersMap.get(msg.id)}
              />
            ))}
          </>
        )}

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

      {/* Input */}
      <div className="border-t px-4 py-3 shrink-0">
        <div className="space-y-2">
          {replyTo && (
            <div className="flex items-center gap-2 text-xs bg-muted/60 rounded-lg px-3 py-1.5 border-l-2 border-primary">
              <div className="flex-1 min-w-0">
                <span className="text-muted-foreground">{INTERNAL_CHAT_LABELS.reply_to} </span>
                <span className="font-medium">{replyTo.sender?.commercial_name || 'Utilizador'}</span>
                <p className="text-muted-foreground truncate mt-0.5">{replyTo.content.slice(0, 80)}</p>
              </div>
              <Button variant="ghost" size="icon" className="h-5 w-5 shrink-0" onClick={() => setReplyTo(null)}>
                <X className="h-3 w-3" />
              </Button>
            </div>
          )}

          {!isRecording && attachments.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {attachments.map((file, i) => (
                <div key={i} className="flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs bg-muted/50">
                  <Paperclip className="h-3 w-3 text-muted-foreground" />
                  <span className="truncate max-w-[140px]">{file.name}</span>
                  <Button variant="ghost" size="icon" className="h-4 w-4 p-0" onClick={() => setAttachments((prev) => prev.filter((_, idx) => idx !== i))}>
                    <X className="h-2.5 w-2.5" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          {isRecording && (
            <VoiceRecorder
              autoStart
              onSend={handleVoiceSend}
              onCancel={() => setIsRecording(false)}
              disabled={isSending}
            />
          )}

          {!isRecording && (
            <div className="flex items-end gap-2">
              <div className="flex-1 relative">
                <MentionsInput
                  value={value}
                  onChange={(_e, newValue) => handleValueChange(newValue)}
                  placeholder={INTERNAL_CHAT_LABELS.placeholder}
                  style={mentionsInputStyle}
                  a11ySuggestionsListLabel="Utilizadores sugeridos"
                  forceSuggestionsAboveCursor
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      handleSubmit()
                    }
                  }}
                  disabled={isSending || isSubmitting}
                >
                  <Mention
                    trigger="@"
                    data={mentionUsers}
                    markup="@[__display__](__id__)"
                    displayTransform={(_id, display) => `@${display}`}
                    style={mentionStyle}
                    renderSuggestion={(suggestion, _search, highlightedDisplay) => (
                      <div className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-muted">
                        <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-medium">
                          {(suggestion as { display?: string }).display?.[0]?.toUpperCase()}
                        </div>
                        <span className="text-sm">{highlightedDisplay}</span>
                      </div>
                    )}
                  />
                </MentionsInput>
              </div>

              <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleFileSelect} />
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 shrink-0 text-muted-foreground"
                onClick={() => fileInputRef.current?.click()}
                disabled={isSending || isSubmitting}
                title={INTERNAL_CHAT_LABELS.attach_file}
              >
                <Paperclip className="h-4 w-4" />
              </Button>

              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 shrink-0 text-muted-foreground"
                onClick={() => setIsRecording(true)}
                disabled={isSending || isSubmitting}
                title={VOICE_LABELS.record}
              >
                <Mic className="h-4 w-4" />
              </Button>

              <Button
                size="icon"
                className="h-9 w-9 shrink-0"
                onClick={handleSubmit}
                disabled={!value.trim() || isSubmitting || isSending}
                title={INTERNAL_CHAT_LABELS.send}
              >
                {isSubmitting ? (
                  <Spinner variant="infinite" size={14} />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
