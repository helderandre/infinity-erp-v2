'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  startOfDay,
  endOfDay,
  formatISO,
} from 'date-fns'
import { CalendarView, type CalendarViewMode } from '@/components/calendar/calendar-view'
import { CalendarToolbar } from '@/components/calendar/calendar-toolbar'
import { CalendarEventDetail } from '@/components/calendar/calendar-event-detail'
import type { CalendarEvent } from '@/types/calendar'

interface LeadCalendarTabProps {
  contactId: string
  /** Opens the parent's CalendarEventForm with this lead pre-linked */
  onCreateEvent?: () => void
}

/**
 * Lead calendar tab — embeds the same `<CalendarView>` used on the main
 * calendar page so visits + events linked to this contact get the full
 * Google-Calendar-like experience (month / week / day / agenda).
 *
 * Fetches `/api/calendar/events` for the visible range and filters
 * client-side to events where `lead_id === contactId` (the main endpoint
 * already populates the field on visits + manual events).
 */
export function LeadCalendarTab({ contactId, onCreateEvent }: LeadCalendarTabProps) {
  const [currentDate, setCurrentDate] = useState<Date>(new Date())
  const [view, setView] = useState<CalendarViewMode>('month')
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null)

  // Compute the visible date range for the active view.
  const range = useMemo(() => {
    if (view === 'day') {
      return { start: startOfDay(currentDate), end: endOfDay(currentDate) }
    }
    if (view === 'week') {
      return {
        start: startOfWeek(currentDate, { weekStartsOn: 1 }),
        end: endOfWeek(currentDate, { weekStartsOn: 1 }),
      }
    }
    // month + agenda → fetch the whole month so all dots show up
    return {
      start: startOfWeek(startOfMonth(currentDate), { weekStartsOn: 1 }),
      end: endOfWeek(endOfMonth(currentDate), { weekStartsOn: 1 }),
    }
  }, [currentDate, view])

  const load = useCallback(async () => {
    setIsLoading(true)
    try {
      const params = new URLSearchParams({
        start: formatISO(range.start),
        end: formatISO(range.end),
      })
      const res = await fetch(`/api/calendar/events?${params.toString()}`)
      if (!res.ok) throw new Error()
      const json = await res.json()
      const all: CalendarEvent[] = Array.isArray(json) ? json : (json?.events ?? json?.data ?? [])
      setEvents(all.filter((e) => e.lead_id === contactId))
    } catch {
      setEvents([])
    } finally {
      setIsLoading(false)
    }
  }, [contactId, range.start, range.end])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <div className="space-y-3">
      <CalendarToolbar
        currentDate={currentDate}
        view={view}
        onDateChange={setCurrentDate}
        onViewChange={(v) => setView(v as CalendarViewMode)}
        onCreateEvent={() => onCreateEvent?.()}
        hideSubscribe
      />

      {/* Altura explícita — sem isto o grid colapsa em rows muito baixas
          (~40px) já que <CalendarMonthGrid> usa flex-1 + h-full. Damos
          espaço para os títulos dos eventos respirarem em mobile + desktop. */}
      <div className="rounded-2xl bg-card/40 ring-1 ring-border/60 overflow-hidden h-[560px] sm:h-[680px]">
        <CalendarView
          events={events}
          tasks={[]}
          isLoading={isLoading}
          currentDate={currentDate}
          view={view}
          onDateChange={setCurrentDate}
          onViewChange={(v) => setView(v as CalendarViewMode)}
          onEventClick={(ev) => setSelectedEvent(ev)}
          onDayClick={(date) => {
            setCurrentDate(date)
            setView('day')
          }}
          onDayNumberClick={(date) => {
            setCurrentDate(date)
            setView('day')
          }}
        />
      </div>

      {/* Event detail */}
      {selectedEvent && (
        <CalendarEventDetail
          event={selectedEvent}
          open={!!selectedEvent}
          onClose={() => setSelectedEvent(null)}
          onRefresh={() => void load()}
          onDelete={() => {
            setSelectedEvent(null)
            void load()
          }}
        />
      )}
    </div>
  )
}
