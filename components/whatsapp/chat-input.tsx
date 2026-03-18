'use client'

import { useState, useRef, useCallback, KeyboardEvent } from 'react'
import { Send, Paperclip, Smile, X, Image, Video, FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { EmojiPicker } from './emoji-picker'
import type { WppMessage } from '@/lib/types/whatsapp-web'

interface ChatInputProps {
  onSendText: (text: string) => void
  onSendMedia: (file: File, type: string, caption?: string) => void
  onSendPresence: () => void
  replyTo?: WppMessage | null
  onCancelReply?: () => void
  disabled?: boolean
}

export function ChatInput({
  onSendText,
  onSendMedia,
  onSendPresence,
  replyTo,
  onCancelReply,
  disabled,
}: ChatInputProps) {
  const [text, setText] = useState('')
  const [pendingFile, setPendingFile] = useState<{ file: File; type: string } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const presenceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleSend = useCallback(() => {
    const trimmed = text.trim()
    if (pendingFile) {
      onSendMedia(pendingFile.file, pendingFile.type, trimmed || undefined)
      setPendingFile(null)
      setText('')
      onCancelReply?.()
      return
    }
    if (!trimmed) return
    onSendText(trimmed)
    setText('')
    onCancelReply?.()
  }, [text, pendingFile, onSendText, onSendMedia, onCancelReply])

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleTextChange = (value: string) => {
    setText(value)
    // Send composing presence with debounce
    if (presenceTimeoutRef.current) clearTimeout(presenceTimeoutRef.current)
    onSendPresence()
    presenceTimeoutRef.current = setTimeout(() => {
      // Presence will auto-clear server-side
    }, 2000)
  }

  const handleFileSelect = (accept: string, type: string) => {
    if (fileInputRef.current) {
      fileInputRef.current.accept = accept
      fileInputRef.current.dataset.mediaType = type
      fileInputRef.current.click()
    }
  }

  const handleFileChange = () => {
    const input = fileInputRef.current
    if (!input?.files?.[0]) return
    const file = input.files[0]
    const type = input.dataset.mediaType || 'document'
    setPendingFile({ file, type })
    input.value = ''
  }

  const handleEmojiSelect = (emoji: string) => {
    setText((prev) => prev + emoji)
    textareaRef.current?.focus()
  }

  const hasContent = text.trim().length > 0 || pendingFile

  return (
    <div className="border-t bg-background">
      {/* Reply preview */}
      {replyTo && (
        <div className="flex items-center gap-2 px-4 py-2 border-b bg-muted/30">
          <div className="flex-1 min-w-0 border-l-2 border-primary pl-2">
            <div className="text-xs font-medium text-primary">
              {replyTo.from_me ? 'Você' : replyTo.sender_name || 'Contacto'}
            </div>
            <div className="text-xs text-muted-foreground truncate">
              {replyTo.text || replyTo.message_type}
            </div>
          </div>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onCancelReply}>
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}

      {/* File preview */}
      {pendingFile && (
        <div className="flex items-center gap-2 px-4 py-2 border-b bg-muted/30">
          <FileText className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm truncate flex-1">{pendingFile.file.name}</span>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setPendingFile(null)}>
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}

      {/* Input area */}
      <div className="flex items-end gap-2 px-3 py-2">
        <EmojiPicker onSelect={handleEmojiSelect} />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-9 w-9 flex-shrink-0">
              <Paperclip className="h-4.5 w-4.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" side="top">
            <DropdownMenuItem onClick={() => handleFileSelect('image/*', 'image')}>
              <Image className="mr-2 h-4 w-4" />
              Imagem
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleFileSelect('video/*', 'video')}>
              <Video className="mr-2 h-4 w-4" />
              Vídeo
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleFileSelect('.pdf,.doc,.docx,.xls,.xlsx', 'document')}>
              <FileText className="mr-2 h-4 w-4" />
              Documento
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={handleFileChange}
        />

        <Textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => handleTextChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Escreva uma mensagem..."
          className="min-h-[40px] max-h-[120px] resize-none flex-1"
          rows={1}
          disabled={disabled}
        />

        <Button
          variant="ghost"
          size="icon"
          className={`h-9 w-9 flex-shrink-0 ${hasContent ? 'text-emerald-600 hover:text-emerald-700' : ''}`}
          onClick={handleSend}
          disabled={disabled || !hasContent}
        >
          <Send className="h-4.5 w-4.5" />
        </Button>
      </div>
    </div>
  )
}
