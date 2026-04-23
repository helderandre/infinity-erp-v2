'use client'

import { useMemo } from 'react'
import type { CalendarEvent } from '@/types/calendar'
import type { TaskWithRelations } from '@/types/task'
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  isToday,
  format,
  parseISO,
} from 'date-fns'
import { CalendarEventCard, CALENDAR_EVENT_BORDER_L } from './calendar-event-card'
import { CALENDAR_CATEGORY_COLORS } from '@/types/calendar'
import { CheckCircle2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface CalendarMonthGridProps {
  currentDate: Date
  events: CalendarEvent[]
  tasks?: TaskWithRelations[]
  onEventClick: (event: CalendarEvent) => void
  onDayClick: (date: Date) => void
  onDayNumberClick?: (date: Date) => void
}

const WEEKDAY_LABELS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']
const WEEKDAY_LABELS_SHORT = ['S', 'T', 'Q', 'Q', 'S', 'S', 'D']
const MAX_VISIBLE_EVENTS = 3

export function CalendarMonthGrid({
  currentDate,
  events,
  tasks,
  onEventClick,
  onDayClick,
  onDayNumberClick,
}: CalendarMonthGridProps) {
  const days = useMemo(() => {
    const monthStart = startOfMonth(currentDate)
    const monthEnd = endOfMonth(currentDate)
    const calStart = startOfWeek(monthStart, { weekStartsOn: 1 })
    const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 })
    return eachDayOfInterval({ start: calStart, end: calEnd })
  }, [currentDate])

  const eventsByDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>()
    if (!events?.length) return map
    for (const event of events) {
      try {
        const eventDate = parseISO(event.start_date)
        const key = format(eventDate, 'yyyy-MM-dd')
        const existing = map.get(key) ?? []
        existing.push(event)
        map.set(key, existing)
      } catch {
        // skip events with invalid dates
      }
    }
    return map
  }, [events])

  // Count active (non-completed) tasks per day so each cell can show a
  // compact "X tarefas" pill without listing each one individually.
  const tasksByDay = useMemo(() => {
    const map = new Map<string, number>()
    if (!tasks?.length) return map
    for (const t of tasks) {
      if (!t.due_date || t.is_completed) continue
      try {
        const key = format(parseISO(t.due_date), 'yyyy-MM-dd')
        map.set(key, (map.get(key) ?? 0) + 1)
      } catch {
        // ignore bad dates
      }
    }
    return map
  }, [tasks])

  const weeks = useMemo(() => {
    const result: Date[][] = []
    for (let i = 0; i < days.length; i += 7) {
      result.push(days.slice(i, i + 7))
    }
    return result
  }, [days])

  const MAX_MOBILE_EVENTS = 2

  return (
    <div className="flex flex-col rounded-3xl border border-border/40 overflow-hidden h-full bg-background/50 supports-[backdrop-filter]:bg-background/30 backdrop-blur-md shadow-sm">
      {/* Header row — translucent, minimal */}
      <div className="grid grid-cols-7 border-b border-border/30 bg-background/40 supports-[backdrop-filter]:bg-background/30 backdrop-blur-sm">
        {WEEKDAY_LABELS.map((label, i) => (
          <div
            key={label}
            className="px-1 py-2 sm:py-2.5 text-center text-[10px] sm:text-[11px] font-medium text-muted-foreground/80 tracking-wide sm:px-2"
          >
            <span className="hidden sm:inline">{label}</span>
            <span className="sm:hidden">{WEEKDAY_LABELS_SHORT[i]}</span>
          </div>
        ))}
      </div>

      {/* Weeks — soft dividers, no outer border */}
      {weeks.map((week, weekIdx) => (
        <div
          key={weekIdx}
          className={cn(
            'grid grid-cols-7 flex-1 min-h-0',
            weekIdx > 0 && 'border-t border-border/50',
          )}
        >
          {week.map((day, dayIdx) => {
            const key = format(day, 'yyyy-MM-dd')
            const dayEvents = eventsByDay.get(key) ?? []
            const dayTaskCount = tasksByDay.get(key) ?? 0
            const isCurrentMonth = isSameMonth(day, currentDate)
            const today = isToday(day)
            const extraCount = dayEvents.length - MAX_VISIBLE_EVENTS
            const mobileExtra = dayEvents.length - MAX_MOBILE_EVENTS

            return (
              <div
                key={key}
                className={cn(
                  'p-1 sm:p-1.5 transition-colors cursor-pointer overflow-hidden flex flex-col',
                  'hover:bg-muted/30',
                  dayIdx > 0 && 'border-l border-border/50',
                  !isCurrentMonth && 'opacity-35',
                  today && 'bg-primary/[0.04]',
                )}
                onClick={() => onDayClick(day)}
              >
                {/* Day number */}
                <div className="flex items-center justify-end shrink-0">
                  <button
                    type="button"
                    className={cn(
                      'flex h-6 w-6 sm:h-6 sm:w-6 items-center justify-center rounded-full text-[11px] sm:text-xs font-medium transition-all',
                      today && 'bg-foreground text-background font-semibold shadow-sm',
                      !today && dayEvents.length > 0 && isCurrentMonth && 'text-foreground font-semibold hover:bg-muted/60',
                      !today && dayEvents.length === 0 && isCurrentMonth && 'text-foreground/70 hover:bg-muted/60',
                      !today && !isCurrentMonth && 'text-muted-foreground/50 hover:bg-muted/40',
                    )}
                    onClick={(e) => {
                      e.stopPropagation()
                      onDayNumberClick?.(day)
                    }}
                  >
                    {format(day, 'd')}
                  </button>
                </div>

                {/* Events */}
                <div className="flex-1 min-h-0 mt-0.5 space-y-px sm:space-y-0.5">
                  {/* Desktop: full event cards */}
                  <div className="hidden sm:block space-y-0.5">
                    {dayEvents.slice(0, MAX_VISIBLE_EVENTS).map((event) => (
                      <div
                        key={event.id}
                        onClick={(e) => {
                          e.stopPropagation()
                          onEventClick(event)
                        }}
                      >
                        <CalendarEventCard event={event} compact />
                      </div>
                    ))}
                    {extraCount > 0 && (
                      <button
                        className="w-full text-left px-2 py-0.5 text-[10.5px] text-muted-foreground hover:text-foreground transition-colors rounded-md hover:bg-muted/50"
                        onClick={(e) => {
                          e.stopPropagation()
                          onDayClick(day)
                        }}
                      >
                        +{extraCount} mais
                      </button>
                    )}
                  </div>
                  {/* Mobile: tinted pills with solid colored left strip */}
                  <div className="sm:hidden space-y-0.5">
                    {dayEvents.slice(0, MAX_MOBILE_EVENTS).map((event) => {
                      const colors = CALENDAR_CATEGORY_COLORS[event.category]
                      return (
                        <div
                          key={event.id}
                          className={cn(
                            'flex items-stretch rounded-md overflow-hidden cursor-pointer transition-opacity hover:opacity-80',
                            colors?.bg || 'bg-primary/15',
                            colors?.text || 'text-primary',
                          )}
                          onClick={(e) => {
                            e.stopPropagation()
                            onEventClick(event)
                          }}
                        >
                          <span className={cn('w-[2px] shrink-0', colors?.dot || 'bg-primary')} />
                          <span className="flex-1 min-w-0 truncate font-medium px-1 py-[2px] text-[9px] leading-tight">
                            {event.title}
                          </span>
                        </div>
                      )
                    })}
                    {mobileExtra > 0 && (
                      <p className="text-[8px] text-muted-foreground/70 text-center leading-none">
                        +{mobileExtra}
                      </p>
                    )}
                  </div>
                </div>

                {/* Tasks count pill — anchored at bottom */}
                {dayTaskCount > 0 && (
                  <button
                    type="button"
                    className="mt-1 shrink-0 inline-flex items-center gap-1 self-start rounded-full bg-muted/60 hover:bg-muted px-1.5 sm:px-2 py-0.5 text-[10px] sm:text-[10.5px] font-medium text-muted-foreground transition-colors"
                    onClick={(e) => {
                      e.stopPropagation()
                      onDayClick(day)
                    }}
                  >
                    <CheckCircle2 className="h-3 w-3" />
                    <span className="tabular-nums">{dayTaskCount}</span>
                    <span className="hidden sm:inline">
                      {dayTaskCount === 1 ? 'tarefa' : 'tarefas'}
                    </span>
                  </button>
                )}
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
}
