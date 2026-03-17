'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import type { GestaoCalendarEvent } from '@/types/marketing'
import type { MarketingOrderItem } from '@/types/marketing'
import { CALENDAR_EVENT_COLORS } from '@/lib/constants'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import { EmptyState } from '@/components/shared/empty-state'
import { UseItemDialog } from '@/components/marketing/use-item-dialog'
import { ChevronLeft, ChevronRight, CalendarDays, Plus, Camera, Package, RefreshCw } from 'lucide-react'

const MONTHS_PT = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

const DAYS_PT = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']

const EVENT_TYPE_LABELS: Record<string, string> = {
  service_scheduled: 'Serviço agendado',
  purchase: 'Compra',
  subscription_renewal: 'Renovação',
}

const EVENT_TYPE_FILTER_LABELS: Record<string, string> = {
  all: 'Todos',
  service_scheduled: 'Serviços',
  purchase: 'Compras',
  subscription_renewal: 'Renovações',
}

export function GestaoCalendarTab() {
  const [events, setEvents] = useState<GestaoCalendarEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })
  const [typeFilter, setTypeFilter] = useState('all')
  const [selectedDay, setSelectedDay] = useState<string | null>(null)

  // For scheduling
  const [availableItems, setAvailableItems] = useState<MarketingOrderItem[]>([])
  const [scheduleItem, setScheduleItem] = useState<MarketingOrderItem | null>(null)

  const [year, month] = currentMonth.split('-').map(Number)

  const fetchEvents = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/marketing/gestao/calendar?month=${currentMonth}`)
      const data = await res.json()
      setEvents(Array.isArray(data) ? data : Array.isArray(data?.events) ? data.events : [])
    } catch {
      setEvents([])
    } finally {
      setLoading(false)
    }
  }, [currentMonth])

  // Fetch available items for scheduling
  const fetchAvailableItems = useCallback(async () => {
    try {
      const res = await fetch('/api/marketing/gestao/active-services')
      const data = await res.json()
      setAvailableItems(Array.isArray(data?.available_items) ? data.available_items : [])
    } catch {
      setAvailableItems([])
    }
  }, [])

  useEffect(() => { fetchEvents() }, [fetchEvents])
  useEffect(() => { fetchAvailableItems() }, [fetchAvailableItems])

  const prevMonth = () => {
    const d = new Date(year, month - 2, 1)
    setCurrentMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
    setSelectedDay(null)
  }

  const nextMonth = () => {
    const d = new Date(year, month, 1)
    setCurrentMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
    setSelectedDay(null)
  }

  const daysInMonth = new Date(year, month, 0).getDate()
  const firstDayOfWeek = (new Date(year, month - 1, 1).getDay() + 6) % 7

  const filteredEvents = useMemo(() => {
    if (typeFilter === 'all') return events
    return events.filter(e => e.type === typeFilter)
  }, [events, typeFilter])

  const eventsByDate = useMemo(() => {
    const map: Record<string, GestaoCalendarEvent[]> = {}
    for (const ev of filteredEvents) {
      if (!map[ev.date]) map[ev.date] = []
      map[ev.date].push(ev)
    }
    return map
  }, [filteredEvents])

  const selectedDayEvents = selectedDay ? (eventsByDate[selectedDay] || []) : []
  const todayStr = new Date().toISOString().split('T')[0]

  // Event counts for sidebar
  const eventCounts = useMemo(() => {
    const counts: Record<string, number> = { all: events.length }
    for (const ev of events) {
      counts[ev.type] = (counts[ev.type] || 0) + 1
    }
    return counts
  }, [events])

  if (loading) {
    return (
      <div className="flex gap-6">
        <div className="flex-1">
          <Skeleton className="h-8 w-48 mb-4" />
          <div className="grid grid-cols-7 gap-1">
            {[...Array(35)].map((_, i) => (
              <Skeleton key={i} className="h-16 rounded-lg" />
            ))}
          </div>
        </div>
        <div className="w-64 shrink-0 space-y-3">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-10 rounded-xl" />)}
        </div>
      </div>
    )
  }

  return (
    <div className="flex gap-6 flex-col lg:flex-row">
      {/* ─── Calendar (main area) ─── */}
      <div className="flex-1 min-w-0">
        <div className="rounded-2xl border bg-card shadow-md p-5">
          {/* Month navigation */}
          <div className="flex items-center justify-between mb-5">
            <Button variant="outline" size="icon" onClick={prevMonth} className="rounded-full h-9 w-9 shadow-sm">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <h3 className="text-base font-bold tracking-tight">
              {MONTHS_PT[month - 1]} {year}
            </h3>
            <Button variant="outline" size="icon" onClick={nextMonth} className="rounded-full h-9 w-9 shadow-sm">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          {/* Day headers */}
          <div className="grid grid-cols-7 gap-1 mb-1">
            {DAYS_PT.map((day) => (
              <div key={day} className="text-center text-[11px] font-semibold text-muted-foreground py-2 uppercase tracking-wider">
                {day}
              </div>
            ))}
          </div>

          {/* Calendar grid */}
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: firstDayOfWeek }).map((_, i) => (
              <div key={`e-${i}`} className="h-16 rounded-xl bg-muted/5" />
            ))}

            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1
              const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
              const dayEvents = eventsByDate[dateStr] || []
              const isToday = dateStr === todayStr
              const isSelected = dateStr === selectedDay
              const hasEvents = dayEvents.length > 0

              return (
                <button
                  key={day}
                  onClick={() => setSelectedDay(isSelected ? null : dateStr)}
                  className={`h-16 p-1.5 rounded-xl text-left transition-all duration-200 ${
                    isSelected
                      ? 'bg-primary/10 shadow-md ring-2 ring-primary/40'
                      : isToday
                        ? 'bg-primary/5 shadow-sm ring-1 ring-primary/30'
                        : hasEvents
                          ? 'bg-muted/10 shadow-sm hover:shadow-md hover:bg-muted/20'
                          : 'hover:bg-muted/10'
                  }`}
                >
                  <div className={`text-xs font-bold ${
                    isSelected ? 'text-primary' : isToday ? 'text-primary' : 'text-foreground/70'
                  }`}>
                    {day}
                  </div>
                  {hasEvents && (
                    <div className="flex gap-1 mt-1 items-center">
                      {dayEvents.slice(0, 3).map((ev, idx) => {
                        const colors = CALENDAR_EVENT_COLORS[ev.type]
                        return (
                          <span key={idx} className={`h-2 w-2 rounded-full ${colors?.dot || 'bg-muted'} shadow-sm`} />
                        )
                      })}
                      {dayEvents.length > 3 && (
                        <span className="text-[9px] font-medium text-muted-foreground">+{dayEvents.length - 3}</span>
                      )}
                    </div>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* ─── Sidebar ─── */}
      <div className="w-full lg:w-72 shrink-0 space-y-5">
        {/* Schedule button — always visible */}
        <div className="rounded-2xl border bg-card shadow-md p-4 space-y-3">
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center h-8 w-8 rounded-full bg-primary/10">
              <Plus className="h-4 w-4 text-primary" />
            </div>
            <h4 className="text-sm font-bold">Agendar Serviço</h4>
          </div>
          {availableItems.length > 0 ? (
            <>
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {availableItems.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setScheduleItem(item)}
                    className="w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-muted/50 hover:shadow-sm transition-all duration-200 group"
                  >
                    <CalendarDays className="h-4 w-4 text-muted-foreground group-hover:text-primary shrink-0 transition-colors" />
                    <div className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{item.name}</span>
                      {item.quantity > 1 && (
                        <span className="text-[10px] text-muted-foreground">
                          {item.quantity - (item.used_count || 0)} restante{(item.quantity - (item.used_count || 0)) !== 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-primary font-medium opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                      Agendar
                    </span>
                  </button>
                ))}
              </div>
            </>
          ) : (
            <p className="text-xs text-muted-foreground py-2">
              Sem serviços disponíveis para agendar. Adquira serviços na loja.
            </p>
          )}
        </div>

        {/* Filters */}
        <div className="rounded-2xl border bg-card shadow-md p-4 space-y-3">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Filtrar por tipo</h4>
          <div className="space-y-1">
            {Object.entries(EVENT_TYPE_FILTER_LABELS).map(([type, label]) => {
              const isActive = typeFilter === type
              const count = eventCounts[type] || 0
              const colors = type !== 'all' ? CALENDAR_EVENT_COLORS[type] : null
              return (
                <button
                  key={type}
                  onClick={() => setTypeFilter(type)}
                  className={`w-full flex items-center justify-between rounded-lg px-3 py-2 text-xs font-medium transition-colors duration-200 ${
                    isActive ? 'bg-muted' : 'hover:bg-muted/50'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {colors && <span className={`h-2 w-2 rounded-full ${colors.dot}`} />}
                    <span>{label}</span>
                  </div>
                  <span className="text-[10px] text-muted-foreground bg-muted/60 rounded-full px-1.5 py-0.5">
                    {count}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Legend */}
        <div className="rounded-2xl border bg-card shadow-md p-4 space-y-2">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Legenda</h4>
          {Object.entries(EVENT_TYPE_LABELS).map(([type, label]) => {
            const colors = CALENDAR_EVENT_COLORS[type]
            return (
              <div key={type} className="flex items-center gap-2 text-xs">
                <span className={`h-2.5 w-2.5 rounded-full ${colors?.dot || 'bg-muted'}`} />
                <span className="text-muted-foreground">{label}</span>
              </div>
            )
          })}
        </div>

        {/* Selected day events */}
        {selectedDay && (
          <div className="rounded-2xl border bg-card shadow-md p-4 space-y-3">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              {parseInt(selectedDay.split('-')[2])} {MONTHS_PT[parseInt(selectedDay.split('-')[1]) - 1]}
            </h4>
            {selectedDayEvents.length === 0 ? (
              <p className="text-xs text-muted-foreground">Sem eventos neste dia.</p>
            ) : (
              <div className="space-y-2">
                {selectedDayEvents.map((ev, idx) => {
                  const colors = CALENDAR_EVENT_COLORS[ev.type]
                  return (
                    <div key={idx} className="flex items-start gap-2">
                      <span className={`mt-1 h-2 w-2 rounded-full shrink-0 ${colors?.dot || 'bg-muted'}`} />
                      <div>
                        <p className="text-xs font-medium leading-snug">{ev.label}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {EVENT_TYPE_LABELS[ev.type] || ev.type}
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Schedule dialog */}
      <UseItemDialog
        open={!!scheduleItem}
        onOpenChange={(open) => { if (!open) setScheduleItem(null) }}
        orderItem={scheduleItem}
        onUsed={() => {
          setScheduleItem(null)
          fetchEvents()
          fetchAvailableItems()
        }}
      />
    </div>
  )
}
