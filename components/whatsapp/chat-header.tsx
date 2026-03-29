'use client'

import { ArrowLeft, Info, Search, MoreVertical, Archive, Pin, VolumeX } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { WppChat } from '@/lib/types/whatsapp-web'

interface ChatHeaderProps {
  chat: WppChat | null
  isTyping: boolean
  onToggleInfo: () => void
  onBack?: () => void
}

export function ChatHeader({ chat, isTyping, onToggleInfo, onBack }: ChatHeaderProps) {
  const displayName = chat?.name || chat?.contact?.name || chat?.phone || 'Conversa'
  const picUrl = chat?.contact?.profile_pic_url || chat?.profile_pic_url || chat?.image

  const subtitle = isTyping
    ? 'A escrever...'
    : chat?.phone || ''

  return (
    <div className="flex items-center gap-2 px-2 sm:px-4 py-2.5 border-b bg-background">
      {onBack && (
        <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0" onClick={onBack}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
      )}
      <button type="button" onClick={onToggleInfo} className="flex-shrink-0">
        <Avatar className="h-9 w-9">
          {picUrl && <AvatarImage src={picUrl} alt={displayName} />}
          <AvatarFallback className="text-xs">
            {displayName.slice(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>
      </button>

      <button type="button" onClick={onToggleInfo} className="flex-1 min-w-0 text-left">
        <div className="text-sm font-medium truncate">{displayName}</div>
        {subtitle && (
          <div className={`text-xs truncate ${isTyping ? 'text-emerald-600' : 'text-muted-foreground'}`}>
            {subtitle}
          </div>
        )}
      </button>

      <div className="flex items-center gap-1">
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <Search className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onToggleInfo}>
          <Info className="h-4 w-4" />
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem>
              <Archive className="mr-2 h-4 w-4" />
              Arquivar
            </DropdownMenuItem>
            <DropdownMenuItem>
              <Pin className="mr-2 h-4 w-4" />
              Fixar
            </DropdownMenuItem>
            <DropdownMenuItem>
              <VolumeX className="mr-2 h-4 w-4" />
              Silenciar
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}
