'use client'

import { useEffect, useMemo, useState } from 'react'
import { Bell } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Skeleton } from '@/components/ui/skeleton'
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
      <div className="divide-y divide-border/40">
        {list.map(notif => (
          <NotificationItem
            key={notif.id}
            notification={notif}
            onRead={markAsRead}
            onDelete={deleteNotification}
            onNavigate={() => setOpen(false)}
          />
        ))}
      </div>
    )
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            'relative flex h-8 w-8 items-center justify-center rounded-full',
            'bg-zinc-900/70 hover:bg-zinc-900/85 text-white backdrop-blur-md',
            'border border-white/10 transition-colors',
          )}
        >
          <Bell className="size-4" />
          <span className="sr-only">Notificações</span>
          {unreadCount > 0 && (
            <span
              className={cn(
                'absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center px-1',
                'rounded-full bg-red-500 text-[0.6rem] font-medium text-white',
                'ring-2 ring-background',
              )}
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        className={cn(
          'w-[calc(100vw-2rem)] sm:w-[400px] p-0 gap-0 overflow-hidden',
          'rounded-3xl border-border/40 shadow-2xl',
          'bg-background/85 supports-[backdrop-filter]:bg-background/70 backdrop-blur-2xl',
        )}
        align="end"
        sideOffset={8}
      >
        {/* ─── Header ─────────────────────────────────────────────── */}
        <div className="px-5 pt-5 pb-4 border-b border-border/40 shrink-0">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4" />
              <h4 className="text-base font-semibold tracking-tight">Notificações</h4>
              {unreadCount > 0 && (
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-[0.65rem] font-medium text-white">
                  {formatBadge(unreadCount)}
                </span>
              )}
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="text-[11px] h-7 rounded-full text-muted-foreground hover:text-foreground"
              onClick={() => markAllAsRead({ scope: activeTab })}
              disabled={activeUnread === 0}
            >
              Marcar tudo como lido
            </Button>
          </div>
        </div>

        {/* ─── Pill tabs ──────────────────────────────────────────── */}
        <div className="px-4 pt-3 pb-2 shrink-0">
          <div className="grid grid-cols-2 gap-1 rounded-full bg-muted/50 p-1">
            {(['processo', 'geral'] as const).map((key) => {
              const isActive = activeTab === key
              const unread = key === 'processo' ? processUnread : generalUnread
              const label = key === 'processo' ? 'Processo' : 'Geral'
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setActiveTab(key)}
                  className={cn(
                    'inline-flex items-center justify-center gap-1.5 rounded-full px-3 py-1.5',
                    'text-[12px] font-medium transition-all',
                    isActive
                      ? 'bg-background shadow-sm text-foreground'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {label}
                  {unread > 0 && (
                    <span
                      className={cn(
                        'inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1',
                        'text-[10px] font-medium',
                        isActive
                          ? 'bg-red-500 text-white'
                          : 'bg-red-500/20 text-red-600',
                      )}
                    >
                      {formatBadge(unread)}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </div>

        {/* ─── List inside a card ─────────────────────────────────── */}
        <div className="px-4 pb-3">
          <div
            className="rounded-2xl bg-card/60 border border-border/40 shadow-sm overflow-hidden overflow-y-auto overscroll-contain"
            style={{ maxHeight: 'min(50vh, 420px)' }}
          >
            {activeTab === 'processo'
              ? renderList(displayedProcess, 'Sem notificações de processo')
              : renderList(displayedGeneral, 'Sem notificações gerais')}
          </div>
        </div>

        {/* ─── Footer ─────────────────────────────────────────────── */}
        <div className="border-t border-border/40 bg-background/40 supports-[backdrop-filter]:bg-background/30 backdrop-blur-md px-3 py-2 shrink-0">
          <Button
            variant="ghost"
            size="sm"
            className="w-full text-xs h-9 rounded-full hover:bg-muted/60"
            asChild
          >
            <Link
              href="/dashboard/notificacoes"
              onClick={() => setOpen(false)}
            >
              Ver todas as notificações
            </Link>
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
