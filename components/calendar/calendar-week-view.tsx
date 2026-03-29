'use client'

import { useMemo } from 'react'
import type { CalendarEvent } from '@/types/calendar'
import {
  startOfWeek,
  addDays,
  format,
  parseISO,
  isSameDay,
  isToday,
  getHours,
  getMinutes,
} from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { CalendarEventCard } from './calendar-event-card'
import { cn } from '@/lib/utils'

interface CalendarWeekViewProps {
  currentDate: Date
  events: CalendarEvent[]
  onEventClick: (event: CalendarEvent) => void
  onDayClick: (date: Date) => void
}

const HOUR_START = 8
const HOUR_END = 20
const HOURS = Array.from({ length: HOUR_END - HOUR_START + 1 }, (_, i) => HOUR_START + i)

export function CalendarWeekView({
  currentDate,
  events,
  onEventClick,
  onDayClick,
}: CalendarWeekViewProps) {
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 })
  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart]
  )

  const { allDayEvents, timedEvents } = useMemo(() => {
    const allDay: CalendarEvent[] = []
    const timed: CalendarEvent[] = []
    for (const event of events) {
      const eventDate = parseISO(event.start_date)
      const isInWeek = weekDays.some((d) => isSameDay(d, eventDate))
      if (!isInWeek) continue
      if (event.all_day) {
        allDay.push(event)
      } else {
        timed.push(event)
      }
    }
    return { allDayEvents: allDay, timedEvents: timed }
  }, [events, weekDays])

  const getEventsForDayAndHour = (day: Date, hour: number) => {
    return timedEvents.filter((event) => {
      const eventDate = parseISO(event.start_date)
      return isSameDay(eventDate, day) && getHours(eventDate) === hour
    })
  }

  const getAllDayEventsForDay = (day: Date) => {
    return allDayEvents.filter((event) => isSameDay(parseISO(event.start_date), day))
  }

  return (
    <div className="flex flex-col border rounded-lg overflow-hidden">
      {/* Header with day names and dates */}
      <div className="grid grid-cols-[40px_repeat(7,1fr)] sm:grid-cols-[60px_repeat(7,1fr)] border-b bg-muted/30">
        <div className="px-1 py-2 sm:px-2" />
        {weekDays.map((day) => {
          const today = isToday(day)
          const dayLabel = format(day, 'EEE', { locale: ptBR })
          const capitalizedDay = dayLabel.charAt(0).toUpperCase() + dayLabel.slice(1)
          const shortDay = capitalizedDay.charAt(0)

          return (
            <div
              key={day.toISOString()}
              className={cn(
                'px-0.5 py-1.5 sm:px-2 sm:py-2 text-center border-l cursor-pointer hover:bg-muted/40 transition-colors',
                today && 'bg-primary/5'
              )}
              onClick={() => onDayClick(day)}
            >
              <div className="text-[10px] sm:text-xs text-muted-foreground">
                <span className="hidden sm:inline">{capitalizedDay}</span>
                <span className="sm:hidden">{shortDay}</span>
              </div>
              <div
                className={cn(
                  'text-xs sm:text-sm font-medium mt-0.5',
                  today && 'text-primary'
                )}
              >
                <span
                  className={cn(
                    'inline-flex h-5 w-5 sm:h-6 sm:w-6 items-center justify-center rounded-full',
                    today && 'bg-primary text-primary-foreground'
                  )}
                >
                  {format(day, 'd')}
                </span>
              </div>
            </div>
          )
        })}
      </div>

      {/* All-day events section */}
      {allDayEvents.length > 0 && (
        <div className="grid grid-cols-[40px_repeat(7,1fr)] sm:grid-cols-[60px_repeat(7,1fr)] border-b bg-muted/10">
          <div className="px-0.5 py-1.5 text-[8px] sm:text-[10px] text-muted-foreground text-right pr-1 sm:pr-2 flex items-center justify-end">
            <span className="hidden sm:inline">Todo dia</span>
            <span className="sm:hidden">TD</span>
          </div>
          {weekDays.map((day) => {
            const dayAllDayEvents = getAllDayEventsForDay(day)
            return (
              <div
                key={day.toISOString()}
                className="border-l px-0.5 py-1 space-y-0.5 min-h-[28px]"
              >
                {dayAllDayEvents.map((event) => (
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
              </div>
            )
          })}
        </div>
      )}

      {/* Time grid */}
      <div className="overflow-auto max-h-[600px]">
        {HOURS.map((hour) => (
          <div
            key={hour}
            className="grid grid-cols-[40px_repeat(7,1fr)] sm:grid-cols-[60px_repeat(7,1fr)] border-b last:border-b-0 min-h-[40px] sm:min-h-[48px]"
          >
            <div className="px-0.5 py-1 text-[9px] sm:text-[10px] text-muted-foreground text-right pr-1 sm:pr-2 border-r">
              {String(hour).padStart(2, '0')}:00
            </div>
            {weekDays.map((day) => {
              const hourEvents = getEventsForDayAndHour(day, hour)
              const today = isToday(day)

              return (
                <div
                  key={day.toISOString()}
                  className={cn(
                    'border-l px-0.5 py-0.5 cursor-pointer hover:bg-muted/20 transition-colors',
                    today && 'bg-primary/[0.02]'
                  )}
                  onClick={() => onDayClick(day)}
                >
                  {hourEvents.map((event) => (
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
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}
