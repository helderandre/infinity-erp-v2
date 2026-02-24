'use client'

import { useRouter } from 'next/navigation'
import { formatDistanceToNow } from 'date-fns'
import { pt } from 'date-fns/locale'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'
import type { Notification } from '@/lib/notifications/types'

interface NotificationItemProps {
  notification: Notification
  onRead: (id: string) => void
  onDelete: (id: string) => void
}

export function NotificationItem({ notification, onRead }: NotificationItemProps) {
  const router = useRouter()

  const handleClick = () => {
    if (!notification.is_read) onRead(notification.id)
    router.push(notification.action_url)
  }

  const initials = notification.sender?.commercial_name
    ?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() ?? '?'

  return (
    <button
      onClick={handleClick}
      className={cn(
        'flex w-full gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50',
        !notification.is_read && 'bg-primary/5'
      )}
    >
      <Avatar className="h-8 w-8 shrink-0">
        {notification.sender?.profile?.profile_photo_url ? (
          <AvatarImage src={notification.sender.profile.profile_photo_url} />
        ) : null}
        <AvatarFallback className="text-xs">{initials}</AvatarFallback>
      </Avatar>

      <div className="flex-1 min-w-0">
        <p className={cn('text-sm leading-snug', !notification.is_read && 'font-medium')}>
          {notification.title}
        </p>
        {notification.body && (
          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{notification.body}</p>
        )}
        <p className="text-xs text-muted-foreground mt-1">
          {formatDistanceToNow(new Date(notification.created_at), {
            addSuffix: true,
            locale: pt,
          })}
        </p>
      </div>

      {!notification.is_read && (
        <div className="shrink-0 mt-2">
          <div className="h-2 w-2 rounded-full bg-primary" />
        </div>
      )}
    </button>
  )
}
