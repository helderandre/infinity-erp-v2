'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { formatDistanceToNow, format, isToday, isYesterday, isSameDay } from 'date-fns'
import { pt } from 'date-fns/locale'
import {
  FileCheck,
  CheckCircle2,
  XCircle,
  Undo2,
  UserCheck,
  MessageSquare,
  MessageCircle,
  AtSign,
  RefreshCw,
  AlertTriangle,
  Bell,
  CheckCheck,
  Filter,
  Loader2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { useUser } from '@/hooks/use-user'
import { toast } from 'sonner'
import type { Notification, NotificationType } from '@/lib/notifications/types'

const NOTIFICATION_ICONS: Record<NotificationType, React.ElementType> = {
  process_created: FileCheck,
  process_approved: CheckCircle2,
  process_rejected: XCircle,
  process_returned: Undo2,
  task_assigned: UserCheck,
  task_completed: CheckCircle2,
  task_comment: MessageSquare,
  chat_message: MessageCircle,
  comment_mention: AtSign,
  chat_mention: AtSign,
  task_updated: RefreshCw,
  task_overdue: AlertTriangle,
}

const NOTIFICATION_ICON_BG: Partial<Record<NotificationType, string>> = {
  process_approved: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400',
  process_rejected: 'bg-red-100 text-red-600 dark:bg-red-950 dark:text-red-400',
  process_returned: 'bg-amber-100 text-amber-600 dark:bg-amber-950 dark:text-amber-400',
  task_completed: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400',
  task_overdue: 'bg-red-100 text-red-600 dark:bg-red-950 dark:text-red-400',
  task_assigned: 'bg-blue-100 text-blue-600 dark:bg-blue-950 dark:text-blue-400',
  comment_mention: 'bg-violet-100 text-violet-600 dark:bg-violet-950 dark:text-violet-400',
  chat_mention: 'bg-violet-100 text-violet-600 dark:bg-violet-950 dark:text-violet-400',
}

const DEFAULT_ICON_BG = 'bg-muted text-muted-foreground'

const TYPE_LABELS: Record<string, string> = {
  process_created: 'Processo criado',
  process_approved: 'Processo aprovado',
  process_rejected: 'Processo rejeitado',
  process_returned: 'Processo devolvido',
  task_assigned: 'Tarefa atribuída',
  task_completed: 'Tarefa concluída',
  task_comment: 'Comentário',
  chat_message: 'Mensagem de chat',
  comment_mention: 'Menção em comentário',
  chat_mention: 'Menção em chat',
  task_updated: 'Tarefa actualizada',
  task_overdue: 'Tarefa em atraso',
}

function getDateLabel(dateStr: string): string {
  const date = new Date(dateStr)
  if (isToday(date)) return 'Hoje'
  if (isYesterday(date)) return 'Ontem'
  return format(date, "d 'de' MMMM, yyyy", { locale: pt })
}

function groupByDate(notifications: Notification[]): { label: string; items: Notification[] }[] {
  const groups: { label: string; date: Date; items: Notification[] }[] = []

  for (const notif of notifications) {
    const date = new Date(notif.created_at)
    const existing = groups.find(g => isSameDay(g.date, date))
    if (existing) {
      existing.items.push(notif)
    } else {
      groups.push({ label: getDateLabel(notif.created_at), date, items: [notif] })
    }
  }

  return groups
}

export default function NotificacoesPage() {
  const router = useRouter()
  const { user } = useUser()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [total, setTotal] = useState(0)
  const [unreadCount, setUnreadCount] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [page, setPage] = useState(1)
  const [tab, setTab] = useState<'all' | 'unread'>('all')
  const [typeFilter, setTypeFilter] = useState<string>('all')

  const limit = 20

  const fetchNotifications = useCallback(async (pageNum: number, append = false) => {
    if (!user) return
    if (append) {
      setIsLoadingMore(true)
    } else {
      setIsLoading(true)
    }

    try {
      const params = new URLSearchParams({
        page: String(pageNum),
        limit: String(limit),
      })
      if (tab === 'unread') params.set('unread_only', 'true')
      if (typeFilter !== 'all') params.set('type', typeFilter)

      const res = await fetch(`/api/notifications?${params}`)
      if (!res.ok) throw new Error()
      const data = await res.json()

      if (append) {
        setNotifications(prev => [...prev, ...data.notifications])
      } else {
        setNotifications(data.notifications)
      }
      setTotal(data.total)
      setUnreadCount(data.unread_count)
    } catch {
      toast.error('Erro ao carregar notificações')
    } finally {
      setIsLoading(false)
      setIsLoadingMore(false)
    }
  }, [user, tab, typeFilter])

  useEffect(() => {
    setPage(1)
    fetchNotifications(1)
  }, [fetchNotifications])

  const handleLoadMore = () => {
    const nextPage = page + 1
    setPage(nextPage)
    fetchNotifications(nextPage, true)
  }

  const handleClick = async (notif: Notification) => {
    if (!notif.is_read) {
      setNotifications(prev =>
        prev.map(n => n.id === notif.id ? { ...n, is_read: true, read_at: new Date().toISOString() } : n)
      )
      setUnreadCount(prev => Math.max(0, prev - 1))
      await fetch(`/api/notifications/${notif.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_read: true }),
      })
    }
    router.push(notif.action_url)
  }

  const handleMarkAllAsRead = async () => {
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true, read_at: new Date().toISOString() })))
    setUnreadCount(0)
    await fetch('/api/notifications', { method: 'PUT' })
    toast.success('Todas as notificações marcadas como lidas')
  }

  const hasMore = notifications.length < total
  const groups = groupByDate(notifications)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Notificações</h1>
          <p className="text-sm text-muted-foreground">
            {unreadCount > 0
              ? `${unreadCount} não lida${unreadCount > 1 ? 's' : ''}`
              : 'Tudo em dia'}
          </p>
        </div>
        {unreadCount > 0 && (
          <Button variant="outline" size="sm" onClick={handleMarkAllAsRead}>
            <CheckCheck className="mr-2 h-4 w-4" />
            Marcar tudo como lido
          </Button>
        )}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <Tabs value={tab} onValueChange={(v) => setTab(v as 'all' | 'unread')}>
          <TabsList>
            <TabsTrigger value="all">Todas</TabsTrigger>
            <TabsTrigger value="unread">
              Não lidas
              {unreadCount > 0 && (
                <span className="ml-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[0.65rem] font-medium text-primary-foreground">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[200px]">
            <Filter className="mr-2 h-3.5 w-3.5" />
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os tipos</SelectItem>
            {Object.entries(TYPE_LABELS).map(([key, label]) => (
              <SelectItem key={key} value={key}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Timeline */}
      {isLoading ? (
        <div className="space-y-6">
          {[1, 2, 3].map(g => (
            <div key={g} className="space-y-3">
              <Skeleton className="h-4 w-24" />
              {[1, 2].map(i => (
                <div key={i} className="flex gap-4 pl-4">
                  <Skeleton className="h-10 w-10 rounded-full shrink-0" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-full" />
                    <Skeleton className="h-3 w-1/4" />
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      ) : notifications.length === 0 ? (
        <Card className="flex flex-col items-center justify-center py-16 text-center">
          <Bell className="h-12 w-12 text-muted-foreground/30 mb-4" />
          <p className="text-lg font-medium text-muted-foreground">Sem notificações</p>
          <p className="text-sm text-muted-foreground/70 mt-1">
            {tab === 'unread'
              ? 'Não tem notificações por ler'
              : 'As suas notificações aparecerão aqui'}
          </p>
        </Card>
      ) : (
        <div className="space-y-8">
          {groups.map((group) => (
            <div key={group.label}>
              {/* Date header */}
              <div className="sticky top-0 z-10 mb-3">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground bg-background pr-3">
                  {group.label}
                </span>
                <div className="mt-1 h-px bg-border" />
              </div>

              {/* Timeline items */}
              <div className="relative pl-8">
                {/* Vertical timeline line */}
                <div className="absolute left-[18px] top-0 bottom-0 w-px bg-border" />

                <div className="space-y-1">
                  {group.items.map((notif, idx) => {
                    const Icon = NOTIFICATION_ICONS[notif.notification_type] ?? Bell
                    const iconBg = NOTIFICATION_ICON_BG[notif.notification_type] ?? DEFAULT_ICON_BG
                    const initials = notif.sender?.commercial_name
                      ?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() ?? '?'

                    return (
                      <button
                        key={notif.id}
                        onClick={() => handleClick(notif)}
                        className={cn(
                          'group relative flex w-full gap-4 rounded-lg p-3 text-left transition-colors hover:bg-muted/50',
                          !notif.is_read && 'bg-primary/[0.03]'
                        )}
                      >
                        {/* Timeline dot / icon */}
                        <div className={cn(
                          'absolute -left-[13px] top-4 z-10 flex h-9 w-9 items-center justify-center rounded-full ring-4 ring-background',
                          iconBg,
                        )}>
                          <Icon className="h-4 w-4" />
                        </div>

                        {/* Avatar */}
                        <Avatar className="h-9 w-9 shrink-0">
                          {notif.sender?.profile?.profile_photo_url ? (
                            <AvatarImage src={notif.sender.profile.profile_photo_url} />
                          ) : null}
                          <AvatarFallback className="text-xs">{initials}</AvatarFallback>
                        </Avatar>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <p className={cn('text-sm leading-snug', !notif.is_read && 'font-semibold')}>
                              {notif.title}
                            </p>
                            <span className="shrink-0 text-xs text-muted-foreground whitespace-nowrap">
                              {formatDistanceToNow(new Date(notif.created_at), {
                                addSuffix: true,
                                locale: pt,
                              })}
                            </span>
                          </div>
                          {notif.body && (
                            <p className="text-sm text-muted-foreground mt-0.5 line-clamp-2">
                              {notif.body}
                            </p>
                          )}
                          <div className="flex items-center gap-2 mt-1.5">
                            <span className="text-xs text-muted-foreground/70">
                              {TYPE_LABELS[notif.notification_type] ?? notif.notification_type}
                            </span>
                            {!notif.is_read && (
                              <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                            )}
                          </div>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          ))}

          {/* Load more */}
          {hasMore && (
            <div className="flex justify-center pt-2">
              <Button
                variant="outline"
                onClick={handleLoadMore}
                disabled={isLoadingMore}
              >
                {isLoadingMore ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    A carregar...
                  </>
                ) : (
                  'Carregar mais'
                )}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
