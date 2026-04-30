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
import { Reply, Smile, Pencil, Trash2, X, Check, Eye, ClipboardList, Pin, FileText, Upload, Mail, CheckSquare, Circle, CheckCircle2, ChevronDown, Forward, Copy } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Spinner } from '@/components/kibo-ui/spinner'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import { format } from 'date-fns'
import { pt } from 'date-fns/locale'
import { CHAT_LABELS, CHAT_EMOJI_QUICK } from '@/lib/constants'
import { ChatAttachment } from './chat-attachment'
import { ChatReactions } from './chat-reactions'
import type { ChatMessage as ChatMessageType } from '@/types/process'
import { toast } from 'sonner'

export interface ChatEntityData {
  id: string
  display: string
  type: 'task' | 'subtask' | 'doc'
  status: string
  extra?: string
  config_type?: string
  owner_name?: string
  action_type?: string
}

interface ChatMessageProps {
  message: ChatMessageType
  currentUserId: string
  processId: string
  onReply: () => void
  onToggleReaction: (messageId: string, emoji: string) => void
  onEdit: (messageId: string, content: string) => Promise<void>
  onDelete: (messageId: string) => Promise<void>
  /** Quando definido, mostra "Reencaminhar" no menu de acções. */
  onForward?: (message: ChatMessageType) => void
  readers?: { userName: string; readAt: string }[]
  onEntityClick?: (entityType: string, entityId: string) => void
  entitiesMap?: Map<string, ChatEntityData>
}

// Icons for subtask config types
const SUBTASK_TYPE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  upload: Upload,
  email: Mail,
  checklist: CheckSquare,
  generate_doc: FileText,
}

const SUBTASK_TYPE_LABELS: Record<string, string> = {
  upload: 'Upload',
  email: 'Email',
  checklist: 'Checklist',
  generate_doc: 'Documento',
}

const TASK_ACTION_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  UPLOAD: Upload,
  EMAIL: Mail,
  GENERATE_DOC: FileText,
  MANUAL: Circle,
  FORM: ClipboardList,
  COMPOSITE: ClipboardList,
}

// Render an entity card that looks like the subtask cards
function EntityMentionCard({
  entityType,
  entityId,
  displayName,
  entityData,
  isOwn,
  onEntityClick,
}: {
  entityType: string
  entityId: string
  displayName: string
  entityData?: ChatEntityData
  isOwn: boolean
  onEntityClick?: (entityType: string, entityId: string) => void
}) {
  const configType = entityData?.config_type || 'checklist'
  const ownerName = entityData?.owner_name
  const status = entityData?.status || 'pending'
  const isCompleted = status === 'completed'

  // Choose icon based on entity type
  let IconComponent: React.ComponentType<{ className?: string }> = ClipboardList
  let typeLabel = ''

  if (entityType === 'subtask') {
    IconComponent = SUBTASK_TYPE_ICONS[configType] || CheckSquare
    typeLabel = SUBTASK_TYPE_LABELS[configType] || 'Checklist'
  } else if (entityType === 'task') {
    const actionType = entityData?.action_type || 'MANUAL'
    IconComponent = TASK_ACTION_ICONS[actionType] || Circle
    typeLabel = entityData?.extra || 'Tarefa'
  } else if (entityType === 'doc') {
    IconComponent = FileText
    typeLabel = 'Documento'
  }

  const StatusIcon = isCompleted ? CheckCircle2 : Circle

  return (
    <button
      onClick={(e) => {
        e.stopPropagation()
        onEntityClick?.(entityType, entityId)
      }}
      className={cn(
        'flex flex-col gap-1.5 w-full rounded-lg border p-2.5 text-left cursor-pointer transition-colors my-1',
        isOwn
          ? 'border-primary-foreground/20 bg-primary-foreground/10 hover:bg-primary-foreground/20'
          : isCompleted
            ? 'bg-background/60 border-border/50 opacity-80'
            : 'bg-background border-border hover:bg-accent/50',
      )}
    >
      {/* Header: status icon + type icon + title */}
      <div className="flex items-center gap-2">
        <StatusIcon className={cn('h-4 w-4 shrink-0', isCompleted ? 'text-emerald-400' : isOwn ? 'text-primary-foreground/50' : 'text-muted-foreground')} />
        <IconComponent className={cn('h-4 w-4 shrink-0', isOwn ? 'text-primary-foreground/70' : isCompleted ? 'text-muted-foreground' : 'text-foreground/70')} />
        <span className={cn(
          'flex-1 text-sm font-medium truncate',
          isOwn ? 'text-primary-foreground' : 'text-foreground',
          isCompleted && 'line-through opacity-70'
        )}>
          {displayName}
        </span>
      </div>

      {/* Footer: owner + type */}
      <div className="flex items-center gap-2">
        {ownerName && (
          <Badge
            variant="outline"
            className={cn(
              'text-[10px] px-1.5 py-0',
              isOwn
                ? 'border-primary-foreground/30 text-primary-foreground/80 bg-primary-foreground/10'
                : 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800'
            )}
          >
            👤 {ownerName}
          </Badge>
        )}
        <Badge
          variant="outline"
          className={cn(
            'text-[10px] px-1 py-0 ml-auto',
            isOwn
              ? 'border-primary-foreground/30 text-primary-foreground/80'
              : ''
          )}
        >
          {typeLabel}
        </Badge>
      </div>
    </button>
  )
}

// URL detection — split em http(s)://… ou www.… cobre ~95% dos casos.
// `/g` é OK em `.split()` (não usa lastIndex). Para test usamos um regex
// separado sem `/g` para evitar o bug do lastIndex.
const URL_SPLIT_RE = /(https?:\/\/[^\s]+|www\.[^\s]+)/gi
const URL_TEST_RE = /^(https?:\/\/|www\.)/i
const TRAILING_PUNCT_RE = /[.,;:!?)\]}>]+$/

function linkifyPlainText(text: string, isOwn: boolean): React.ReactNode {
  if (!text) return text
  const segments = text.split(URL_SPLIT_RE)
  return segments.map((seg, i) => {
    if (!URL_TEST_RE.test(seg)) return <React.Fragment key={i}>{seg}</React.Fragment>
    // Strip trailing punctuation que não pertence ao URL ("…example.com." →
    // URL é "…example.com" e o "." fica como texto a seguir).
    const trail = seg.match(TRAILING_PUNCT_RE)
    const urlText = trail ? seg.slice(0, seg.length - trail[0].length) : seg
    const after = trail ? trail[0] : ''
    const href = urlText.toLowerCase().startsWith('http') ? urlText : `https://${urlText}`
    return (
      <React.Fragment key={i}>
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="text-sky-400 underline underline-offset-2 break-all hover:text-sky-300 transition-colors"
        >
          {urlText}
        </a>
        {after}
      </React.Fragment>
    )
  })
}

function renderMessageContent(
  content: string,
  isOwn: boolean,
  onEntityClick?: (entityType: string, entityId: string) => void,
  entitiesMap?: Map<string, ChatEntityData>
): React.ReactNode {
  // Match both @[name](id) and /[name](type:id)
  const parts = content.split(/([@/]\[[^\]]+\]\([^)]+\))/)
  return parts.map((part, i) => {
    // User mention: @[Name](uuid)
    const userMatch = part.match(/^@\[([^\]]+)\]\(([^)]+)\)$/)
    if (userMatch) {
      return (
        <span
          key={i}
          className={`font-semibold ${isOwn ? 'text-primary-foreground underline decoration-primary-foreground/40' : 'text-primary'}`}
        >
          @{userMatch[1]}
        </span>
      )
    }
    // Entity mention: /[Name](type:uuid) → render as card
    const entityMatch = part.match(/^\/\[([^\]]+)\]\((\w+):([^)]+)\)$/)
    if (entityMatch) {
      const [, displayName, entityType, entityId] = entityMatch
      const entityKey = `${entityType}:${entityId}`
      const entityData = entitiesMap?.get(entityKey)
      return (
        <EntityMentionCard
          key={i}
          entityType={entityType}
          entityId={entityId}
          displayName={displayName}
          entityData={entityData}
          isOwn={isOwn}
          onEntityClick={onEntityClick}
        />
      )
    }
    // Plain text — auto-link URLs (http(s):// e www.) sem perder mentions
    // já tratados acima.
    return <React.Fragment key={i}>{linkifyPlainText(part, isOwn)}</React.Fragment>
  })
}

export function ChatMessageItem({
  message,
  currentUserId,
  onReply,
  onToggleReaction,
  onEdit,
  onDelete,
  onForward,
  readers,
  onEntityClick,
  entitiesMap,
}: ChatMessageProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState(message.content)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [emojiPopoverOpen, setEmojiPopoverOpen] = useState(false)

  const isOwn = message.sender_id === currentUserId
  const timeStr = format(new Date(message.created_at), 'HH:mm')

  // Voice messages: hide the text content (just show the player)
  const isVoiceMsg = message.has_attachments &&
    message.attachments?.some(
      (a) => a.attachment_type === 'audio' && a.file_name.includes('voice')
    )

  // Mensagens com imagem precisam de mais espaço — o bubble normal (75%)
  // deixa as imagens cramped em mobile e força crops feios. Bump para 88%
  // (mobile) com cap de 440px em desktop para não esticar absurdamente.
  const hasImage = message.has_attachments &&
    message.attachments?.some((a) => a.attachment_type === 'image')
  const bubbleMaxWidth = hasImage
    ? 'max-w-[88%] sm:max-w-[440px]'
    : 'max-w-[75%]'

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

  const parentMessage = message.parent_message_id
    ? Array.isArray(message.parent_message)
      ? message.parent_message.find((item) => item?.id === message.parent_message_id) || null
      : message.parent_message?.id === message.parent_message_id
        ? message.parent_message
        : null
    : null

  const hasParentMessage = Boolean(parentMessage?.content)

  const parentContentPreview = hasParentMessage
    ? parentMessage!.content.length > 80
      ? parentMessage!.content.slice(0, 80) + '…'
      : parentMessage!.content
    : ''

  const readReceiptEl = readers && readers.length > 0
    ? <ReadReceiptIndicator readers={readers} />
    : null

  const handleCopy = () => {
    if (!message.content) return
    navigator.clipboard.writeText(message.content)
      .then(() => toast.success('Texto copiado'))
      .catch(() => toast.error('Não foi possível copiar'))
  }

  /**
   * Menu de acções no estilo WhatsApp — chevron-down a abrir DropdownMenu
   * com Responder / Reagir / Reencaminhar / Copiar / Editar / Apagar.
   * `onForward` é opcional (process chat ainda não o providencia) — quando
   * ausente, a entrada "Reencaminhar" é escondida.
   */
  const ActionsMenu = () => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 text-muted-foreground hover:text-foreground"
          title="Mais acções"
        >
          <ChevronDown className="h-3.5 w-3.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align={isOwn ? 'end' : 'start'}
        sideOffset={4}
        collisionPadding={8}
        className="w-44 max-w-[calc(100vw-1rem)]"
      >
        <DropdownMenuItem onClick={onReply}>
          <Reply className="mr-2 h-4 w-4" />
          Responder
        </DropdownMenuItem>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <Smile className="mr-2 h-4 w-4" />
            Reagir
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent sideOffset={4} collisionPadding={8}>
            <div className="flex flex-wrap gap-1 p-1">
              {CHAT_EMOJI_QUICK.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => onToggleReaction(message.id, emoji)}
                  className="hover:bg-accent rounded p-1 text-lg"
                >
                  {emoji}
                </button>
              ))}
            </div>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        {onForward && (
          <DropdownMenuItem onClick={() => onForward(message)}>
            <Forward className="mr-2 h-4 w-4" />
            Reencaminhar
          </DropdownMenuItem>
        )}
        {message.content && (
          <DropdownMenuItem onClick={handleCopy}>
            <Copy className="mr-2 h-4 w-4" />
            Copiar texto
          </DropdownMenuItem>
        )}
        {isOwn && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => { setEditValue(message.content); setIsEditing(true) }}>
              <Pencil className="mr-2 h-4 w-4" />
              Editar
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => setDeleteDialogOpen(true)}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Apagar
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )

  // ── Own message (right-aligned) ──
  if (isOwn) {
    return (
      <>
        <div className="flex justify-end gap-2 group">
          <div className={cn(bubbleMaxWidth, 'min-w-[120px]')}>
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
                    <p className="text-[11px] font-semibold">
                      A responder a {parentMessage!.sender?.commercial_name || 'Utilizador'}
                    </p>
                    <p className="text-[11px] opacity-80 truncate">
                      {parentContentPreview}
                    </p>
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
                      {isSubmitting ? <Spinner variant="infinite" size={12} /> : <Check className="h-3 w-3" />}
                    </Button>
                    <Button size="icon" variant="ghost" className="h-6 w-6 text-primary-foreground hover:bg-primary-foreground/20" onClick={() => { setIsEditing(false); setEditValue(message.content) }}>
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ) : !isVoiceMsg ? (
                  <p className="text-sm whitespace-pre-wrap break-words select-text cursor-text selection:!bg-blue-500/50 selection:!text-white">
                    {renderMessageContent(message.content, true, onEntityClick, entitiesMap)}
                    {message.is_edited && (
                      <span className="text-[10px] opacity-60 ml-1">{CHAT_LABELS.edited}</span>
                    )}
                  </p>
                ) : null}

                {/* Attachments */}
                {message.attachments && message.attachments.length > 0 && (
                  <div className={isVoiceMsg ? '' : 'mt-1.5 space-y-1'}>
                    {message.attachments.map((att) => (
                      <ChatAttachment key={att.id} attachment={att} />
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Hover actions — quick reply/react inline + WhatsApp-style chevron menu */}
            <div className="flex items-center justify-end gap-0 mt-0.5 min-h-[20px]">
              <div className="opacity-0 group-hover:opacity-100 max-md:opacity-100 transition-opacity flex items-center gap-0">
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
                <ActionsMenu />
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
                {isSubmitting ? <Spinner variant="infinite" size={16} className="mr-2" /> : null}
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

        <div className={cn(bubbleMaxWidth, 'min-w-[120px]')}>
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
                  <p className="text-[11px] font-semibold text-primary">
                    A responder a {parentMessage!.sender?.commercial_name || 'Utilizador'}
                  </p>
                  <p className="text-[11px] text-muted-foreground truncate">
                    {parentContentPreview}
                  </p>
                </div>
              )}

              {/* Content */}
              {!isVoiceMsg && (
                <p className="text-sm whitespace-pre-wrap break-words select-text cursor-text selection:!bg-blue-500/50 selection:!text-white">
                  {renderMessageContent(message.content, false, onEntityClick, entitiesMap)}
                  {message.is_edited && (
                    <span className="text-[10px] text-muted-foreground ml-1">{CHAT_LABELS.edited}</span>
                  )}
                </p>
              )}

              {/* Attachments */}
              {message.attachments && message.attachments.length > 0 && (
                <div className={isVoiceMsg ? '' : 'mt-1.5 space-y-1'}>
                  {message.attachments.map((att) => (
                    <ChatAttachment key={att.id} attachment={att} isOwn={false} />
                  ))}
                </div>
              )}
            </div>
            {readReceiptEl}
          </div>

          {/* Hover actions — quick reply/react inline + WhatsApp-style chevron menu */}
          <div className="flex items-center gap-0 mt-0.5 min-h-[20px]">
            <div className="opacity-0 group-hover:opacity-100 max-md:opacity-100 transition-opacity flex items-center gap-0">
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
              <ActionsMenu />
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
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-0.5 rounded px-0.5 py-0.5 -m-0.5 hover:bg-primary/10 transition-colors cursor-pointer"
          aria-label={`Visualizado por ${count} pessoa${count !== 1 ? 's' : ''}`}
        >
          <Eye className="h-3 w-3 text-primary" />
          <span className="text-[10px] text-primary">{count}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="top"
        align="center"
        className="w-auto max-w-[280px] p-2.5"
      >
        <p className="text-[11px] font-semibold mb-1.5 text-muted-foreground uppercase tracking-wider">
          Visualizado por
        </p>
        <div className="space-y-1">
          {readers.map((r, i) => (
            <div key={i} className="flex items-center gap-2 text-xs">
              <span className="h-5 w-5 rounded-full bg-muted flex items-center justify-center text-[10px] font-medium shrink-0">
                {r.userName[0]?.toUpperCase()}
              </span>
              <span className="font-medium truncate flex-1 min-w-0">{r.userName}</span>
              <span className="text-[10px] text-muted-foreground shrink-0">
                {format(new Date(r.readAt), "dd/MM 'às' HH:mm", { locale: pt })}
              </span>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}
