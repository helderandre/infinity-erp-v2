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
  BellOff,
  Inbox,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Timeline,
  TimelineItem,
  TimelineDot,
  TimelineConnector,
  TimelineContent,
} from '@/components/ui/timeline'
import { cn } from '@/lib/utils'
import { useUser } from '@/hooks/use-user'
import { toast } from 'sonner'
import type { Notification, NotificationType } from '@/lib/notifications/types'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

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

const NOTIFICATION_DOT_STYLES: Partial<Record<NotificationType, string>> = {
  process_approved: 'border-emerald-500 bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400',
  process_rejected: 'border-red-500 bg-red-50 text-red-600 dark:bg-red-950 dark:text-red-400',
  process_returned: 'border-amber-500 bg-amber-50 text-amber-600 dark:bg-amber-950 dark:text-amber-400',
  process_created: 'border-blue-500 bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400',
  task_completed: 'border-emerald-500 bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400',
  task_overdue: 'border-red-500 bg-red-50 text-red-600 dark:bg-red-950 dark:text-red-400',
  task_assigned: 'border-blue-500 bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400',
  task_updated: 'border-slate-500 bg-slate-50 text-slate-600 dark:bg-slate-900 dark:text-slate-400',
  task_comment: 'border-sky-500 bg-sky-50 text-sky-600 dark:bg-sky-950 dark:text-sky-400',
  chat_message: 'border-sky-500 bg-sky-50 text-sky-600 dark:bg-sky-950 dark:text-sky-400',
  comment_mention: 'border-violet-500 bg-violet-50 text-violet-600 dark:bg-violet-950 dark:text-violet-400',
  chat_mention: 'border-violet-500 bg-violet-50 text-violet-600 dark:bg-violet-950 dark:text-violet-400',
}

const DEFAULT_DOT_STYLE = 'border-muted-foreground/40 bg-muted text-muted-foreground'

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

const TYPE_BADGE_STYLES: Partial<Record<NotificationType, string>> = {
  process_approved: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
  process_rejected: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300',
  process_returned: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
  task_overdue: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300',
  comment_mention: 'bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300',
  chat_mention: 'bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300',
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function NotificationTimelineSkeleton() {
  return (
    <div className="space-y-10">
      {[1, 2].map(g => (
        <div key={g} className="space-y-4">
          <Skeleton className="h-5 w-28 rounded-full" />
          <div className="space-y-6 pl-6">
            {[1, 2, 3].map(i => (
              <div key={i} className="flex gap-4">
                <Skeleton className="h-8 w-8 rounded-full shrink-0" />
                <div className="flex-1 space-y-3">
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-3 w-16 ml-auto" />
                  </div>
                  <Skeleton className="h-3.5 w-full max-w-md" />
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-5 w-5 rounded-full" />
                    <Skeleton className="h-3 w-24" />
                    <Skeleton className="h-5 w-20 rounded-full" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

function EmptyState({ tab }: { tab: 'all' | 'unread' }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="rounded-full bg-muted/50 p-6 mb-6">
        {tab === 'unread' ? (
          <BellOff className="h-10 w-10 text-muted-foreground/40" />
        ) : (
          <Inbox className="h-10 w-10 text-muted-foreground/40" />
        )}
      </div>
      <h3 className="text-lg font-semibold text-foreground mb-1">
        {tab === 'unread' ? 'Tudo em dia!' : 'Sem notificações'}
      </h3>
      <p className="text-sm text-muted-foreground max-w-xs">
        {tab === 'unread'
          ? 'Não tem notificações por ler. Bom trabalho!'
          : 'As suas notificações sobre processos, tarefas e menções aparecerão aqui.'}
      </p>
    </div>
  )
}

function NotificationTimelineItem({
  notif,
  onClick,
}: {
  notif: Notification
  onClick: (notif: Notification) => void
}) {
  const Icon = NOTIFICATION_ICONS[notif.notification_type] ?? Bell
  const dotStyle = NOTIFICATION_DOT_STYLES[notif.notification_type] ?? DEFAULT_DOT_STYLE
  const badgeStyle = TYPE_BADGE_STYLES[notif.notification_type]
  const initials = notif.sender?.commercial_name
    ?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() ?? '?'

  return (
    <TimelineItem>
      <TimelineDot
        asChild
        className={cn(
          '!size-8 !border-[1.5px] transition-transform duration-200',
          dotStyle,
        )}
      >
        <div>
          <Icon className="h-3.5 w-3.5" />
        </div>
      </TimelineDot>
      <TimelineConnector />
      <TimelineContent className="pb-1 -mt-0.5">
        <button
          onClick={() => onClick(notif)}
          className={cn(
            'group relative flex w-full gap-3 rounded-xl p-3.5 text-left transition-all duration-200',
            'hover:bg-accent/50 hover:shadow-sm',
            !notif.is_read && 'bg-primary/[0.04] ring-1 ring-primary/10',
          )}
        >
          {/* Unread dot indicator */}
          {!notif.is_read && (
            <span className="absolute top-3.5 right-3.5 flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary/60 opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-primary" />
            </span>
          )}

          {/* Sender avatar */}
          <Avatar className="h-9 w-9 shrink-0 ring-2 ring-background">
            {notif.sender?.profile?.profile_photo_url ? (
              <AvatarImage src={notif.sender.profile.profile_photo_url} />
            ) : null}
            <AvatarFallback className="text-[0.65rem] font-medium">{initials}</AvatarFallback>
          </Avatar>

          {/* Content */}
          <div className="flex-1 min-w-0 space-y-1">
            {/* Title + Time */}
            <div className="flex items-start justify-between gap-3 pr-4">
              <p className={cn(
                'text-sm leading-snug',
                !notif.is_read ? 'font-semibold text-foreground' : 'text-foreground/90',
              )}>
                {notif.title}
              </p>
              <time
                className="shrink-0 text-[0.7rem] text-muted-foreground/70 tabular-nums whitespace-nowrap pt-0.5"
                dateTime={notif.created_at}
              >
                {formatDistanceToNow(new Date(notif.created_at), {
                  addSuffix: true,
                  locale: pt,
                })}
              </time>
            </div>

            {/* Body */}
            {notif.body && (
              <p className="text-[0.8rem] text-muted-foreground leading-relaxed line-clamp-2">
                {notif.body}
              </p>
            )}

            {/* Footer: sender name + type badge */}
            <div className="flex items-center gap-2 pt-0.5">
              {notif.sender?.commercial_name && (
                <span className="text-xs text-muted-foreground/60 truncate max-w-[140px]">
                  {notif.sender.commercial_name}
                </span>
              )}
              {notif.sender?.commercial_name && (
                <span className="text-muted-foreground/30">·</span>
              )}
              <Badge
                variant="secondary"
                className={cn(
                  'px-1.5 py-0 h-[18px] text-[0.6rem] font-medium rounded-full border-0',
                  badgeStyle,
                )}
              >
                {TYPE_LABELS[notif.notification_type] ?? notif.notification_type}
              </Badge>
            </div>
          </div>
        </button>
      </TimelineContent>
    </TimelineItem>
  )
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

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

  // ---- Data Fetching ----

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

  // ---- Actions ----

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

  // ---- Render ----

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      {/* ── Header ── */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
            <Bell className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">Notificações</h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              {unreadCount > 0
                ? `${unreadCount} por ler`
                : 'Sem notificações por ler'}
            </p>
          </div>
        </div>
        {unreadCount > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleMarkAllAsRead}
            className="gap-1.5 text-xs"
          >
            <CheckCheck className="h-3.5 w-3.5" />
            Marcar tudo como lido
          </Button>
        )}
      </div>

      {/* ── Filters ── */}
      <div className="flex items-center gap-3 flex-wrap">
        <Tabs value={tab} onValueChange={(v) => setTab(v as 'all' | 'unread')}>
          <TabsList className="h-9">
            <TabsTrigger value="all" className="text-xs px-3">
              Todas
            </TabsTrigger>
            <TabsTrigger value="unread" className="text-xs px-3 gap-1.5">
              Não lidas
              {unreadCount > 0 && (
                <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[0.6rem] font-semibold text-primary-foreground leading-none">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[190px] h-9 text-xs">
            <Filter className="mr-1.5 h-3 w-3 text-muted-foreground" />
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

      {/* ── Content ── */}
      {isLoading ? (
        <NotificationTimelineSkeleton />
      ) : notifications.length === 0 ? (
        <EmptyState tab={tab} />
      ) : (
        <div className="space-y-10">
          {groups.map((group) => (
            <section key={group.label}>
              {/* Date group header */}
              <div className="flex items-center gap-3">
                <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  {group.label}
                </span>
                <div className="flex-1 h-px bg-border" />
                <span className="text-[0.65rem] text-muted-foreground/50 tabular-nums">
                  {group.items.length} {group.items.length === 1 ? 'notificação' : 'notificações'}
                </span>
              </div>

              {/* Timeline */}
              <Timeline
                className="[--timeline-dot-size:2rem] [--timeline-connector-thickness:2px]"
              >
                {group.items.map((notif) => (
                  <NotificationTimelineItem
                    key={notif.id}
                    notif={notif}
                    onClick={handleClick}
                  />
                ))}
              </Timeline>
            </section>
          ))}

          {/* Load more */}
          {hasMore && (
            <div className="flex justify-center pt-4 pb-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleLoadMore}
                disabled={isLoadingMore}
                className="gap-2 text-xs"
              >
                {isLoadingMore ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
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
