'use client'

import { Bell } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { useNotifications } from '@/hooks/use-notifications'
import { NotificationItem } from './notification-item'
import { useUser } from '@/hooks/use-user'

const POPOVER_LIMIT = 10

export function NotificationPopover() {
  const { user } = useUser()
  const {
    notifications,
    unreadCount,
    isLoading,
    markAsRead,
    markAllAsRead,
    deleteNotification,
  } = useNotifications(user?.id ?? null)

  const displayedNotifications = notifications.slice(0, POPOVER_LIMIT)
  const hiddenUnread = Math.max(0, unreadCount - displayedNotifications.filter(n => !n.is_read).length)

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-9 w-9">
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className={cn(
              'absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center',
              'rounded-full bg-red-500 text-[0.6rem] font-medium text-white'
            )}>
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-96 p-0 gap-0"
        align="end"
        sideOffset={8}
      >
        {/* Cabecalho */}
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-semibold">Notificações</h4>
            {unreadCount > 0 && (
              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-[0.65rem] font-medium text-white">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </div>
          {unreadCount > 0 && (
            <Button variant="ghost" size="sm" className="text-xs h-7" onClick={markAllAsRead}>
              Marcar tudo como lido
            </Button>
          )}
        </div>
        <Separator />

        {/* Lista com scroll fixo */}
        <div className="overflow-y-auto overscroll-contain" style={{ maxHeight: 'min(50vh, 420px)' }}>
          {isLoading ? (
            <div className="space-y-3 p-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="flex gap-3">
                  <Skeleton className="h-8 w-8 rounded-full shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-3.5 w-3/4" />
                    <Skeleton className="h-3 w-full" />
                    <Skeleton className="h-3 w-1/4" />
                  </div>
                </div>
              ))}
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Bell className="h-10 w-10 text-muted-foreground/40 mb-3" />
              <p className="text-sm text-muted-foreground">Sem notificações</p>
            </div>
          ) : (
            <div className="divide-y">
              {displayedNotifications.map(notif => (
                <NotificationItem
                  key={notif.id}
                  notification={notif}
                  onRead={markAsRead}
                  onDelete={deleteNotification}
                />
              ))}
            </div>
          )}
        </div>

        {/* Info de não lidas extra */}
        {hiddenUnread > 0 && (
          <>
            <Separator />
            <div className="px-4 py-2 text-center">
              <p className="text-xs text-muted-foreground">
                +{hiddenUnread} notificação{hiddenUnread > 1 ? 'ões' : ''} não lida{hiddenUnread > 1 ? 's' : ''}
              </p>
            </div>
          </>
        )}

        {/* Footer — Ver todas */}
        <Separator />
        <div className="p-2">
          <Button variant="ghost" size="sm" className="w-full text-xs h-8" asChild>
            <Link href="/dashboard/notificacoes">Ver todas as notificações</Link>
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
