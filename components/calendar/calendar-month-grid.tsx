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
import { CALENDAR_CATEGORY_COLORS } from '@/types/calendar'
import { cn } from '@/lib/utils'

interface CalendarMonthGridProps {
  currentDate: Date
  events: CalendarEvent[]
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

  const weeks = useMemo(() => {
    const result: Date[][] = []
    for (let i = 0; i < days.length; i += 7) {
      result.push(days.slice(i, i + 7))
    }
    return result
  }, [days])

  const MAX_MOBILE_EVENTS = 2

  return (
    <div className="flex flex-col rounded-lg border overflow-hidden h-full">
      {/* Header row */}
      <div className="grid grid-cols-7 border-b bg-muted/40">
        {WEEKDAY_LABELS.map((label, i) => (
          <div
            key={label}
            className="px-1 py-1 sm:py-2 text-center text-[10px] sm:text-xs font-medium text-muted-foreground sm:px-2"
          >
            <span className="hidden sm:inline">{label}</span>
            <span className="sm:hidden">{WEEKDAY_LABELS_SHORT[i]}</span>
          </div>
        ))}
      </div>

      {/* Weeks */}
      {weeks.map((week, weekIdx) => (
        <div key={weekIdx} className="grid grid-cols-7 flex-1 min-h-0">
          {week.map((day) => {
            const key = format(day, 'yyyy-MM-dd')
            const dayEvents = eventsByDay.get(key) ?? []
            const isCurrentMonth = isSameMonth(day, currentDate)
            const today = isToday(day)
            const extraCount = dayEvents.length - MAX_VISIBLE_EVENTS
            const mobileExtra = dayEvents.length - MAX_MOBILE_EVENTS

            return (
              <div
                key={key}
                className={cn(
                  'border-b border-r p-0.5 sm:p-1.5 transition-colors cursor-pointer hover:bg-muted/20 overflow-hidden flex flex-col',
                  !isCurrentMonth && 'bg-muted/5 opacity-40',
                )}
                onClick={() => onDayClick(day)}
              >
                {/* Day number */}
                <div className="flex items-center justify-end shrink-0">
                  <button
                    type="button"
                    className={cn(
                      'flex h-5 w-5 sm:h-6 sm:w-6 items-center justify-center rounded-md text-[10px] sm:text-xs font-medium transition-colors',
                      today && 'bg-primary text-primary-foreground font-bold',
                      !today && dayEvents.length > 0 && isCurrentMonth && 'bg-muted/80 font-semibold',
                      !today && dayEvents.length === 0 && isCurrentMonth && 'text-foreground',
                      !today && !isCurrentMonth && 'text-muted-foreground',
                      'hover:ring-1 hover:ring-primary/40',
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
                  {/* Mobile: colored bars with text */}
                  <div className="sm:hidden space-y-0.5">
                    {dayEvents.slice(0, MAX_MOBILE_EVENTS).map((event) => {
                      const colors = CALENDAR_CATEGORY_COLORS[event.category]
                      return (
                        <div
                          key={event.id}
                          className={cn(
                            'flex items-center gap-0.5 rounded-sm px-1 py-[2px] text-[9px] leading-tight truncate cursor-pointer',
                            colors?.bg || 'bg-primary/15',
                            colors?.text || 'text-primary',
                          )}
                          onClick={(e) => {
                            e.stopPropagation()
                            onEventClick(event)
                          }}
                        >
                          <span className={cn('h-1.5 w-1.5 rounded-full shrink-0', colors?.dot || 'bg-primary')} />
                          <span className="truncate font-medium">{event.title}</span>
                        </div>
                      )
                    })}
                    {mobileExtra > 0 && (
                      <p className="text-[8px] text-muted-foreground text-center leading-none">
                        +{mobileExtra}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
}
