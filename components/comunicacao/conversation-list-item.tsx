'use client'

import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { formatDistanceToNow } from 'date-fns'
import { pt } from 'date-fns/locale'

interface ConversationListItemProps {
  icon: React.ReactNode
  title: string
  subtitle?: string
  preview?: string
  timestamp?: string
  unreadCount?: number
  isActive?: boolean
  onClick: () => void
}

export function ConversationListItem({
  icon,
  title,
  subtitle,
  preview,
  timestamp,
  unreadCount = 0,
  isActive = false,
  onClick,
}: ConversationListItemProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full flex items-start gap-3 px-3 py-2.5 rounded-lg text-left transition-colors',
        'hover:bg-muted/60',
        isActive && 'bg-muted'
      )}
    >
      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className={cn('text-sm font-medium truncate', unreadCount > 0 && 'font-semibold')}>
            {title}
          </span>
          {timestamp && (
            <span className="text-[10px] text-muted-foreground shrink-0">
              {formatDistanceToNow(new Date(timestamp), { addSuffix: false, locale: pt })}
            </span>
          )}
        </div>
        {subtitle && (
          <p className="text-xs text-muted-foreground truncate">{subtitle}</p>
        )}
        <div className="flex items-center justify-between gap-2 mt-0.5">
          <p className={cn(
            'text-xs truncate',
            unreadCount > 0 ? 'text-foreground' : 'text-muted-foreground'
          )}>
            {preview || 'Sem mensagens'}
          </p>
          {unreadCount > 0 && (
            <Badge className="h-5 min-w-5 px-1.5 text-[10px] font-bold rounded-full bg-primary text-primary-foreground shrink-0">
              {unreadCount}
            </Badge>
          )}
        </div>
      </div>
    </button>
  )
}
