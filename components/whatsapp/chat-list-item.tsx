'use client'

import { isToday, isYesterday, format } from 'date-fns'
import {
  Pin, VolumeX, User, Users,
  Camera, Video, Mic, FileText, MapPin,
  Contact, Sticker, BarChart3, Eye,
} from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import type { WppChat, WppMessageType } from '@/lib/types/whatsapp-web'
import { cn } from '@/lib/utils'

interface ChatListItemProps {
  chat: WppChat
  isSelected: boolean
  onClick: () => void
}

function formatTimestamp(ts: number | null): string {
  if (!ts) return ''
  const date = new Date(ts * 1000)
  if (isToday(date)) return format(date, 'HH:mm')
  if (isYesterday(date)) return 'Ontem'
  return format(date, 'dd/MM/yyyy')
}

const MESSAGE_TYPE_ICON: Record<string, { icon: typeof Camera; label: string }> = {
  image: { icon: Camera, label: 'Foto' },
  video: { icon: Video, label: 'Video' },
  audio: { icon: Mic, label: 'Audio' },
  document: { icon: FileText, label: 'Documento' },
  sticker: { icon: Sticker, label: 'Sticker' },
  location: { icon: MapPin, label: 'Localizacao' },
  contact: { icon: Contact, label: 'Contacto' },
  poll: { icon: BarChart3, label: 'Sondagem' },
  view_once: { icon: Eye, label: 'Ver Uma Vez' },
  reaction: { icon: Camera, label: '' }, // handled separately
}

function stripFormatting(text: string): string {
  return text
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/_([^_]+)_/g, '$1')
    .replace(/~([^~]+)~/g, '$1')
    .replace(/```([^`]+)```/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
}

function truncate(text: string, max: number): string {
  return text.length > max ? text.slice(0, max) + '...' : text
}

function getMessagePreview(chat: WppChat): { icon?: typeof Camera; text: string; italic?: boolean } {
  const type = chat.last_message_type as WppMessageType | null
  const rawText = chat.last_message_text || ''

  // Non-text message types
  if (type && type !== 'text' && MESSAGE_TYPE_ICON[type]) {
    const meta = MESSAGE_TYPE_ICON[type]
    // For media with caption, show: icon + caption
    const caption = rawText ? truncate(stripFormatting(rawText), 30) : meta.label
    return { icon: meta.icon, text: caption, italic: !rawText }
  }

  // Text messages — clean up formatting and mentions
  if (!rawText) return { text: '' }
  const clean = stripFormatting(rawText)
    // Replace @mentions like @121140321415... with @contacto
    .replace(/@\d{8,}/g, '@contacto')
  return { text: truncate(clean, 40) }
}

function getInitials(name: string | null): string {
  if (!name) return '?'
  return name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

export function ChatListItem({ chat, isSelected, onClick }: ChatListItemProps) {
  const displayName = chat.name || chat.phone || 'Sem nome'
  const picUrl = chat.contact?.profile_pic_url || chat.profile_pic_url || chat.image
  const hasOwner = !!chat.contact?.owner_id
  const hasLead = !!chat.contact?.lead_id
  const isLinked = hasOwner || hasLead
  const preview = getMessagePreview(chat)
  const PreviewIcon = preview.icon

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-accent/50',
        isSelected && 'bg-accent'
      )}
    >
      <div className="relative flex-shrink-0">
        <Avatar className="h-10 w-10">
          {picUrl && <AvatarImage src={picUrl} alt={displayName} />}
          <AvatarFallback className="text-xs">{getInitials(chat.name)}</AvatarFallback>
        </Avatar>
        {isLinked && (
          <span className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 text-white ring-2 ring-background">
            {hasOwner ? <User className="h-2.5 w-2.5" /> : <Users className="h-2.5 w-2.5" />}
          </span>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-sm font-medium truncate">{displayName}</span>
            {hasOwner && (
              <span className="inline-flex items-center gap-0.5 rounded bg-blue-100 dark:bg-blue-900/30 px-1 py-0.5 text-[9px] font-medium text-blue-700 dark:text-blue-300 flex-shrink-0">
                Proprietario
              </span>
            )}
            {hasLead && (
              <span className="inline-flex items-center gap-0.5 rounded bg-amber-100 dark:bg-amber-900/30 px-1 py-0.5 text-[9px] font-medium text-amber-700 dark:text-amber-300 flex-shrink-0">
                Lead
              </span>
            )}
          </div>
          <span className="text-[11px] text-muted-foreground flex-shrink-0 ml-2">
            {formatTimestamp(chat.last_message_timestamp)}
          </span>
        </div>
        <div className="flex items-center justify-between mt-0.5">
          <span className="text-xs text-muted-foreground truncate flex items-center gap-1">
            {PreviewIcon && <PreviewIcon className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground/70" />}
            <span className={preview.italic ? 'italic' : ''}>{preview.text}</span>
          </span>
          <div className="flex items-center gap-1 flex-shrink-0 ml-2">
            {chat.is_pinned && <Pin className="h-3 w-3 text-muted-foreground" />}
            {chat.is_muted && <VolumeX className="h-3 w-3 text-muted-foreground" />}
            {chat.unread_count > 0 && (
              <Badge variant="default" className="h-5 min-w-5 px-1 text-[10px] rounded-full justify-center">
                {chat.unread_count}
              </Badge>
            )}
          </div>
        </div>
      </div>
    </button>
  )
}
