'use client'

import { useMemo } from 'react'
import type { CalendarEvent } from '@/types/calendar'
import { CALENDAR_CATEGORY_COLORS } from '@/types/calendar'
import { Calendar } from '@/components/ui/calendar'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { format, parseISO, isAfter, isSameDay } from 'date-fns'
import { pt } from 'date-fns/locale'
import { cn } from '@/lib/utils'
import { CalendarDays } from 'lucide-react'

interface CalendarSidebarProps {
  currentDate: Date
  events: CalendarEvent[]
  onDateChange: (date: Date) => void
}

const MAX_UPCOMING = 7

export function CalendarSidebar({
  currentDate,
  events,
  onDateChange,
}: CalendarSidebarProps) {
  const now = new Date()

  const upcomingEvents = useMemo(() => {
    return events
      .filter((e) => {
        const eventDate = parseISO(e.start_date)
        return isAfter(eventDate, now) || isSameDay(eventDate, now)
      })
      .sort((a, b) => parseISO(a.start_date).getTime() - parseISO(b.start_date).getTime())
      .slice(0, MAX_UPCOMING)
  }, [events, now])

  return (
    <div className="space-y-4">
      {/* Mini calendar */}
      <div className="flex justify-center">
        <Calendar
          mode="single"
          selected={currentDate}
          onSelect={(date) => date && onDateChange(date)}
          locale={pt}
          weekStartsOn={1}
          className="rounded-md border"
        />
      </div>

      <Separator />

      {/* Upcoming events */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <CalendarDays className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">Próximos Eventos</h3>
        </div>

        {upcomingEvents.length === 0 ? (
          <p className="text-xs text-muted-foreground px-1">
            Sem eventos futuros.
          </p>
        ) : (
          <ScrollArea className="max-h-[320px]">
            <div className="space-y-1">
              {upcomingEvents.map((event) => {
                const colors = CALENDAR_CATEGORY_COLORS[event.category]
                const eventDate = parseISO(event.start_date)
                const isEventToday = isSameDay(eventDate, now)

                return (
                  <div
                    key={event.id}
                    className="flex items-start gap-2.5 rounded-md px-2 py-1.5 text-sm hover:bg-muted/50 transition-colors cursor-pointer"
                    onClick={() => onDateChange(eventDate)}
                  >
                    <span
                      className={cn(
                        'mt-1.5 h-2 w-2 rounded-full shrink-0',
                        colors.dot
                      )}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="truncate text-sm">{event.title}</p>
                      <p
                        className={cn(
                          'text-xs text-muted-foreground',
                          isEventToday && 'text-primary font-medium'
                        )}
                      >
                        {isEventToday
                          ? 'Hoje'
                          : format(eventDate, "d 'de' MMM", { locale: pt })}
                        {!event.all_day && (
                          <span className="ml-1">
                            {format(eventDate, 'HH:mm')}
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          </ScrollArea>
        )}
      </div>
    </div>
  )
}
