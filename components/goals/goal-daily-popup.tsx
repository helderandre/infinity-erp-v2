'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetDescription,
  SheetHeader,
} from '@/components/ui/sheet'
import {
  Target,
  Phone,
  MapPin,
  MessageSquare,
  RotateCcw,
  ArrowRight,
  Calendar as CalendarIcon,
  CheckCircle2,
  Circle,
  Clock,
  ListTodo,
  Loader2,
} from 'lucide-react'
import { formatCurrency } from '@/lib/constants'
import { cn } from '@/lib/utils'
import { useIsMobile } from '@/hooks/use-mobile'
import { useUser } from '@/hooks/use-user'
import type { GoalStatus } from '@/types/goal'
import type { CalendarEvent } from '@/types/calendar'
import { CalendarEventDetail } from '@/components/calendar/calendar-event-detail'
import { TaskDetailSheet } from '@/components/tasks/task-detail-sheet'

interface DailyAction {
  key: string
  label: string
  target: number
  done: number
  status: GoalStatus
}

interface DailyGoalData {
  hasGoal: boolean
  goalId?: string
  dailyRevenue?: number
  weeklyRevenue?: number
  annualTarget?: number
  realizedToday?: number
  overallStatus?: GoalStatus
  projectionMessage?: string
  actions?: DailyAction[]
}

interface AgendaTask {
  id: string
  title: string
  due_date: string | null
  priority: number | null
  is_completed: boolean
}

interface AgendaEvent {
  id: string
  title: string
  start_date: string
  end_date: string | null
  category: string | null
  all_day: boolean | null
  item_type: 'event' | 'task' | null
}

const ACTION_ICONS: Record<string, React.ElementType> = {
  leads: MessageSquare,
  calls: Phone,
  visits: MapPin,
  follow_ups: RotateCcw,
}

const STATUS_STYLES: Record<GoalStatus, { dot: string; bar: string }> = {
  green: { dot: 'bg-emerald-500', bar: 'bg-emerald-500' },
  orange: { dot: 'bg-amber-500', bar: 'bg-amber-500' },
  red: { dot: 'bg-red-500', bar: 'bg-red-500' },
}

const SESSION_KEY = 'goal-daily-popup-dismissed'

type TabKey = 'objetivos' | 'agenda'

export function GoalDailyPopup() {
  const isMobile = useIsMobile()
  const { user } = useUser()
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<TabKey>('objetivos')
  const [data, setData] = useState<DailyGoalData | null>(null)
  const [tasks, setTasks] = useState<AgendaTask[]>([])
  const [overdueTasks, setOverdueTasks] = useState<AgendaTask[]>([])
  const [events, setEvents] = useState<AgendaEvent[]>([])
  const [agendaLoading, setAgendaLoading] = useState(false)
  const [agendaLoaded, setAgendaLoaded] = useState(false)
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null)
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)

  useEffect(() => {
    const dismissed = sessionStorage.getItem(SESSION_KEY)
    const today = new Date().toISOString().split('T')[0]
    if (dismissed === today) return

    async function fetchDaily() {
      try {
        const res = await fetch('/api/goals/my-daily')
        if (!res.ok) return
        const json: DailyGoalData = await res.json()
        if (json.hasGoal && json.actions && json.actions.length > 0) {
          setData(json)
          setTimeout(() => setOpen(true), 800)
        }
      } catch {
        // silently fail
      }
    }

    fetchDaily()
  }, [])

  // Lazy-load the agenda when the user picks that tab
  useEffect(() => {
    if (tab !== 'agenda' || agendaLoaded || !user?.id) return
    let cancelled = false
    setAgendaLoading(true)

    const start = new Date()
    start.setHours(0, 0, 0, 0)
    const end = new Date()
    end.setHours(23, 59, 59, 999)

    const tasksParams = new URLSearchParams({
      assigned_to: user.id,
      due_from: start.toISOString(),
      due_to: end.toISOString(),
      is_completed: 'false',
      per_page: '50',
    })
    // Pending work that isn't planned for today — overdue tasks (due_date in
    // the past, still open). Surfaced as a "Por fazer" group below today.
    const overdueParams = new URLSearchParams({
      assigned_to: user.id,
      overdue: 'true',
      per_page: '50',
    })
    const eventsParams = new URLSearchParams({
      start: start.toISOString(),
      end: end.toISOString(),
      user_id: user.id,
    })

    Promise.all([
      fetch(`/api/tasks?${tasksParams.toString()}`).then((r) => (r.ok ? r.json() : { data: [] })),
      fetch(`/api/tasks?${overdueParams.toString()}`).then((r) => (r.ok ? r.json() : { data: [] })),
      fetch(`/api/calendar/events?${eventsParams.toString()}`).then((r) => (r.ok ? r.json() : { data: [] })),
    ])
      .then(([tasksRes, overdueRes, eventsRes]) => {
        if (cancelled) return
        setTasks(tasksRes.data || [])
        // Drop any overdue rows that are also in today's list (defensive — the
        // overdue filter excludes today by definition, but APIs may shift).
        const todayIds = new Set<string>((tasksRes.data || []).map((t: AgendaTask) => t.id))
        setOverdueTasks(((overdueRes.data || []) as AgendaTask[]).filter((t) => !todayIds.has(t.id)))
        setEvents(eventsRes.data || [])
      })
      .catch(() => {
        if (cancelled) return
      })
      .finally(() => {
        if (cancelled) return
        setAgendaLoading(false)
        setAgendaLoaded(true)
      })

    return () => {
      cancelled = true
    }
  }, [tab, agendaLoaded, user?.id])

  function handleDismiss() {
    const today = new Date().toISOString().split('T')[0]
    sessionStorage.setItem(SESSION_KEY, today)
    setOpen(false)
  }

  // Sort agenda chronologically (events by start, tasks by due_date), tasks
  // without a time go to the end.
  const agendaItems = useMemo(() => {
    const eventItems = events.map((e) => ({
      kind: 'event' as const,
      id: e.id,
      title: e.title,
      time: e.start_date,
      end: e.end_date,
      allDay: e.all_day ?? false,
      category: e.category,
    }))
    const taskItems = tasks
      .filter((t) => !t.is_completed)
      .map((t) => ({
        kind: 'task' as const,
        id: t.id,
        title: t.title,
        time: t.due_date,
        priority: t.priority ?? 1,
      }))
    return [...eventItems, ...taskItems].sort((a, b) => {
      if (!a.time) return 1
      if (!b.time) return -1
      return new Date(a.time).getTime() - new Date(b.time).getTime()
    })
  }, [events, tasks])

  // Overdue items shown as a "Por fazer" section below today's list. Sorted
  // by oldest first so the most-stale gets the user's attention.
  const overdueItems = useMemo(() => {
    return overdueTasks
      .filter((t) => !t.is_completed)
      .map((t) => ({
        kind: 'task' as const,
        id: t.id,
        title: t.title,
        time: t.due_date,
        priority: t.priority ?? 1,
      }))
      .sort((a, b) => {
        if (!a.time) return 1
        if (!b.time) return -1
        return new Date(a.time).getTime() - new Date(b.time).getTime()
      })
  }, [overdueTasks])

  if (!data || !data.hasGoal) return null

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) handleDismiss() }}>
      <SheetContent
        side={isMobile ? 'bottom' : 'right'}
        className={cn(
          'p-0 gap-0 flex flex-col overflow-hidden border-border/40 shadow-2xl bg-background',
          isMobile
            ? 'data-[side=bottom]:h-[85dvh] rounded-t-3xl'
            : 'w-full data-[side=right]:sm:max-w-[540px] sm:rounded-l-3xl',
        )}
      >
        {isMobile && (
          <div className="absolute left-1/2 top-2.5 -translate-x-1/2 h-1 w-10 rounded-full bg-muted-foreground/25" />
        )}

        {/* Header */}
        <SheetHeader className={cn('shrink-0 px-6 pb-4', isMobile ? 'pt-8' : 'pt-10')}>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-foreground/5">
              <Target className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <SheetTitle className="text-[22px] font-semibold leading-tight tracking-tight text-left">
                Hoje
              </SheetTitle>
              <SheetDescription className="text-xs text-muted-foreground capitalize">
                {new Date().toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long' })}
              </SheetDescription>
            </div>
          </div>

          {/* Pill tabs */}
          <div className="mt-4 inline-flex w-fit p-0.5 rounded-full bg-muted/60 border border-border/30">
            <button
              type="button"
              onClick={() => setTab('objetivos')}
              className={cn(
                'inline-flex items-center gap-1.5 px-4 h-7 rounded-full text-xs font-medium transition-all',
                tab === 'objetivos'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <Target className="h-3.5 w-3.5" />
              Objetivos
            </button>
            <button
              type="button"
              onClick={() => setTab('agenda')}
              className={cn(
                'inline-flex items-center gap-1.5 px-4 h-7 rounded-full text-xs font-medium transition-all',
                tab === 'agenda'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <CalendarIcon className="h-3.5 w-3.5" />
              Agenda
            </button>
          </div>
        </SheetHeader>

        {/* Content */}
        <div className="flex-1 min-h-0 overflow-y-auto px-6 pb-2">
          {tab === 'objetivos' ? (
            <ObjetivosTab data={data} />
          ) : (
            <AgendaTab
              loading={agendaLoading}
              items={agendaItems}
              overdueItems={overdueItems}
              onItemClick={(item) => {
                if (item.kind === 'task') {
                  setSelectedTaskId(item.id)
                } else {
                  const full = events.find((e) => e.id === item.id)
                  if (full) setSelectedEvent(full as unknown as CalendarEvent)
                }
              }}
            />
          )}
        </div>

        {/* Footer */}
        <div className="shrink-0 px-6 py-3 border-t flex items-center justify-between gap-2">
          <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={handleDismiss}>
            Fechar
          </Button>
          {tab === 'objetivos' ? (
            <Button size="sm" className="rounded-full bg-foreground text-background hover:opacity-90" asChild onClick={handleDismiss}>
              <Link href={`/dashboard/objetivos/${data.goalId}`}>
                Ver Dashboard
                <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
              </Link>
            </Button>
          ) : (
            <Button size="sm" className="rounded-full bg-foreground text-background hover:opacity-90" asChild onClick={handleDismiss}>
              <Link href="/dashboard/calendar">
                Ver agenda
                <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
              </Link>
            </Button>
          )}
        </div>
      </SheetContent>

      {/* Nested sheets — open over the popup when an agenda item is clicked. */}
      <CalendarEventDetail
        event={selectedEvent}
        open={selectedEvent !== null}
        onClose={() => setSelectedEvent(null)}
      />
      <TaskDetailSheet
        taskId={selectedTaskId}
        open={selectedTaskId !== null}
        onOpenChange={(o) => { if (!o) setSelectedTaskId(null) }}
      />
    </Sheet>
  )
}

// ─── Tabs ────────────────────────────────────────────────────────────────────

function ObjetivosTab({ data }: { data: DailyGoalData }) {
  return (
    <div className="space-y-4 py-2">
      {/* Revenue summary */}
      <div className="rounded-2xl border border-border/40 bg-muted/20 px-4 py-3 flex items-end justify-between">
        <div>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Objetivo diário</p>
          <p className="text-2xl font-bold tabular-nums">{formatCurrency(data.dailyRevenue || 0)}</p>
        </div>
        <div className="text-right">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Semanal</p>
          <p className="text-sm font-semibold text-muted-foreground tabular-nums">
            {formatCurrency(data.weeklyRevenue || 0)}
          </p>
        </div>
      </div>

      {/* Actions */}
      <div className="space-y-2">
        <p className="text-[10px] uppercase tracking-wider font-medium text-muted-foreground">
          Ações necessárias hoje
        </p>
        {data.actions?.map((action) => {
          const Icon = ACTION_ICONS[action.key] || MessageSquare
          const style = STATUS_STYLES[action.status]
          const pct = action.target > 0 ? Math.min((action.done / action.target) * 100, 100) : 0
          const isDone = action.done >= action.target

          return (
            <div key={action.key} className="rounded-xl border border-border/40 bg-card px-3 py-2.5 space-y-1.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div
                    className={cn(
                      'flex h-7 w-7 items-center justify-center rounded-lg',
                      isDone ? 'bg-emerald-500/15' : 'bg-muted/50',
                    )}
                  >
                    <Icon className={cn('h-3.5 w-3.5', isDone ? 'text-emerald-600' : 'text-muted-foreground')} />
                  </div>
                  <span className="text-sm font-medium">{action.label}</span>
                </div>
                <span className="text-sm tabular-nums font-bold">
                  {action.done}
                  <span className="text-muted-foreground font-normal">/{action.target}</span>
                </span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-muted/50 overflow-hidden">
                <div
                  className={cn('h-full rounded-full transition-all duration-500', style.bar)}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          )
        })}
      </div>

      {data.projectionMessage && (
        <p className="rounded-xl border border-dashed border-border/30 bg-muted/10 px-3 py-2 text-xs text-muted-foreground leading-relaxed">
          {data.projectionMessage}
        </p>
      )}
    </div>
  )
}

type AgendaItem =
  | { kind: 'event'; id: string; title: string; time: string; end: string | null; allDay: boolean; category: string | null }
  | { kind: 'task'; id: string; title: string; time: string | null; priority: number }

function AgendaTab({
  loading, items, overdueItems, onItemClick,
}: {
  loading: boolean
  items: AgendaItem[]
  overdueItems: AgendaItem[]
  onItemClick: (item: AgendaItem) => void
}) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    )
  }
  if (items.length === 0 && overdueItems.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted/40 mb-3">
          <CalendarIcon className="h-5 w-5 text-muted-foreground" />
        </div>
        <p className="text-sm font-medium">Sem nada agendado para hoje</p>
        <p className="text-xs text-muted-foreground mt-1 max-w-xs">
          Não há tarefas nem eventos atribuídos a si com data de hoje.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4 py-2">
      {/* Hoje */}
      {items.length > 0 ? (
        <div className="space-y-1.5">
          <p className="text-[10px] uppercase tracking-wider font-medium text-muted-foreground px-1">
            Hoje
          </p>
          {items.map((item) => (
            <AgendaRow
              key={`${item.kind}-${item.id}`}
              item={item}
              onClick={() => onItemClick(item)}
            />
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground px-1">
          Sem nada agendado para hoje.
        </p>
      )}

      {/* Por fazer (atrasadas) */}
      {overdueItems.length > 0 && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between px-1">
            <p className="text-[10px] uppercase tracking-wider font-medium text-red-600 dark:text-red-400">
              Por fazer
            </p>
            <span className="text-[10px] text-muted-foreground tabular-nums">
              {overdueItems.length} em atraso
            </span>
          </div>
          {overdueItems.map((item) => (
            <AgendaRow
              key={`overdue-${item.kind}-${item.id}`}
              item={item}
              onClick={() => onItemClick(item)}
              overdue
            />
          ))}
        </div>
      )}
    </div>
  )
}

function AgendaRow({ item, onClick, overdue }: { item: AgendaItem; onClick: () => void; overdue?: boolean }) {
  const time = item.time ? formatTime(item.time) : '—'
  const dateLabel = overdue && item.time ? formatRelativeDate(item.time) : null
  const Icon = item.kind === 'task' ? ListTodo : CalendarIcon
  const tone = overdue
    ? 'bg-red-500/10 text-red-700 dark:text-red-300'
    : item.kind === 'task'
      ? 'bg-amber-500/10 text-amber-700 dark:text-amber-300'
      : 'bg-blue-500/10 text-blue-700 dark:text-blue-300'

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'w-full text-left flex items-start gap-3 rounded-xl border bg-card px-3 py-2.5 transition-all hover:border-border hover:bg-muted/40 hover:shadow-[0_2px_12px_-6px_rgb(0_0_0_/_0.1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        overdue ? 'border-red-200/70 dark:border-red-900/50' : 'border-border/40',
      )}
    >
      <div className={cn('flex h-7 w-7 shrink-0 items-center justify-center rounded-lg', tone)}>
        <Icon className="h-3.5 w-3.5" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{item.title}</p>
        <div className="flex items-center gap-2 mt-0.5 text-[11px] text-muted-foreground">
          {overdue && dateLabel ? (
            <span className="inline-flex items-center gap-1 tabular-nums text-red-600 dark:text-red-400">
              <Clock className="h-3 w-3" />
              {dateLabel}
            </span>
          ) : item.kind === 'event' && item.allDay ? (
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3 w-3" />
              Dia inteiro
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 tabular-nums">
              <Clock className="h-3 w-3" />
              {time}
            </span>
          )}
          {item.kind === 'event' && item.category && (
            <span className="capitalize">· {item.category}</span>
          )}
          {item.kind === 'task' && item.priority >= 3 && (
            <span className="text-red-600 dark:text-red-400">· Prioridade alta</span>
          )}
        </div>
      </div>
      {item.kind === 'task' ? (
        <Circle className="h-4 w-4 text-muted-foreground/40 shrink-0 mt-0.5" />
      ) : (
        <CheckCircle2 className="h-4 w-4 text-muted-foreground/30 shrink-0 mt-0.5" />
      )}
    </button>
  )
}

function formatRelativeDate(iso: string): string {
  try {
    const d = new Date(iso)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const target = new Date(d)
    target.setHours(0, 0, 0, 0)
    const diffMs = today.getTime() - target.getTime()
    const days = Math.round(diffMs / (1000 * 60 * 60 * 24))
    if (days === 1) return 'Ontem'
    if (days > 1) return `Há ${days} dias`
    return d.toLocaleDateString('pt-PT', { day: '2-digit', month: 'short' })
  } catch {
    return '—'
  }
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })
  } catch {
    return '—'
  }
}
