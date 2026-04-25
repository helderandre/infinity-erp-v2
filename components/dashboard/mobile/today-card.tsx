'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { format, parseISO, isSameDay, isToday, isPast } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  ListTodo,
  Calendar,
  CalendarX,
  CheckCircle2,
  Hourglass,
  AlertCircle,
} from 'lucide-react'
import { useCalendarEvents } from '@/hooks/use-calendar-events'
import { CalendarTaskRow } from '@/components/calendar/calendar-task-row'
import type { CalendarEvent } from '@/types/calendar'
import type { TaskWithRelations } from '@/types/task'
import { cn } from '@/lib/utils'
import { TasksBucketSheet, type TaskBucket } from './tasks-bucket-sheet'

interface TodayCardProps {
  userId: string
  fillViewport?: boolean
}

const SOON_DAYS = 7

export function TodayCard({ userId, fillViewport }: TodayCardProps) {
  const { start, end } = useMemo(() => {
    const now = new Date()
    const s = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0)
    const e = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59)
    return { start: s, end: e }
  }, [])

  const { events, tasks, isLoading, toggleTaskComplete } = useCalendarEvents({
    start,
    end,
    userId,
  })

  // Separate fetch for counts across full range (past-due + today + soon)
  const [allTasks, setAllTasks] = useState<TaskWithRelations[]>([])
  const [allLoading, setAllLoading] = useState(true)
  const [bucketOpen, setBucketOpen] = useState<TaskBucket | null>(null)

  useEffect(() => {
    let cancelled = false
    setAllLoading(true)
    const params = new URLSearchParams({
      is_completed: 'false',
      limit: '500',
    })
    fetch(`/api/tasks?${params.toString()}`)
      .then((r) => (r.ok ? r.json() : { data: [] }))
      .then((json) => {
        if (cancelled) return
        let data: TaskWithRelations[] = json.data ?? []
        data = data.filter(
          (t) => t.assigned_to === userId || t.created_by === userId,
        )
        setAllTasks(data)
      })
      .catch(() => {
        if (!cancelled) setAllTasks([])
      })
      .finally(() => {
        if (!cancelled) setAllLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [userId, tasks])

  const { dueToday, dueSoon, pastDue } = useMemo(() => {
    const now = new Date()
    const soonEnd = new Date(now)
    soonEnd.setDate(soonEnd.getDate() + SOON_DAYS)
    let today = 0
    let soon = 0
    let past = 0
    for (const t of allTasks) {
      if (!t.due_date) continue
      let d: Date
      try {
        d = parseISO(t.due_date)
      } catch {
        continue
      }
      if (isToday(d)) today++
      else if (isPast(d)) past++
      else if (d <= soonEnd) soon++
    }
    return { dueToday: today, dueSoon: soon, pastDue: past }
  }, [allTasks])

  const today = new Date()
  const weekday = format(today, 'EEEE', { locale: ptBR })
  const fullDate = format(today, "d 'de' MMMM", { locale: ptBR })
  const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

  const dayEvents = (events ?? [])
    .filter((e) => {
      try {
        return isSameDay(parseISO(e.start_date), today)
      } catch {
        return false
      }
    })
    .sort(
      (a, b) =>
        parseISO(a.start_date).getTime() - parseISO(b.start_date).getTime(),
    )

  const dayTasks = (tasks ?? [])
    .filter((t) => {
      if (!t.due_date) return false
      try {
        return isSameDay(parseISO(t.due_date), today)
      } catch {
        return false
      }
    })
    .sort((a, b) => {
      if (a.is_completed !== b.is_completed) return a.is_completed ? 1 : -1
      if (a.priority !== b.priority) return a.priority - b.priority
      const aT = a.due_date ? parseISO(a.due_date).getTime() : 0
      const bT = b.due_date ? parseISO(b.due_date).getTime() : 0
      return aT - bT
    })

  const isEmpty = !isLoading && dayEvents.length === 0 && dayTasks.length === 0

  return (
    <Card
      className={cn(
        'rounded-2xl border-border/40 bg-background/85 supports-[backdrop-filter]:bg-background/70 backdrop-blur-2xl shadow-[0_12px_30px_-8px_rgba(0,0,0,0.18),0_4px_10px_-6px_rgba(0,0,0,0.12)] p-4 gap-3 flex flex-col',
        fillViewport && 'h-[calc(100dvh-11rem)] min-h-[30rem]',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
            Hoje
          </p>
          <p className="text-lg font-semibold leading-tight truncate">
            {capitalize(weekday)}
          </p>
          <p className="text-[11px] text-muted-foreground truncate">
            {capitalize(fullDate)}
          </p>
        </div>
        <div className="flex gap-1.5 shrink-0">
          <Button
            asChild
            variant="outline"
            size="icon"
            className="h-8 w-8 rounded-full"
            title="Tarefas"
          >
            <Link href="/dashboard/tarefas">
              <ListTodo className="h-4 w-4" />
            </Link>
          </Button>
          <Button
            asChild
            variant="outline"
            size="icon"
            className="h-8 w-8 rounded-full"
            title="Calendário"
          >
            <Link href="/dashboard/calendario">
              <Calendar className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>

      {/* Task summary stat cards */}
      <div className="grid grid-cols-3 gap-2">
        <StatCard
          label="Por fazer hoje"
          count={dueToday}
          icon={CheckCircle2}
          tone="blue"
          loading={allLoading}
          onClick={() => setBucketOpen('today')}
        />
        <StatCard
          label="Em breve"
          count={dueSoon}
          icon={Hourglass}
          tone="amber"
          loading={allLoading}
          onClick={() => setBucketOpen('soon')}
        />
        <StatCard
          label="Em atraso"
          count={pastDue}
          icon={AlertCircle}
          tone="red"
          loading={allLoading}
          onClick={() => setBucketOpen('overdue')}
        />
      </div>

      <div className="flex-1 min-h-0">
        {isLoading ? (
          <div className="space-y-2">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-12 w-full rounded-lg" />
            ))}
          </div>
        ) : isEmpty ? (
          <div className="flex flex-col items-center py-10 text-muted-foreground">
            <CalendarX className="h-8 w-8 mb-2 opacity-40" />
            <p className="text-sm">Sem eventos nem tarefas para hoje.</p>
          </div>
        ) : (
          <div className="space-y-3 h-full overflow-y-auto -mx-1 px-1">
            {dayEvents.length > 0 && (
              <div className="space-y-1.5">
                <p className="px-1 text-[10px] font-medium text-muted-foreground/70 uppercase tracking-wider">
                  Eventos ({dayEvents.length})
                </p>
                {dayEvents.map((event) => (
                  <EventRow key={event.id} event={event} />
                ))}
              </div>
            )}

            {dayTasks.length > 0 && (
              <div className="space-y-1">
                <p className="px-1 text-[10px] font-medium text-muted-foreground/70 uppercase tracking-wider">
                  Tarefas ({dayTasks.length})
                </p>
                {dayTasks.map((task) => (
                  <CalendarTaskRow
                    key={task.id}
                    task={task}
                    onSelect={() => {
                      window.location.href = '/dashboard/tarefas'
                    }}
                    onToggleComplete={toggleTaskComplete}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <TasksBucketSheet
        userId={userId}
        bucket={bucketOpen}
        onOpenChange={(o) => !o && setBucketOpen(null)}
      />
    </Card>
  )
}

function StatCard({
  label,
  count,
  icon: Icon,
  tone,
  loading,
  onClick,
}: {
  label: string
  count: number
  icon: React.ElementType
  tone: 'blue' | 'amber' | 'red'
  loading: boolean
  onClick: () => void
}) {
  const toneClasses = {
    blue: 'bg-sky-50 dark:bg-sky-500/10 border-sky-200/60 dark:border-sky-400/20 text-sky-700 dark:text-sky-300',
    amber:
      'bg-amber-50 dark:bg-amber-500/10 border-amber-200/60 dark:border-amber-400/20 text-amber-700 dark:text-amber-300',
    red: 'bg-red-50 dark:bg-red-500/10 border-red-200/60 dark:border-red-400/20 text-red-700 dark:text-red-300',
  }[tone]

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'w-full text-left relative rounded-2xl border p-2.5 flex flex-col transition-colors hover:brightness-95',
        toneClasses,
      )}
    >
      <div className="flex items-start justify-between gap-1">
        <p className="text-[10px] font-semibold leading-tight">{label}</p>
        <Icon className="h-3.5 w-3.5 shrink-0 opacity-70" />
      </div>
      <div className="mt-auto pt-3 text-2xl font-bold tabular-nums leading-none">
        {loading ? (
          <Skeleton className="h-6 w-8 bg-current/10" />
        ) : (
          count
        )}
      </div>
    </button>
  )
}

function EventRow({ event }: { event: CalendarEvent }) {
  const eventDate = parseISO(event.start_date)
  const allDay = event.all_day

  return (
    <Link
      href="/dashboard/calendario"
      className="flex items-center gap-3 rounded-lg p-2 hover:bg-muted/40 transition-colors"
    >
      <div className="flex flex-col items-center justify-center w-12 shrink-0 rounded-md bg-muted/50 py-1">
        {allDay ? (
          <span className="text-[10px] font-medium text-muted-foreground">
            Todo dia
          </span>
        ) : (
          <span className="text-xs font-semibold tabular-nums">
            {format(eventDate, 'HH:mm')}
          </span>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{event.title}</p>
        {event.location && (
          <p className="text-[11px] text-muted-foreground truncate">
            {event.location}
          </p>
        )}
      </div>
    </Link>
  )
}
