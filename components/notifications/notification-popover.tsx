'use client'

import { useEffect, useMemo, useState } from 'react'
import { Bell } from 'lucide-react'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'
import { useNotifications } from '@/hooks/use-notifications'
import { classifyBucket, type NotificationBucket } from '@/lib/notifications/types'
import { NotificationItem } from './notification-item'
import { useUser } from '@/hooks/use-user'

const POPOVER_LIMIT = 10

function formatBadge(count: number) {
  return count > 99 ? '99+' : String(count)
}

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

  const [open, setOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<NotificationBucket>('processo')

  const { processNotifications, generalNotifications, processUnread, generalUnread } = useMemo(() => {
    const proc: typeof notifications = []
    const gen: typeof notifications = []
    let pu = 0
    let gu = 0
    for (const n of notifications) {
      if (classifyBucket(n.notification_type) === 'processo') {
        proc.push(n)
        if (!n.is_read) pu++
      } else {
        gen.push(n)
        if (!n.is_read) gu++
      }
    }
    return { processNotifications: proc, generalNotifications: gen, processUnread: pu, generalUnread: gu }
  }, [notifications])

  useEffect(() => {
    if (!open) return
    setActiveTab(
      processUnread > 0 ? 'processo' : generalUnread > 0 ? 'geral' : 'processo',
    )
    // Recalcular apenas quando abre — intencionalmente sem incluir as contagens nas deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const activeUnread = activeTab === 'processo' ? processUnread : generalUnread
  const displayedProcess = processNotifications.slice(0, POPOVER_LIMIT)
  const displayedGeneral = generalNotifications.slice(0, POPOVER_LIMIT)

  const renderList = (list: typeof notifications, emptyLabel: string) => {
    if (isLoading) {
      return (
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
      )
    }
    if (list.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Bell className="h-10 w-10 text-muted-foreground/40 mb-3" />
          <p className="text-sm text-muted-foreground">{emptyLabel}</p>
        </div>
      )
    }
    return (
      <div className="divide-y">
        {list.map(notif => (
          <NotificationItem
            key={notif.id}
            notification={notif}
            onRead={markAsRead}
            onDelete={deleteNotification}
          />
        ))}
      </div>
    )
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
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
        className="w-[calc(100vw-2rem)] sm:w-96 p-0 gap-0"
        align="end"
        sideOffset={8}
      >
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-semibold">Notificações</h4>
            {unreadCount > 0 && (
              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-[0.65rem] font-medium text-white">
                {formatBadge(unreadCount)}
              </span>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="text-xs h-7"
            onClick={() => markAllAsRead({ scope: activeTab })}
            disabled={activeUnread === 0}
          >
            Marcar tudo como lido
          </Button>
        </div>
        <Separator />

        <Tabs
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as NotificationBucket)}
          className="gap-0"
        >
          <div className="px-3 pt-2 pb-1">
            <TabsList className="w-full">
              <TabsTrigger value="processo" className="flex-1">
                <span>Processo</span>
                {processUnread > 0 && (
                  <Badge
                    variant="destructive"
                    className="ml-2 h-5 px-1.5 text-[0.65rem]"
                  >
                    {formatBadge(processUnread)}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="geral" className="flex-1">
                <span>Geral</span>
                {generalUnread > 0 && (
                  <Badge
                    variant="destructive"
                    className="ml-2 h-5 px-1.5 text-[0.65rem]"
                  >
                    {formatBadge(generalUnread)}
                  </Badge>
                )}
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="overflow-y-auto overscroll-contain" style={{ maxHeight: 'min(50vh, 420px)' }}>
            <TabsContent value="processo" className="m-0">
              {renderList(displayedProcess, 'Sem notificações de processo')}
            </TabsContent>
            <TabsContent value="geral" className="m-0">
              {renderList(displayedGeneral, 'Sem notificações gerais')}
            </TabsContent>
          </div>
        </Tabs>

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
