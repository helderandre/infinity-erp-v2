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
  isToday,
  format,
  parseISO,
} from 'date-fns'
import { CalendarEventCard } from './calendar-event-card'
import { getEventColors } from '@/types/calendar'
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
const MAX_MOBILE_EVENTS = 2

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

  return (
    <div className="flex flex-col rounded-3xl border border-border/40 overflow-hidden h-full bg-background/50 supports-[backdrop-filter]:bg-background/30 backdrop-blur-md shadow-sm">
      {/* Header row — translucent, minimal */}
      <div className="grid grid-cols-7 border-b border-border/40 bg-background/40 supports-[backdrop-filter]:bg-background/30 backdrop-blur-sm">
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

      {/* Weeks — flat mube-style cells with soft border-b/border-r dividers */}
      {weeks.map((week, weekIdx) => (
        <div key={weekIdx} className="grid grid-cols-7 flex-1 min-h-0">
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
                  'relative flex flex-col items-stretch p-1 sm:p-1.5 min-h-[64px] sm:min-h-0 text-left transition-colors cursor-pointer overflow-hidden',
                  'hover:bg-muted/30',
                  weekIdx < weeks.length - 1 && 'border-b border-border/40',
                  dayIdx < 6 && 'border-r border-border/40',
                  !isCurrentMonth && 'opacity-40 bg-muted/20',
                )}
                onClick={() => onDayClick(day)}
              >
                {/* Day number — top-left round badge, mube style */}
                <div className="flex items-center shrink-0">
                  <button
                    type="button"
                    className={cn(
                      'flex h-6 w-6 items-center justify-center rounded-full text-[11px] sm:text-xs font-medium transition-all',
                      today && 'bg-blue-600 text-white font-semibold shadow-sm',
                      !today && isCurrentMonth && 'text-foreground/80 hover:bg-muted/60',
                      !today && !isCurrentMonth && 'text-muted-foreground/60 hover:bg-muted/40',
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
                <div className="flex-1 min-h-0 mt-0.5">
                  {/* Desktop: mube-style chips (dot + hora + título) */}
                  <div className="hidden sm:block space-y-[2px]">
                    {dayEvents.slice(0, MAX_VISIBLE_EVENTS).map((event) => (
                      <div
                        key={event.id}
                        onClick={(e) => {
                          e.stopPropagation()
                          onEventClick(event)
                        }}
                      >
                        <CalendarEventCard event={event} />
                      </div>
                    ))}
                    {extraCount > 0 && (
                      <button
                        className="text-left px-1.5 py-[2px] text-[10px] font-medium text-muted-foreground hover:text-foreground transition-colors rounded hover:bg-muted/50"
                        onClick={(e) => {
                          e.stopPropagation()
                          onDayClick(day)
                        }}
                      >
                        +{extraCount} mais
                      </button>
                    )}
                  </div>
                  {/* Mobile: Google Calendar-style solid chips */}
                  <div className="sm:hidden space-y-[2px]">
                    {dayEvents.slice(0, MAX_MOBILE_EVENTS).map((event) => {
                      const colors = getEventColors(event)
                      return (
                        <div
                          key={event.id}
                          className={cn(
                            'rounded-[4px] px-1 py-[2px] truncate text-[9px] font-semibold leading-tight cursor-pointer transition-opacity hover:opacity-80',
                            event.is_private
                              ? cn(colors?.bg || 'bg-yellow-100', colors?.text || 'text-yellow-900')
                              : cn(colors?.dot || 'bg-primary', 'text-white'),
                          )}
                          onClick={(e) => {
                            e.stopPropagation()
                            onEventClick(event)
                          }}
                        >
                          {event.title}
                        </div>
                      )
                    })}
                    {mobileExtra > 0 && (
                      <p className="text-[9px] font-medium text-muted-foreground/80 pl-1 leading-none">
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
