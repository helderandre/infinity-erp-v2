'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { MentionsInput, Mention } from 'react-mentions'
import { Button } from '@/components/ui/button'
import { Paperclip, Send, Loader2, X } from 'lucide-react'
import { CHAT_LABELS } from '@/lib/constants'
import { toast } from 'sonner'
import type { ChatMention, ChatMessage } from '@/types/process'

interface ChatInputProps {
  processId: string
  onSend: (content: string, mentions: ChatMention[]) => Promise<ChatMessage | undefined>
  onTypingChange: (isTyping: boolean) => void
  disabled?: boolean
  replyTo?: { id: string; senderName: string; content: string } | null
  onCancelReply?: () => void
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

export function ChatInput({
  processId,
  onSend,
  onTypingChange,
  disabled = false,
  replyTo,
  onCancelReply,
}: ChatInputProps) {
  const [value, setValue] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [mentionUsers, setMentionUsers] = useState<{ id: string; display: string }[]>([])
  const [attachments, setAttachments] = useState<File[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Fetch users for mentions
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

  // Typing indicator with debounce
  const handleValueChange = useCallback(
    (newValue: string) => {
      setValue(newValue)
      if (newValue.trim()) onTypingChange(true)
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)
      typingTimeoutRef.current = setTimeout(() => onTypingChange(false), 2000)
    },
    [onTypingChange]
  )

  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)
    }
  }, [])

  const uploadAttachments = useCallback(async (messageId: string, files: File[]) => {
    for (const file of files) {
      try {
        const formData = new FormData()
        formData.append('file', file)
        formData.append('processId', processId)
        formData.append('messageId', messageId)

        const res = await fetch('/api/chat/upload', { method: 'POST', body: formData })
        if (!res.ok) {
          const err = await res.json()
          throw new Error(err.error || CHAT_LABELS.upload_error)
        }
        toast.success(`${file.name} — ${CHAT_LABELS.upload_success}`)
      } catch (err) {
        toast.error(`${file.name} — ${err instanceof Error ? err.message : CHAT_LABELS.upload_error}`)
      }
    }
  }, [processId])

  const handleSubmit = useCallback(async () => {
    if (!value.trim() || isSubmitting) return

    setIsSubmitting(true)
    onTypingChange(false)

    try {
      // Parse mentions
      const mentions: ChatMention[] = []
      const mentionRegex = /@\[([^\]]+)\]\(([^)]+)\)/g
      let match
      while ((match = mentionRegex.exec(value)) !== null) {
        mentions.push({ display_name: match[1], user_id: match[2] })
      }

      const msg = await onSend(value, mentions)

      // Upload attachments with returned message ID
      if (msg?.id && attachments.length > 0) {
        uploadAttachments(msg.id, attachments)
      }

      setValue('')
      setAttachments([])
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao enviar mensagem')
    } finally {
      setIsSubmitting(false)
    }
  }, [value, isSubmitting, onSend, onTypingChange, attachments, uploadAttachments])

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    const maxSize = 20 * 1024 * 1024
    const valid = files.filter((f) => {
      if (f.size > maxSize) {
        toast.error(`${f.name}: ${CHAT_LABELS.max_file_size}`)
        return false
      }
      return true
    })
    setAttachments((prev) => [...prev, ...valid])
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  return (
    <div className="space-y-2">
      {/* Reply preview */}
      {replyTo && (
        <div className="flex items-center gap-2 text-xs bg-muted/60 rounded-lg px-3 py-1.5 border-l-2 border-primary">
          <div className="flex-1 min-w-0">
            <span className="text-muted-foreground">{CHAT_LABELS.reply_to} </span>
            <span className="font-medium">{replyTo.senderName}</span>
            <p className="text-muted-foreground truncate mt-0.5">{replyTo.content.slice(0, 80)}</p>
          </div>
          <Button variant="ghost" size="icon" className="h-5 w-5 shrink-0" onClick={onCancelReply}>
            <X className="h-3 w-3" />
          </Button>
        </div>
      )}

      {/* Attachment previews */}
      {attachments.length > 0 && (
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

      {/* Input row */}
      <div className="flex items-end gap-2">
        <div className="flex-1 relative">
          <MentionsInput
            value={value}
            onChange={(_e, newValue) => handleValueChange(newValue)}
            placeholder={CHAT_LABELS.placeholder}
            style={mentionsInputStyle}
            a11ySuggestionsListLabel="Utilizadores sugeridos"
            forceSuggestionsAboveCursor
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleSubmit()
              }
            }}
            disabled={disabled || isSubmitting}
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

        {/* Attach button */}
        <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleFileSelect} />
        <Button
          variant="outline"
          size="sm"
          className="h-9 gap-1.5 shrink-0"
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled || isSubmitting}
        >
          <Paperclip className="h-3.5 w-3.5" />
          <span className="text-xs">{CHAT_LABELS.attach_file}</span>
        </Button>

        {/* Send button */}
        <Button
          size="sm"
          className="h-9 gap-1.5 shrink-0"
          onClick={handleSubmit}
          disabled={!value.trim() || isSubmitting || disabled}
        >
          {isSubmitting ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Send className="h-3.5 w-3.5" />
          )}
          <span className="text-xs">{CHAT_LABELS.send}</span>
        </Button>
      </div>
    </div>
  )
}
