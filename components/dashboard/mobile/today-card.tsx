'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import { format, parseISO, isSameDay } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { ListTodo, Calendar, CalendarX } from 'lucide-react'
import { useCalendarEvents } from '@/hooks/use-calendar-events'
import type { CalendarEvent } from '@/types/calendar'
import type { TaskWithRelations } from '@/types/task'
import { cn } from '@/lib/utils'

interface TodayCardProps {
  userId: string
  fillViewport?: boolean
}

const PRIORITY_STYLES: Record<number, string> = {
  1: 'bg-red-500',
  2: 'bg-orange-500',
  3: 'bg-blue-500',
  4: 'bg-muted-foreground/40',
}

export function TodayCard({ userId, fillViewport }: TodayCardProps) {
  const { start, end } = useMemo(() => {
    const now = new Date()
    const s = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0)
    const e = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59)
    return { start: s, end: e }
  }, [])

  const { events, tasks, isLoading } = useCalendarEvents({ start, end, userId })

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
      (a, b) => parseISO(a.start_date).getTime() - parseISO(b.start_date).getTime(),
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
        'rounded-2xl shadow-[0_12px_30px_-8px_rgba(0,0,0,0.18),0_4px_10px_-6px_rgba(0,0,0,0.12)] p-4 gap-3 flex flex-col',
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
              <div className="space-y-1.5">
                <p className="px-1 text-[10px] font-medium text-muted-foreground/70 uppercase tracking-wider">
                  Tarefas ({dayTasks.length})
                </p>
                {dayTasks.map((task) => (
                  <TaskRow key={task.id} task={task} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </Card>
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

function TaskRow({ task }: { task: TaskWithRelations }) {
  const dot = PRIORITY_STYLES[task.priority] || PRIORITY_STYLES[4]
  return (
    <Link
      href="/dashboard/tarefas"
      className="flex items-center gap-3 rounded-lg p-2 hover:bg-muted/40 transition-colors"
    >
      <span
        className={cn('h-2 w-2 rounded-full shrink-0', dot)}
        aria-hidden
      />
      <div className="flex-1 min-w-0">
        <p
          className={cn(
            'text-sm font-medium truncate',
            task.is_completed && 'line-through text-muted-foreground',
          )}
        >
          {task.title}
        </p>
      </div>
      {task.due_date && (
        <span className="text-[11px] text-muted-foreground tabular-nums shrink-0">
          {format(parseISO(task.due_date), 'HH:mm')}
        </span>
      )}
    </Link>
  )
}
