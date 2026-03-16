'use client'

import { useMemo } from 'react'
import type { CalendarEvent } from '@/types/calendar'
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
import { CalendarEventCard } from './calendar-event-card'
import { cn } from '@/lib/utils'

interface CalendarMonthGridProps {
  currentDate: Date
  events: CalendarEvent[]
  onEventClick: (event: CalendarEvent) => void
  onDayClick: (date: Date) => void
}

const WEEKDAY_LABELS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']
const MAX_VISIBLE_EVENTS = 3

export function CalendarMonthGrid({
  currentDate,
  events,
  onEventClick,
  onDayClick,
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

  const weeks = useMemo(() => {
    const result: Date[][] = []
    for (let i = 0; i < days.length; i += 7) {
      result.push(days.slice(i, i + 7))
    }
    return result
  }, [days])

  return (
    <div className="flex flex-col rounded-lg border overflow-hidden">
      {/* Header row */}
      <div className="grid grid-cols-7 border-b bg-muted/40">
        {WEEKDAY_LABELS.map((label) => (
          <div
            key={label}
            className="px-2 py-2 text-center text-xs font-medium text-muted-foreground"
          >
            {label}
          </div>
        ))}
      </div>

      {/* Weeks */}
      {weeks.map((week, weekIdx) => (
        <div key={weekIdx} className="grid grid-cols-7 flex-1">
          {week.map((day) => {
            const key = format(day, 'yyyy-MM-dd')
            const dayEvents = eventsByDay.get(key) ?? []
            const isCurrentMonth = isSameMonth(day, currentDate)
            const today = isToday(day)
            const extraCount = dayEvents.length - MAX_VISIBLE_EVENTS

            return (
              <div
                key={key}
                className={cn(
                  'min-h-[110px] border-b border-r p-1.5 transition-colors cursor-pointer hover:bg-muted/20',
                  !isCurrentMonth && 'bg-muted/5 opacity-40',
                )}
                onClick={() => onDayClick(day)}
              >
                {/* Day number */}
                <div className="flex items-center justify-end mb-1">
                  <span
                    className={cn(
                      'flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium',
                      today && 'bg-primary text-primary-foreground font-bold',
                      !today && isCurrentMonth && 'text-foreground',
                      !today && !isCurrentMonth && 'text-muted-foreground',
                    )}
                  >
                    {format(day, 'd')}
                  </span>
                </div>

                {/* Events */}
                <div className="space-y-0.5">
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
                      className="w-full text-left px-1.5 py-0.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
                      onClick={(e) => {
                        e.stopPropagation()
                        onDayClick(day)
                      }}
                    >
                      +{extraCount} mais
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
}
