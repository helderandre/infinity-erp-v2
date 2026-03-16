'use client'

import { Bell, CheckCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Badge } from '@/components/ui/badge'
import { useTrainingNotifications } from '@/hooks/use-training-notifications'
import { TRAINING_NOTIFICATION_LABELS } from '@/lib/constants'
import { formatDistanceToNow } from 'date-fns'
import { pt } from 'date-fns/locale'
import Link from 'next/link'

export function TrainingNotificationsDropdown() {
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useTrainingNotifications()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 flex items-center justify-center text-[10px]"
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <div className="flex items-center justify-between px-2">
          <DropdownMenuLabel>Notificações</DropdownMenuLabel>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={() => markAllAsRead()}
            >
              <CheckCheck className="mr-1 h-3 w-3" />
              Marcar todas
            </Button>
          )}
        </div>
        <DropdownMenuSeparator />
        {notifications.length === 0 ? (
          <div className="px-4 py-6 text-center text-sm text-muted-foreground">
            Sem notificações
          </div>
        ) : (
          <div className="max-h-80 overflow-y-auto">
            {notifications.slice(0, 10).map((notification) => (
              <DropdownMenuItem
                key={notification.id}
                className={`flex flex-col items-start gap-1 px-4 py-3 cursor-pointer ${
                  !notification.is_read ? 'bg-primary/5' : ''
                }`}
                onClick={() => {
                  if (!notification.is_read) markAsRead(notification.id)
                }}
                asChild
              >
                <Link
                  href={
                    notification.course_id
                      ? `/dashboard/formacoes/cursos/${notification.course_id}`
                      : '/dashboard/formacoes'
                  }
                >
                  <div className="flex items-center gap-2">
                    {!notification.is_read && (
                      <span className="h-2 w-2 rounded-full bg-primary shrink-0" />
                    )}
                    <span className="text-xs font-medium text-muted-foreground">
                      {TRAINING_NOTIFICATION_LABELS[notification.notification_type] || 'Notificação'}
                    </span>
                  </div>
                  <p className="text-sm font-medium line-clamp-1">{notification.title}</p>
                  <p className="text-xs text-muted-foreground line-clamp-1">{notification.message}</p>
                  <span className="text-[11px] text-muted-foreground">
                    {formatDistanceToNow(new Date(notification.created_at), {
                      locale: pt,
                      addSuffix: true,
                    })}
                  </span>
                </Link>
              </DropdownMenuItem>
            ))}
          </div>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild className="justify-center">
          <Link href="/dashboard/formacoes" className="text-sm text-center w-full">
            Ver todas as formações
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
