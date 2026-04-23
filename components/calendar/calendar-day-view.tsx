'use client'

import type { CalendarEvent } from '@/types/calendar'
import type { TaskWithRelations } from '@/types/task'
import {
  format,
  parseISO,
  isSameDay,
  isToday,
  isTomorrow,
  isYesterday,
} from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { ArrowLeft, CalendarX } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { AgendaEventCard, isTaskEvent } from './calendar-agenda-view'
import { CalendarTaskRow } from './calendar-task-row'

interface CalendarDayViewProps {
  date: Date
  events: CalendarEvent[]
  tasks?: TaskWithRelations[]
  onEventClick: (event: CalendarEvent) => void
  onTaskSelect?: (task: TaskWithRelations) => void
  onTaskToggleComplete?: (id: string, isCompleted: boolean) => void
  onBack: () => void
  backLabel?: string
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

export function CalendarDayView({
  date,
  events,
  tasks,
  onEventClick,
  onTaskSelect,
  onTaskToggleComplete,
  onBack,
  backLabel,
}: CalendarDayViewProps) {
  const dayEvents = events
    .filter((e) => {
      try {
        return isSameDay(parseISO(e.start_date), date)
      } catch {
        return false
      }
    })
    .sort(
      (a, b) => parseISO(a.start_date).getTime() - parseISO(b.start_date).getTime(),
    )

  const legacyTaskEvents = dayEvents.filter(isTaskEvent)
  const timed = dayEvents.filter((e) => !isTaskEvent(e))

  const dayTasks = (tasks ?? [])
    .filter((t) => {
      if (!t.due_date) return false
      try {
        return isSameDay(parseISO(t.due_date), date)
      } catch {
        return false
      }
    })
    .sort((a, b) => {
      // Incomplete before completed, then by priority, then by due time
      if (a.is_completed !== b.is_completed) return a.is_completed ? 1 : -1
      if (a.priority !== b.priority) return a.priority - b.priority
      const aT = a.due_date ? parseISO(a.due_date).getTime() : 0
      const bT = b.due_date ? parseISO(b.due_date).getTime() : 0
      return aT - bT
    })

  const today = isToday(date)
  const tomorrow = isTomorrow(date)
  const yesterday = isYesterday(date)
  const weekday = format(date, 'EEEE', { locale: ptBR })
  const fullDate = format(date, "d 'de' MMMM 'de' yyyy", { locale: ptBR })

  const relativeLabel = today
    ? 'Hoje'
    : tomorrow
    ? 'Amanhã'
    : yesterday
    ? 'Ontem'
    : capitalize(weekday)

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header with back button */}
      <div className="shrink-0 flex items-center gap-3 px-4 sm:px-6 pt-4 pb-3 border-b border-border/40">
        <Button
          variant="ghost"
          size="sm"
          className="rounded-full h-8 px-2.5 text-xs shrink-0"
          onClick={onBack}
        >
          <ArrowLeft className="h-3.5 w-3.5 mr-1.5" />
          {backLabel ?? 'Voltar'}
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2">
            <p className="text-xl font-semibold leading-tight tracking-tight">
              {relativeLabel}
            </p>
            {today && (
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                Agora
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {capitalize(fullDate)} · {dayEvents.length}{' '}
            {dayEvents.length === 1 ? 'evento' : 'eventos'}
            {dayTasks.length > 0 && (
              <>
                {' · '}
                {dayTasks.length}{' '}
                {dayTasks.length === 1 ? 'tarefa' : 'tarefas'}
              </>
            )}
          </p>
        </div>
      </div>

      {/* Events + tasks */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="max-w-2xl mx-auto w-full px-3 sm:px-6 py-4 space-y-1.5">
          {dayEvents.length === 0 && dayTasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <CalendarX className="h-10 w-10 mb-3 opacity-40" />
              <p className="text-sm">Sem eventos neste dia.</p>
            </div>
          ) : (
            <>
              {timed.map((event) => (
                <AgendaEventCard
                  key={event.id}
                  event={event}
                  onClick={() => onEventClick(event)}
                />
              ))}
              {legacyTaskEvents.length > 0 && (
                <>
                  {legacyTaskEvents.map((event) => (
                    <AgendaEventCard
                      key={event.id}
                      event={event}
                      onClick={() => onEventClick(event)}
                    />
                  ))}
                </>
              )}
              {dayTasks.length > 0 && (
                <>
                  <p className="pt-3 px-1.5 text-[10px] font-medium text-muted-foreground/70 uppercase tracking-wider">
                    Tarefas
                  </p>
                  {dayTasks.map((task) => (
                    <CalendarTaskRow
                      key={task.id}
                      task={task}
                      onSelect={(t) => onTaskSelect?.(t)}
                      onToggleComplete={(id, c) =>
                        onTaskToggleComplete?.(id, c)
                      }
                    />
                  ))}
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
