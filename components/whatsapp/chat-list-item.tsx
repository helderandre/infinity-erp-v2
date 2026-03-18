'use client'

import { isToday, isYesterday, format } from 'date-fns'
import { Pin, VolumeX } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import type { WppChat } from '@/lib/types/whatsapp-web'
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

function getLastMessagePreview(chat: WppChat): string {
  if (!chat.last_message_text) return ''
  return chat.last_message_text.length > 40
    ? chat.last_message_text.slice(0, 40) + '...'
    : chat.last_message_text
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
  const picUrl = chat.contact?.profile_pic_url || chat.profile_pic_url

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-accent/50',
        isSelected && 'bg-accent'
      )}
    >
      <Avatar className="h-10 w-10 flex-shrink-0">
        {picUrl && <AvatarImage src={picUrl} alt={displayName} />}
        <AvatarFallback className="text-xs">{getInitials(chat.name)}</AvatarFallback>
      </Avatar>

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium truncate">{displayName}</span>
          <span className="text-[11px] text-muted-foreground flex-shrink-0 ml-2">
            {formatTimestamp(chat.last_message_timestamp)}
          </span>
        </div>
        <div className="flex items-center justify-between mt-0.5">
          <span className="text-xs text-muted-foreground truncate">
            {getLastMessagePreview(chat)}
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
