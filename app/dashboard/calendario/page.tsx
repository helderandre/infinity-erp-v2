'use client'


import { Suspense, useState, useCallback, useEffect, useMemo, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import { startOfMonth, endOfMonth, startOfWeek, endOfWeek, addMonths, subMonths, format, parseISO, isSameDay } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { useCalendarEvents } from '@/hooks/use-calendar-events'
import { useCalendarFilters } from '@/hooks/use-calendar-filters'
import { CalendarToolbar } from '@/components/calendar/calendar-toolbar'
import { CalendarFilterChips } from '@/components/calendar/calendar-filter-chips'
import { CalendarView } from '@/components/calendar/calendar-view'
import { CalendarSidebar } from '@/components/calendar/calendar-sidebar'
import { CalendarEventDetail } from '@/components/calendar/calendar-event-detail'
import { TaskDetailSheet } from '@/components/tasks/task-detail-sheet'
import type { TaskWithRelations } from '@/types/task'
import { CalendarEventForm } from '@/components/calendar/calendar-event-form'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { CALENDAR_CATEGORY_COLORS, CALENDAR_CATEGORY_LABELS } from '@/types/calendar'
import { useIsMobile } from '@/hooks/use-mobile'
import { useCalendarReminders } from '@/hooks/use-calendar-reminders'
import { Infinity as InfinityIcon, MapPin, BarChart3, Video } from 'lucide-react'
import { useUser } from '@/hooks/use-user'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { CalendarEvent } from '@/types/calendar'
import type { CalendarEventFormData } from '@/lib/validations/calendar'

function CalendarioPageInner() {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [view, setView] = useState<'month' | 'week' | 'agenda' | 'day'>('month')
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
  const [taskDetailOpen, setTaskDetailOpen] = useState(false)
  const [previousView, setPreviousView] = useState<'month' | 'week' | 'agenda'>('month')
  const [showTasks, setShowTasks] = useState(true)
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [formOpen, setFormOpen] = useState(false)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [daySheetOpen, setDaySheetOpen] = useState(false)
  const [companyEventsOpen, setCompanyEventsOpen] = useState(false)
  const [selectedDay, setSelectedDay] = useState<Date | null>(null)
  const isMobile = useIsMobile()
  const { user: currentUser } = useUser()
  useCalendarReminders()
  const searchParams = useSearchParams()
  const deepLinkHandled = useRef(false)

  const MANAGER_ROLES = ['Broker/CEO', 'admin', 'Office Manager', 'Gestora Processual']
  const isManager = currentUser?.role?.name
    ? MANAGER_ROLES.some((r) => r.toLowerCase() === currentUser.role!.name!.toLowerCase())
    : false
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
    tasks,
    isLoading,
    refetch,
    createEvent,
    updateEvent,
    deleteEvent,
    toggleTaskComplete,
  } = useCalendarEvents({
    start: rangeStart,
    end: rangeEnd,
    categories,
    userId: filterUserId,
  })

  // Auto-jump to date from URL param (?date=YYYY-MM-DD) — runs once
  const dateNavHandled = useRef(false)
  useEffect(() => {
    if (dateNavHandled.current) return
    const dateParam = searchParams.get('date')
    if (!dateParam) return
    const parsed = new Date(`${dateParam}T00:00:00`)
    if (!isNaN(parsed.getTime())) {
      dateNavHandled.current = true
      setCurrentDate(parsed)
    }
  }, [searchParams])

  // Auto-open event from URL param (?event=id)
  useEffect(() => {
    if (deepLinkHandled.current || !events.length) return
    const eventParam = searchParams.get('event')
    if (!eventParam) return
    const found = events.find((e) =>
      e.id === eventParam ||
      e.id === `manual:${eventParam}` ||
      e.id === `visit:${eventParam}` ||
      e.id.replace('manual:', '') === eventParam ||
      e.id.replace('visit:', '') === eventParam
    )
    if (found) {
      deepLinkHandled.current = true
      setSelectedEvent(found)
      setDetailOpen(true)
    }
  }, [events, searchParams])

  // Check if there's a live event right now
  const hasLiveEvent = useMemo(() => {
    const now = new Date()
    return events.some((e) => {
      if (e.category !== 'company_event' && e.category !== 'meeting') return false
      const start = new Date(e.start_date)
      const end = e.end_date ? new Date(e.end_date) : new Date(start.getTime() + 3600000)
      return now >= start && now <= end
    })
  }, [events])

  // Fetch users for filters and form
  useEffect(() => {
    fetch('/api/consultants?status=active&consultant_only=false')
      .then((res) => res.json())
      .then((json) => {
        // Handle both { data: [...] } and direct array responses
        const list = Array.isArray(json) ? json : Array.isArray(json?.data) ? json.data : []
        if (list.length > 0) {
          setUsers(list.map((u: any) => ({ id: u.id, name: u.commercial_name || u.name || 'Sem nome' })))
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

  const handleDayClick = useCallback(
    (date: Date) => {
      // Remember the current (non-day) view so the back button can restore it.
      setView((v) => {
        if (v !== 'day') setPreviousView(v)
        return 'day'
      })
      setCurrentDate(date)
    },
    [],
  )

  const handleDayNumberClick = useCallback(
    (date: Date) => {
      setView((v) => {
        if (v !== 'day') setPreviousView(v)
        return 'day'
      })
      setCurrentDate(date)
    },
    [],
  )

  const handleDayBack = useCallback(() => {
    setView(previousView)
  }, [previousView])

  const handleTaskSelect = useCallback((task: TaskWithRelations) => {
    setSelectedTaskId(task.id)
    setTaskDetailOpen(true)
  }, [])

  // Wrapper around the toolbar's view changer so that picking a tab from
  // within day view exits day view cleanly.
  const handleViewChange = useCallback(
    (next: 'month' | 'week' | 'agenda' | 'day') => {
      if (next !== 'day') setPreviousView(next)
      setView(next)
    },
    [],
  )

  const handleCreateEvent = useCallback(() => {
    setEditingEvent(undefined)
    setEditingEventId(null)
    setFormOpen(true)
  }, [])

  // Click on a time slot in the week view → open the event form pre-filled
  // with the snapped start time + 1h end time. Mirrors Google Calendar UX.
  const handleCreateAtTime = useCallback((date: Date) => {
    const pad = (n: number) => String(n).padStart(2, '0')
    const toLocalInput = (d: Date) =>
      `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
    const end = new Date(date)
    end.setHours(end.getHours() + 1)
    setEditingEvent({
      start_date: toLocalInput(date),
      end_date: toLocalInput(end),
    })
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
      item_type: event.item_type || 'event',
      start_date: event.start_date,
      end_date: event.end_date || undefined,
      all_day: event.all_day,
      is_recurring: event.is_recurring,
      user_id: event.user_id || undefined,
      visibility: 'all',
      visibility_mode: event.visibility_mode || 'all',
      visibility_user_ids: event.visibility_user_ids || [],
      visibility_role_names: event.visibility_role_names || [],
      location: event.location || undefined,
      cover_image_url: event.cover_image_url || undefined,
      livestream_url: event.livestream_url || undefined,
      registration_url: event.registration_url || undefined,
      links: event.links || [],
      reminders: event.reminders || [],
      requires_rsvp: event.requires_rsvp || false,
    })
    setDetailOpen(false)
    setFormOpen(true)
  }, [])

  const handleRsvp = useCallback(async (eventId: string, status: 'going' | 'not_going', reason?: string) => {
    try {
      const realId = eventId.replace('manual:', '')
      const res = await fetch(`/api/calendar/events/${realId}/rsvp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, reason }),
      })
      if (res.ok) {
        const { toast } = await import('sonner')
        toast.success(status === 'going' ? 'Presença confirmada!' : 'Ausência registada.')
        refetch()
      }
    } catch {}
  }, [refetch])

  const handleDeleteEvent = useCallback(async (id: string) => {
    const realId = id.replace('manual:', '')
    const success = await deleteEvent(realId)
    if (success) {
      setDetailOpen(false)
      setSelectedEvent(null)
    }
  }, [deleteEvent])

  const handleFormSubmit = useCallback(async (data: CalendarEventFormData) => {
    // Nova Tarefa → /api/tasks (separate module). Legacy edits of task-events
    // continue to go to /api/calendar/events so back-compat is preserved.
    if (data.item_type === 'task' && !editingEventId) {
      const payload = {
        title: data.title,
        description: data.description || null,
        priority: data.priority ?? 4,
        due_date: data.start_date || null,
        assigned_to: data.user_id || null,
        is_recurring: data.is_recurring,
        recurrence_rule: data.recurrence_rule || null,
        reminders: data.reminders ?? [],
      }
      try {
        const res = await fetch('/api/tasks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        if (!res.ok) {
          const body = await res.json().catch(() => ({}))
          throw new Error(body.error || 'Erro ao criar tarefa')
        }
        // Refetch so the new task shows up in the calendar.
        refetch()
      } catch {
        // Toast handled by the form's own try/catch — keep sheet open on error.
        throw new Error('Erro ao criar tarefa')
      }
    } else if (editingEventId) {
      await updateEvent(editingEventId, data)
    } else {
      await createEvent(data)
    }
    setFormOpen(false)
    setEditingEvent(undefined)
    setEditingEventId(null)
  }, [editingEventId, createEvent, updateEvent, refetch])

  return (
    <div className="flex h-full flex-col gap-1 sm:gap-4 -m-4 p-2 sm:p-4 md:-m-6 md:p-6">
      <CalendarToolbar
        currentDate={currentDate}
        view={view}
        parentView={previousView}
        onDateChange={handleDateChange}
        onViewChange={handleViewChange}
        onCreateEvent={handleCreateEvent}
        onToggleFilters={() => setFiltersOpen(true)}
        onShowCompanyEvents={() => setCompanyEventsOpen(true)}
        isManager={isManager}
        hasLiveEvent={hasLiveEvent}
        hasActiveFilters={!!filterUserId || filterSelf}
      />

      {/* Horizontal filter chip row — desktop/tablet only; mobile uses
          the sheet that opens from the toolbar filter icon. */}
      <div className="hidden md:block">
        <CalendarFilterChips
          categories={categories}
          onToggleCategory={toggleCategory}
          onSetCategories={setCategories}
          users={users}
          selectedUserId={filterUserId}
          onUserChange={setFilterUserId}
          filterSelf={filterSelf}
          onToggleFilterSelf={toggleFilterSelf}
          showTasks={showTasks}
          onToggleShowTasks={() => setShowTasks((v) => !v)}
          taskCount={tasks?.filter((t) => !t.is_completed).length ?? 0}
        />
      </div>

      {/* Main calendar area — full width, no sidebar */}
      <div className="flex-1 overflow-auto rounded-2xl bg-card/40 ring-1 ring-border/60">
        <CalendarView
          events={events}
          tasks={showTasks ? tasks : []}
          isLoading={isLoading}
          currentDate={currentDate}
          view={view}
          onDateChange={handleDateChange}
          onViewChange={handleViewChange}
          onEventClick={handleEventClick}
          onDayClick={handleDayClick}
          onCreateAtTime={handleCreateAtTime}
          onDayNumberClick={handleDayNumberClick}
          onDayBack={handleDayBack}
          dayBackLabel={
            previousView === 'week'
              ? 'Semana'
              : previousView === 'agenda'
              ? 'Agenda'
              : 'Mês'
          }
          onTaskSelect={handleTaskSelect}
          onTaskToggleComplete={toggleTaskComplete}
        />
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
        onRsvp={handleRsvp}
        onRefresh={refetch}
      />

      {/* Task detail sheet (from tasks module) */}
      <TaskDetailSheet
        taskId={selectedTaskId}
        open={taskDetailOpen}
        onOpenChange={(open) => {
          setTaskDetailOpen(open)
          if (!open) setSelectedTaskId(null)
        }}
        onRefresh={refetch}
        onCreateSubTask={() => {
          // Sub-task creation lives in the tasks module; no-op here.
        }}
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

      {/* Mobile filters sheet — same chip UI, just in a wrap-friendly layout */}
      <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
        <SheetContent side="right" className="w-80 p-4">
          <SheetHeader className="pb-4">
            <SheetTitle>Filtros</SheetTitle>
          </SheetHeader>
          <CalendarFilterChips
            categories={categories}
            onToggleCategory={toggleCategory}
            onSetCategories={setCategories}
            users={users}
            selectedUserId={filterUserId}
            onUserChange={setFilterUserId}
            filterSelf={filterSelf}
            onToggleFilterSelf={toggleFilterSelf}
            showTasks={showTasks}
            onToggleShowTasks={() => setShowTasks((v) => !v)}
            taskCount={tasks?.filter((t) => !t.is_completed).length ?? 0}
            className="flex-wrap overflow-visible"
          />
        </SheetContent>
      </Sheet>

      {/* Day events bottom sheet (mobile) */}
      <Sheet open={daySheetOpen} onOpenChange={setDaySheetOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl max-h-[70dvh]">
          <SheetHeader className="pb-3">
            <SheetTitle>
              {selectedDay && (() => {
                const label = format(selectedDay, "EEEE, d 'de' MMMM", { locale: ptBR })
                return label.charAt(0).toUpperCase() + label.slice(1)
              })()}
            </SheetTitle>
          </SheetHeader>
          <div className="overflow-y-auto space-y-1.5 pb-4">
            {selectedDay && (() => {
              const dayEvents = events.filter((e) => {
                try { return isSameDay(parseISO(e.start_date), selectedDay) }
                catch { return false }
              })
              if (dayEvents.length === 0) {
                return <p className="text-sm text-muted-foreground py-4 text-center">Sem eventos neste dia.</p>
              }
              return dayEvents.map((event) => {
                const colors = CALENDAR_CATEGORY_COLORS[event.category]
                const catLabel = CALENDAR_CATEGORY_LABELS[event.category]
                return (
                  <div
                    key={event.id}
                    className="flex items-start gap-3 rounded-lg border p-3 cursor-pointer hover:bg-muted/30 transition-colors"
                    onClick={() => {
                      setDaySheetOpen(false)
                      handleEventClick(event)
                    }}
                  >
                    <div className={`w-1 self-stretch rounded-full shrink-0 ${colors?.dot || 'bg-primary'}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{event.title}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium ${colors?.bg || 'bg-muted'} ${colors?.text || 'text-muted-foreground'}`}>
                          {catLabel}
                        </span>
                        {!event.all_day && (
                          <span className="text-xs text-muted-foreground">
                            {format(parseISO(event.start_date), 'HH:mm')}
                          </span>
                        )}
                        {event.all_day && (
                          <span className="text-[10px] text-muted-foreground">Todo o dia</span>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })
            })()}
          </div>
        </SheetContent>
      </Sheet>

      {/* Company events sheet */}
      <Sheet open={companyEventsOpen} onOpenChange={setCompanyEventsOpen}>
        <SheetContent side={isMobile ? 'bottom' : 'right'} className={cn(
          'p-0 flex flex-col',
          isMobile ? 'h-[85dvh] rounded-t-2xl' : 'w-full sm:max-w-[440px]',
        )}>
          <div className="px-5 pt-5 pb-3 sm:px-6 shrink-0 border-b bg-yellow-400/10">
            <SheetHeader className="p-0">
              <SheetTitle className="flex items-center gap-2 text-base sm:text-lg">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-yellow-400/25 text-yellow-800 dark:text-yellow-300">
                  <InfinityIcon className="h-4 w-4" strokeWidth={2.25} />
                </span>
                Eventos de Empresa
              </SheetTitle>
            </SheetHeader>
          </div>
          <div className="flex-1 overflow-y-auto p-4 sm:p-5">
            {(() => {
              const now = new Date()
              const companyEvents = events
                .filter((e) => e.category === 'company_event' || e.category === 'meeting')
                .filter((e) => {
                  const start = new Date(e.start_date)
                  const end = e.end_date ? new Date(e.end_date) : new Date(start.getTime() + 3600000)
                  return end >= now // include live + future
                })
                .sort((a, b) => {
                  // Live events first, then by start date
                  const aStart = new Date(a.start_date)
                  const aEnd = a.end_date ? new Date(a.end_date) : new Date(aStart.getTime() + 3600000)
                  const bStart = new Date(b.start_date)
                  const bEnd = b.end_date ? new Date(b.end_date) : new Date(bStart.getTime() + 3600000)
                  const aLive = now >= aStart && now <= aEnd
                  const bLive = now >= bStart && now <= bEnd
                  if (aLive && !bLive) return -1
                  if (!aLive && bLive) return 1
                  return aStart.getTime() - bStart.getTime()
                })

              if (companyEvents.length === 0) {
                return <p className="text-sm text-muted-foreground text-center py-8">Sem eventos de empresa.</p>
              }

              return (
                <div className="space-y-2">
                  {companyEvents.map((event) => {
                    const colors = CALENDAR_CATEGORY_COLORS[event.category]
                    const eventDate = parseISO(event.start_date)
                    const dayLabel = format(eventDate, "EEE, d MMM", { locale: ptBR })
                    const eventEnd = event.end_date ? new Date(event.end_date) : new Date(eventDate.getTime() + 3600000)
                    const isLive = now >= eventDate && now <= eventEnd

                    return (
                      <div
                        key={event.id}
                        className={cn(
                          'flex items-start gap-3 rounded-lg border p-3 cursor-pointer hover:bg-muted/30 transition-colors relative overflow-hidden',
                          isLive && 'border-yellow-500/50 bg-yellow-400/10 ring-1 ring-yellow-500/30',
                        )}
                        onClick={() => {
                          setCompanyEventsOpen(false)
                          handleEventClick(event)
                        }}
                      >
                        {/* Live animation border */}
                        {isLive && (
                          <div className="absolute inset-0 rounded-lg pointer-events-none">
                            <div className="absolute inset-0 rounded-lg animate-pulse ring-2 ring-yellow-500/20" />
                          </div>
                        )}

                        <div className={cn('w-1 self-stretch rounded-full shrink-0 relative z-10', isLive ? 'bg-yellow-500' : (colors?.dot || 'bg-primary'))} />
                        <div className="flex-1 min-w-0 relative z-10">
                          {isLive && (
                            <div className="flex items-center gap-1.5 mb-1">
                              <span className="flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-2 w-2 rounded-full bg-yellow-400 opacity-75" />
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-yellow-500" />
                              </span>
                              <span className="text-[10px] font-semibold text-yellow-700 dark:text-yellow-300 uppercase tracking-wider">Em directo</span>
                            </div>
                          )}
                          <p className="text-sm font-medium truncate">{event.title}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{dayLabel}{!event.all_day && ` · ${format(eventDate, 'HH:mm')}`}</p>
                          {event.location && (
                            <p className="text-xs text-muted-foreground truncate mt-0.5">
                              <MapPin className="inline h-3 w-3 mr-0.5" />{event.location}
                            </p>
                          )}
                          {event.requires_rsvp && event.rsvp_counts && (
                            <div className="flex gap-2 mt-1 text-[10px]">
                              <span className="text-emerald-600">{event.rsvp_counts.going} vão</span>
                              <span className="text-red-500">{event.rsvp_counts.not_going} não</span>
                            </div>
                          )}
                        </div>
                        <div className="flex flex-col items-end gap-1.5 shrink-0 relative z-10">
                          {event.cover_image_url && (
                            <img src={event.cover_image_url} alt="" className="h-12 w-16 rounded object-cover" />
                          )}
                          {event.livestream_url && (
                            <a
                              href={event.livestream_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className={cn(
                                'flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-medium transition-colors',
                                isLive
                                  ? 'bg-red-500 text-white hover:bg-red-600'
                                  : 'bg-muted text-muted-foreground hover:bg-muted/80',
                              )}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <Video className="h-3 w-3" />
                              {isLive ? 'Ver' : 'Stream'}
                            </a>
                          )}
                          {event.registration_url && (
                            <a
                              href={event.registration_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-medium bg-blue-500/10 text-blue-600 hover:bg-blue-500/20 transition-colors"
                              onClick={(e) => e.stopPropagation()}
                            >
                              Inscrever
                            </a>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )
            })()}
          </div>
        </SheetContent>
      </Sheet>

      {/* Mobile FAB — attendance (managers only) */}
      {isManager && (
        <Button
          size="icon"
          className="fixed bottom-24 right-3 z-40 h-10 w-10 rounded-full shadow-lg sm:hidden"
          asChild
        >
          <Link href="/dashboard/calendario/assiduidade">
            <BarChart3 className="h-5 w-5" />
          </Link>
        </Button>
      )}
    </div>
  )
}

export default function CalendarioPage() {
  return (
    <Suspense fallback={null}>
      <CalendarioPageInner />
    </Suspense>
  )
}

