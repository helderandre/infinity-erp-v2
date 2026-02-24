'use client'

import React, { useState } from 'react'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Reply, Smile, Pencil, Trash2, X, Check, Loader2, Eye } from 'lucide-react'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { format } from 'date-fns'
import { pt } from 'date-fns/locale'
import { CHAT_LABELS, CHAT_EMOJI_QUICK } from '@/lib/constants'
import { ChatAttachment } from './chat-attachment'
import { ChatReactions } from './chat-reactions'
import type { ChatMessage as ChatMessageType } from '@/types/process'
import { toast } from 'sonner'

interface ChatMessageProps {
  message: ChatMessageType
  currentUserId: string
  processId: string
  onReply: () => void
  onToggleReaction: (messageId: string, emoji: string) => void
  onEdit: (messageId: string, content: string) => Promise<void>
  onDelete: (messageId: string) => Promise<void>
  readers?: { userName: string; readAt: string }[]
}

function renderMessageContent(content: string, isOwn: boolean): React.ReactNode {
  const parts = content.split(/(@\[[^\]]+\]\([^)]+\))/)
  return parts.map((part, i) => {
    const match = part.match(/@\[([^\]]+)\]\(([^)]+)\)/)
    if (match) {
      return (
        <span
          key={i}
          className={`font-semibold ${isOwn ? 'text-primary-foreground underline decoration-primary-foreground/40' : 'text-primary'}`}
        >
          @{match[1]}
        </span>
      )
    }
    return part
  })
}

export function ChatMessageItem({
  message,
  currentUserId,
  onReply,
  onToggleReaction,
  onEdit,
  onDelete,
  readers,
}: ChatMessageProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState(message.content)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [emojiPopoverOpen, setEmojiPopoverOpen] = useState(false)

  const isOwn = message.sender_id === currentUserId
  const timeStr = format(new Date(message.created_at), 'HH:mm')

  if (message.is_deleted) {
    return (
      <div className="flex justify-center py-1">
        <p className="text-xs text-muted-foreground italic bg-muted/50 rounded-full px-3 py-1">
          {CHAT_LABELS.deleted_message}
        </p>
      </div>
    )
  }

  const handleSaveEdit = async () => {
    if (!editValue.trim() || isSubmitting) return
    setIsSubmitting(true)
    try {
      await onEdit(message.id, editValue)
      setIsEditing(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao editar')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async () => {
    setIsSubmitting(true)
    try {
      await onDelete(message.id)
      setDeleteDialogOpen(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao eliminar')
    } finally {
      setIsSubmitting(false)
    }
  }

  const hasParentMessage = message.parent_message && !Array.isArray(message.parent_message) && message.parent_message.content

  const parentContentPreview = hasParentMessage
    ? message.parent_message!.content.length > 10
      ? message.parent_message!.content.slice(0, 10) + '…'
      : message.parent_message!.content
    : ''

  const readReceiptEl = readers && readers.length > 0
    ? <ReadReceiptIndicator readers={readers} />
    : null

  // ── Own message (right-aligned) ──
  if (isOwn) {
    return (
      <>
        <div className="flex justify-end gap-2 group">
          <div className="max-w-[75%] min-w-[120px]">
            {/* Meta line + reactions */}
            <div className="flex items-center justify-end gap-2 mb-0.5 flex-wrap">
              {message.reactions && message.reactions.length > 0 && (
                <ChatReactions
                  reactions={message.reactions}
                  currentUserId={currentUserId}
                  onToggle={(emoji) => onToggleReaction(message.id, emoji)}
                  inline
                />
              )}
              <span className="text-[10px] text-muted-foreground">{timeStr}</span>
              <span className="text-[10px] font-semibold text-muted-foreground">Você</span>
            </div>

            {/* Bubble row: eye (left) + bubble */}
            <div className="flex items-end gap-1.5 justify-end">
              {readReceiptEl}
              <div className="bg-primary text-primary-foreground rounded-2xl rounded-tr-sm px-3.5 py-2.5 min-w-0">
                {/* Reply quote */}
                {hasParentMessage && (
                  <div className="bg-primary-foreground/15 rounded-lg px-2.5 py-1.5 mb-1.5 border-l-2 border-primary-foreground/40">
                    <span className="text-[11px] font-semibold">
                      {message.parent_message!.sender?.commercial_name || 'Utilizador'}
                    </span>
                    <span className="text-[11px] opacity-80 ml-1.5">
                      {parentContentPreview}
                    </span>
                  </div>
                )}

                {/* Content / Edit mode */}
                {isEditing ? (
                  <div className="flex items-center gap-2">
                    <Input
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSaveEdit() }
                        if (e.key === 'Escape') { setIsEditing(false); setEditValue(message.content) }
                      }}
                      className="h-7 text-sm bg-primary-foreground/20 border-primary-foreground/30 text-primary-foreground placeholder:text-primary-foreground/50"
                      autoFocus
                    />
                    <Button size="icon" variant="ghost" className="h-6 w-6 text-primary-foreground hover:bg-primary-foreground/20" onClick={handleSaveEdit} disabled={isSubmitting}>
                      {isSubmitting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                    </Button>
                    <Button size="icon" variant="ghost" className="h-6 w-6 text-primary-foreground hover:bg-primary-foreground/20" onClick={() => { setIsEditing(false); setEditValue(message.content) }}>
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ) : (
                  <p className="text-sm whitespace-pre-wrap break-words">
                    {renderMessageContent(message.content, true)}
                    {message.is_edited && (
                      <span className="text-[10px] opacity-60 ml-1">{CHAT_LABELS.edited}</span>
                    )}
                  </p>
                )}

                {/* Attachments */}
                {message.attachments && message.attachments.length > 0 && (
                  <div className="mt-1.5 space-y-1">
                    {message.attachments.map((att) => (
                      <ChatAttachment key={att.id} attachment={att} />
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Hover actions — horizontal below bubble */}
            <div className="flex items-center justify-end gap-0 mt-0.5 min-h-[20px]">
              <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0">
                <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-foreground" onClick={onReply} title="Responder">
                  <Reply className="h-3.5 w-3.5" />
                </Button>
                <Popover open={emojiPopoverOpen} onOpenChange={setEmojiPopoverOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-foreground" title="Reagir">
                      <Smile className="h-3.5 w-3.5" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-1.5" align="end" side="top">
                    <div className="flex gap-0.5">
                      {CHAT_EMOJI_QUICK.map((emoji) => (
                        <Button key={emoji} variant="ghost" size="sm" className="h-7 w-7 p-0 text-base" onClick={() => { onToggleReaction(message.id, emoji); setEmojiPopoverOpen(false) }}>
                          {emoji}
                        </Button>
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>
                <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-foreground" onClick={() => { setEditValue(message.content); setIsEditing(true) }} title={CHAT_LABELS.edit_message}>
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive/70 hover:text-destructive" onClick={() => setDeleteDialogOpen(true)} title={CHAT_LABELS.delete_message}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

          </div>

          {/* Avatar */}
          <Avatar className="h-8 w-8 shrink-0 mt-5">
            {message.sender?.profile?.profile_photo_url && (
              <AvatarImage src={message.sender.profile.profile_photo_url} alt="" />
            )}
            <AvatarFallback className="text-xs bg-primary/20 text-primary">
              {message.sender?.commercial_name?.[0]?.toUpperCase() || '?'}
            </AvatarFallback>
          </Avatar>
        </div>

        {/* Delete confirmation */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{CHAT_LABELS.delete_message}</AlertDialogTitle>
              <AlertDialogDescription>{CHAT_LABELS.delete_confirm}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isSubmitting}>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete} disabled={isSubmitting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Eliminar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </>
    )
  }

  // ── Other's message (left-aligned) ──
  return (
    <>
      <div className="flex gap-2 group">
        {/* Avatar */}
        <Avatar className="h-8 w-8 shrink-0 mt-5">
          {message.sender?.profile?.profile_photo_url && (
            <AvatarImage src={message.sender.profile.profile_photo_url} alt="" />
          )}
          <AvatarFallback className="text-xs">
            {message.sender?.commercial_name?.[0]?.toUpperCase() || '?'}
          </AvatarFallback>
        </Avatar>

        <div className="max-w-[75%] min-w-[120px]">
          {/* Meta line + reactions */}
          <div className="flex items-center gap-2 mb-0.5 flex-wrap">
            <span className="text-[11px] font-semibold">{message.sender?.commercial_name || 'Utilizador'}</span>
            <span className="text-[10px] text-muted-foreground">{timeStr}</span>
            {message.reactions && message.reactions.length > 0 && (
              <ChatReactions
                reactions={message.reactions}
                currentUserId={currentUserId}
                onToggle={(emoji) => onToggleReaction(message.id, emoji)}
                inline
              />
            )}
          </div>

          {/* Bubble row: bubble + eye (right) */}
          <div className="flex items-end gap-1.5">
            <div className="bg-muted rounded-2xl rounded-tl-sm px-3.5 py-2.5 min-w-0">
              {/* Reply quote */}
              {hasParentMessage && (
                <div className="bg-primary/5 rounded-lg px-2.5 py-1.5 mb-1.5 border-l-2 border-primary/30">
                  <span className="text-[11px] font-semibold text-primary">
                    {message.parent_message!.sender?.commercial_name || 'Utilizador'}
                  </span>
                  <span className="text-[11px] text-muted-foreground ml-1.5">
                    {parentContentPreview}
                  </span>
                </div>
              )}

              {/* Content */}
              <p className="text-sm whitespace-pre-wrap break-words">
                {renderMessageContent(message.content, false)}
                {message.is_edited && (
                  <span className="text-[10px] text-muted-foreground ml-1">{CHAT_LABELS.edited}</span>
                )}
              </p>

              {/* Attachments */}
              {message.attachments && message.attachments.length > 0 && (
                <div className="mt-1.5 space-y-1">
                  {message.attachments.map((att) => (
                    <ChatAttachment key={att.id} attachment={att} />
                  ))}
                </div>
              )}
            </div>
            {readReceiptEl}
          </div>

          {/* Hover actions — horizontal below bubble */}
          <div className="flex items-center gap-0 mt-0.5 min-h-[20px]">
            <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0">
              <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-foreground" onClick={onReply} title="Responder">
                <Reply className="h-3.5 w-3.5" />
              </Button>
              <Popover open={emojiPopoverOpen} onOpenChange={setEmojiPopoverOpen}>
                <PopoverTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-foreground" title="Reagir">
                    <Smile className="h-3.5 w-3.5" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-1.5" align="start" side="top">
                  <div className="flex gap-0.5">
                    {CHAT_EMOJI_QUICK.map((emoji) => (
                      <Button key={emoji} variant="ghost" size="sm" className="h-7 w-7 p-0 text-base" onClick={() => { onToggleReaction(message.id, emoji); setEmojiPopoverOpen(false) }}>
                        {emoji}
                      </Button>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </div>

        </div>
      </div>
    </>
  )
}

// ── Read receipt indicator with tooltip ──

function ReadReceiptIndicator({ readers }: { readers: { userName: string; readAt: string }[] }) {
  const count = readers.length

  // Hidden when no readers
  if (count === 0) return null

  return (
    <div className="relative group/read inline-flex items-center gap-0.5 cursor-default">
      <Eye className="h-3 w-3 text-primary" />
      <span className="text-[10px] text-primary">{count}</span>

      {/* Tooltip */}
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover/read:block z-50">
        <div className="bg-popover text-popover-foreground border rounded-lg shadow-lg px-3 py-2 text-xs whitespace-nowrap">
          <p className="font-semibold mb-1">Visualizado por:</p>
          {readers.map((r, i) => (
            <div key={i} className="flex items-center gap-2 py-0.5">
              <span className="h-4 w-4 rounded-full bg-muted flex items-center justify-center text-[9px] font-medium shrink-0">
                {r.userName[0]?.toUpperCase()}
              </span>
              <span>{r.userName}</span>
              <span className="text-muted-foreground">
                {format(new Date(r.readAt), "dd/MM 'às' HH:mm", { locale: pt })}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
