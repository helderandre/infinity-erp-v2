'use client'

import { Users, ArrowLeft } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

interface PresenceUser {
  user_id: string
  user_name: string
  typing: boolean
  online_at: string
}

interface InternalChatHeaderProps {
  onlineUsers: PresenceUser[]
  currentUserId: string
  onBack?: () => void
}

export function InternalChatHeader({ onlineUsers, currentUserId, onBack }: InternalChatHeaderProps) {
  const others = onlineUsers.filter((u) => u.user_id !== currentUserId && u.user_name)

  return (
    <div className="border-b px-4 py-2.5 flex items-center justify-between shrink-0">
      <div className="flex items-center gap-3">
        {onBack && (
          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 md:hidden" onClick={onBack}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
        )}
        <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center">
          <Users className="h-4 w-4 text-primary" />
        </div>
        <div>
          <h3 className="text-sm font-semibold">Grupo Geral</h3>
          <p className="text-[11px] text-muted-foreground">
            {others.length > 0
              ? `${others.length} online`
              : 'Ninguém online'}
          </p>
        </div>
      </div>

      {/* Online avatars */}
      {others.length > 0 && (
        <TooltipProvider>
          <div className="flex -space-x-2">
            {others.slice(0, 5).map((u) => (
              <Tooltip key={u.user_id}>
                <TooltipTrigger asChild>
                  <Avatar className="h-7 w-7 border-2 border-background">
                    <AvatarFallback className="text-[10px] bg-primary/10">
                      {u.user_name?.[0]?.toUpperCase() || '?'}
                    </AvatarFallback>
                  </Avatar>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  <p className="text-xs">{u.user_name}</p>
                </TooltipContent>
              </Tooltip>
            ))}
            {others.length > 5 && (
              <Avatar className="h-7 w-7 border-2 border-background">
                <AvatarFallback className="text-[10px] bg-muted">
                  +{others.length - 5}
                </AvatarFallback>
              </Avatar>
            )}
          </div>
        </TooltipProvider>
      )}
    </div>
  )
}
