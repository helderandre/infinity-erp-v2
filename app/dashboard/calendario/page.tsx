'use client'

import { useState, useCallback, useEffect, useMemo } from 'react'
import { startOfMonth, endOfMonth, startOfWeek, endOfWeek, addMonths, subMonths } from 'date-fns'
import { useCalendarEvents } from '@/hooks/use-calendar-events'
import { useCalendarFilters } from '@/hooks/use-calendar-filters'
import { CalendarToolbar } from '@/components/calendar/calendar-toolbar'
import { CalendarFilters } from '@/components/calendar/calendar-filters'
import { CalendarView } from '@/components/calendar/calendar-view'
import { CalendarSidebar } from '@/components/calendar/calendar-sidebar'
import { CalendarEventDetail } from '@/components/calendar/calendar-event-detail'
import { CalendarEventForm } from '@/components/calendar/calendar-event-form'
import type { CalendarEvent } from '@/types/calendar'
import type { CalendarEventFormData } from '@/lib/validations/calendar'

export default function CalendarioPage() {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [view, setView] = useState<'month' | 'week'>('month')
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [formOpen, setFormOpen] = useState(false)
  const [editingEvent, setEditingEvent] = useState<Partial<CalendarEventFormData> | undefined>()
  const [editingEventId, setEditingEventId] = useState<string | null>(null)
  const [users, setUsers] = useState<{ id: string; name: string }[]>([])

  // Compute date range for the visible period (memoized to avoid re-renders)
  const { rangeStart, rangeEnd } = useMemo(() => {
    const monthStart = startOfMonth(currentDate)
    const monthEnd = endOfMonth(currentDate)
    return {
      rangeStart: startOfWeek(monthStart, { weekStartsOn: 1 }),
      rangeEnd: endOfWeek(monthEnd, { weekStartsOn: 1 }),
    }
  }, [currentDate.getMonth(), currentDate.getFullYear()])

  const {
    categories,
    userId: filterUserId,
    filterSelf,
    toggleCategory,
    setCategories,
    setUserId: setFilterUserId,
    toggleFilterSelf,
  } = useCalendarFilters()

  const {
    events,
    isLoading,
    refetch,
    createEvent,
    updateEvent,
    deleteEvent,
  } = useCalendarEvents({
    start: rangeStart,
    end: rangeEnd,
    categories,
    userId: filterUserId,
  })

  // Fetch users for filters and form
  useEffect(() => {
    fetch('/api/consultants?status=active')
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setUsers(data.map((u: any) => ({ id: u.id, name: u.commercial_name || u.name || 'Sem nome' })))
        }
      })
      .catch(() => {})
  }, [])

  const handleDateChange = useCallback((date: Date) => {
    setCurrentDate(date)
  }, [])

  const handleEventClick = useCallback((event: CalendarEvent) => {
    setSelectedEvent(event)
    setDetailOpen(true)
  }, [])

  const handleDayClick = useCallback((date: Date) => {
    setCurrentDate(date)
    setView('week')
  }, [])

  const handleCreateEvent = useCallback(() => {
    setEditingEvent(undefined)
    setEditingEventId(null)
    setFormOpen(true)
  }, [])

  const handleEditEvent = useCallback((event: CalendarEvent) => {
    if (event.source !== 'manual') return
    const realId = event.id.replace('manual:', '')
    setEditingEventId(realId)
    setEditingEvent({
      title: event.title,
      description: event.description || '',
      category: event.category as any,
      start_date: event.start_date,
      end_date: event.end_date || undefined,
      all_day: event.all_day,
      is_recurring: event.is_recurring,
      user_id: event.user_id || undefined,
      visibility: 'all',
    })
    setDetailOpen(false)
    setFormOpen(true)
  }, [])

  const handleDeleteEvent = useCallback(async (id: string) => {
    const realId = id.replace('manual:', '')
    const success = await deleteEvent(realId)
    if (success) {
      setDetailOpen(false)
      setSelectedEvent(null)
    }
  }, [deleteEvent])

  const handleFormSubmit = useCallback(async (data: CalendarEventFormData) => {
    if (editingEventId) {
      await updateEvent(editingEventId, data)
    } else {
      await createEvent(data)
    }
    setFormOpen(false)
    setEditingEvent(undefined)
    setEditingEventId(null)
  }, [editingEventId, createEvent, updateEvent])

  return (
    <div className="flex h-full flex-col gap-3 sm:gap-4 -m-4 p-3 sm:p-4 md:-m-6 md:p-6">
      <CalendarToolbar
        currentDate={currentDate}
        view={view}
        onDateChange={handleDateChange}
        onViewChange={setView}
        onCreateEvent={handleCreateEvent}
      />

      <div className="flex flex-1 gap-4 overflow-hidden">
        {/* Left sidebar — filters */}
        <div className="hidden w-64 shrink-0 lg:block">
          <CalendarFilters
            categories={categories}
            onToggleCategory={toggleCategory}
            onSetCategories={setCategories}
            users={users}
            selectedUserId={filterUserId}
            onUserChange={setFilterUserId}
            filterSelf={filterSelf}
            onToggleFilterSelf={toggleFilterSelf}
          />
        </div>

        {/* Main calendar area */}
        <div className="flex-1 overflow-auto">
          <CalendarView
            events={events}
            isLoading={isLoading}
            currentDate={currentDate}
            view={view}
            onDateChange={handleDateChange}
            onViewChange={setView}
            onEventClick={handleEventClick}
            onDayClick={handleDayClick}
          />
        </div>

        {/* Right sidebar — mini calendar + upcoming */}
        <div className="hidden w-72 shrink-0 xl:block">
          <CalendarSidebar
            currentDate={currentDate}
            events={events}
            onDateChange={handleDateChange}
          />
        </div>
      </div>

      {/* Event detail sheet */}
      <CalendarEventDetail
        event={selectedEvent}
        open={detailOpen}
        onClose={() => {
          setDetailOpen(false)
          setSelectedEvent(null)
        }}
        onEdit={handleEditEvent}
        onDelete={handleDeleteEvent}
      />

      {/* Event create/edit form dialog */}
      <CalendarEventForm
        open={formOpen}
        onClose={() => {
          setFormOpen(false)
          setEditingEvent(undefined)
          setEditingEventId(null)
        }}
        onSubmit={handleFormSubmit}
        initialData={editingEvent}
        users={users}
      />
    </div>
  )
}
