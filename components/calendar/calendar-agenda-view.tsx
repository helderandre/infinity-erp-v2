'use client'

import { useMemo } from 'react'
import type { CalendarEvent, CalendarCategory } from '@/types/calendar'
import { CALENDAR_CATEGORY_COLORS, CALENDAR_CATEGORY_LABELS } from '@/types/calendar'
import {
  format,
  parseISO,
  isToday,
  isTomorrow,
  isSameDay,
  startOfMonth,
  endOfMonth,
  addHours,
} from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { cn } from '@/lib/utils'
import { CalendarX, CheckCircle2, Clock } from 'lucide-react'

interface CalendarAgendaViewProps {
  currentDate: Date
  events: CalendarEvent[]
  onEventClick: (event: CalendarEvent) => void
}

const TASK_CATEGORIES: CalendarCategory[] = [
  'process_task', 'process_subtask', 'reminder',
  'lead_followup', 'contract_expiry', 'lead_expiry',
]

function isTaskEvent(event: CalendarEvent): boolean {
  if (event.item_type === 'task') return true
  return TASK_CATEGORIES.includes(event.category)
}

export function CalendarAgendaView({
  currentDate,
  events,
  onEventClick,
}: CalendarAgendaViewProps) {
  const groupedByDay = useMemo(() => {
    const monthStart = startOfMonth(currentDate)
    const monthEnd = endOfMonth(currentDate)

    const filtered = events
      .filter((e) => {
        const d = parseISO(e.start_date)
        return d >= monthStart && d <= monthEnd
      })
      .sort((a, b) => parseISO(a.start_date).getTime() - parseISO(b.start_date).getTime())

    const groups: { date: Date; events: CalendarEvent[] }[] = []
    for (const event of filtered) {
      const eventDate = parseISO(event.start_date)
      const last = groups[groups.length - 1]
      if (last && isSameDay(last.date, eventDate)) {
        last.events.push(event)
      } else {
        groups.push({ date: eventDate, events: [event] })
      }
    }
    return groups
  }, [events, currentDate])

  if (groupedByDay.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <CalendarX className="h-10 w-10 mb-3 opacity-40" />
        <p className="text-sm">Sem eventos neste mês.</p>
      </div>
    )
  }

  return (
    <div className="divide-y divide-border">
      {groupedByDay.map(({ date, events: dayEvents }, groupIdx) => {
        const today = isToday(date)
        const tomorrow = isTomorrow(date)
        const dayLabel = format(date, "EEEE, d 'de' MMMM", { locale: ptBR })
        const capitalizedDay = dayLabel.charAt(0).toUpperCase() + dayLabel.slice(1)

        // Split into tasks and timed events
        const tasks = dayEvents.filter(isTaskEvent)
        const timedEvents = dayEvents.filter((e) => !isTaskEvent(e))

        return (
          <div key={date.toISOString()} className={cn(groupIdx > 0 && 'pt-1')}>
            {/* Day header */}
            <div className={cn(
              'sticky top-0 z-10 flex items-center gap-3 px-3 py-2.5 sm:px-4 sm:py-3 bg-muted/60 backdrop-blur-sm border-b',
              today && 'bg-primary/10',
            )}>
              <div className={cn(
                'flex h-10 w-10 sm:h-11 sm:w-11 items-center justify-center rounded-full text-sm sm:text-base font-bold shrink-0',
                today ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground',
              )}>
                {format(date, 'd')}
              </div>
              <div>
                <p className={cn(
                  'text-sm sm:text-base font-semibold',
                  today && 'text-primary',
                )}>
                  {today ? 'Hoje' : tomorrow ? 'Amanhã' : capitalizedDay}
                </p>
                <p className="text-[10px] sm:text-xs text-muted-foreground">
                  {dayEvents.length} {dayEvents.length === 1 ? 'evento' : 'eventos'}
                </p>
              </div>
            </div>

            {/* Timed events */}
            {timedEvents.length > 0 && (
              <div className="divide-y divide-border/50">
                {timedEvents.map((event) => {
                  const colors = CALENDAR_CATEGORY_COLORS[event.category]
                  const categoryLabel = CALENDAR_CATEGORY_LABELS[event.category] ?? event.category
                  const eventDate = parseISO(event.start_date)

                  return (
                    <div
                      key={event.id}
                      className="flex items-start gap-3 px-3 py-3 sm:px-4 hover:bg-muted/30 transition-colors cursor-pointer"
                      onClick={() => onEventClick(event)}
                    >
                      {/* Color bar */}
                      <div className={cn('w-1 self-stretch rounded-full shrink-0', colors?.dot || 'bg-primary')} />

                      {/* Time */}
                      <div className="w-12 sm:w-14 shrink-0 pt-0.5">
                        {event.all_day ? (
                          <span className="text-[10px] sm:text-xs text-muted-foreground">Todo dia</span>
                        ) : (
                          <div className="flex flex-col">
                            <span className="text-xs sm:text-sm font-semibold tabular-nums">
                              {format(eventDate, 'HH:mm')}
                            </span>
                            <span className="text-[10px] text-muted-foreground tabular-nums">
                              {event.end_date
                                ? format(parseISO(event.end_date), 'HH:mm')
                                : format(addHours(eventDate, 1), 'HH:mm')}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <Clock className="h-3 w-3 text-muted-foreground shrink-0" />
                          <p className="text-sm font-medium truncate">{event.title}</p>
                        </div>
                        {event.description && (
                          <p className="text-xs text-muted-foreground truncate mt-0.5 ml-[18px]">
                            {event.description}
                          </p>
                        )}
                        <div className="flex items-center gap-2 mt-1 ml-[18px]">
                          <span className={cn(
                            'inline-flex items-center rounded-full px-1.5 py-0.5 text-[9px] sm:text-[10px] font-medium',
                            colors?.bg || 'bg-muted',
                            colors?.text || 'text-muted-foreground',
                          )}>
                            {categoryLabel}
                          </span>
                          {event.user_name && (
                            <span className="text-[10px] text-muted-foreground">{event.user_name}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Tasks */}
            {tasks.length > 0 && (
              <div className="divide-y divide-border/50">
                {timedEvents.length > 0 && tasks.length > 0 && (
                  <div className="px-3 sm:px-4 py-1.5 bg-muted/20">
                    <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Tarefas</p>
                  </div>
                )}
                {tasks.map((event) => {
                  const colors = CALENDAR_CATEGORY_COLORS[event.category]
                  const categoryLabel = CALENDAR_CATEGORY_LABELS[event.category] ?? event.category
                  const eventDate = parseISO(event.start_date)
                  const isCompleted = event.status === 'completed'

                  return (
                    <div
                      key={event.id}
                      className="flex items-start gap-3 px-3 py-2.5 sm:px-4 hover:bg-muted/30 transition-colors cursor-pointer"
                      onClick={() => onEventClick(event)}
                    >
                      {/* Checkbox icon */}
                      <CheckCircle2 className={cn(
                        'h-4 w-4 sm:h-5 sm:w-5 shrink-0 mt-0.5',
                        isCompleted ? 'text-emerald-500' : 'text-muted-foreground/40',
                      )} />

                      {/* Time (if not all day) */}
                      <div className="w-12 sm:w-14 shrink-0 pt-0.5">
                        {event.all_day ? (
                          <span className="text-[10px] sm:text-xs text-muted-foreground">—</span>
                        ) : (
                          <span className="text-xs sm:text-sm tabular-nums text-muted-foreground">
                            {format(eventDate, 'HH:mm')}
                          </span>
                        )}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <p className={cn(
                          'text-sm truncate',
                          isCompleted && 'line-through text-muted-foreground',
                        )}>
                          {event.title}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={cn(
                            'inline-flex items-center rounded-full px-1.5 py-0.5 text-[9px] sm:text-[10px] font-medium',
                            colors?.bg || 'bg-muted',
                            colors?.text || 'text-muted-foreground',
                          )}>
                            {categoryLabel}
                          </span>
                          {event.user_name && (
                            <span className="text-[10px] text-muted-foreground">{event.user_name}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
