'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import type { MarketingRequest } from '@/types/marketing'
import { MARKETING_CATEGORIES, MARKETING_TIME_SLOTS, formatCurrency } from '@/lib/constants'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent } from '@/components/ui/tabs'
import { EmptyState } from '@/components/shared/empty-state'
import {
  CalendarDays, List, ChevronLeft, ChevronRight, MapPin,
  Clock, User, Building2, Phone, ClipboardList
} from 'lucide-react'

const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string }> = {
  pending: { label: 'Pendente', bg: 'bg-amber-100', text: 'text-amber-800' },
  scheduled: { label: 'Agendado', bg: 'bg-blue-100', text: 'text-blue-800' },
  in_progress: { label: 'Em Curso', bg: 'bg-indigo-100', text: 'text-indigo-800' },
  completed: { label: 'Concluído', bg: 'bg-emerald-100', text: 'text-emerald-800' },
  cancelled: { label: 'Cancelado', bg: 'bg-red-100', text: 'text-red-800' },
}

const DAYS_PT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
const MONTHS_PT = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']

export function MarketingRequestsTab() {
  const [requests, setRequests] = useState<MarketingRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list')
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })

  const fetchRequests = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (statusFilter !== 'all') params.set('status', statusFilter)
      const res = await fetch(`/api/marketing/requests?${params}`)
      const data = await res.json()
      setRequests(Array.isArray(data) ? data : [])
    } catch {
      setRequests([])
    } finally {
      setLoading(false)
    }
  }, [statusFilter])

  useEffect(() => { fetchRequests() }, [fetchRequests])

  // Calendar helpers
  const [calYear, calMonth] = calendarMonth.split('-').map(Number)
  const daysInMonth = new Date(calYear, calMonth, 0).getDate()
  const firstDayOfWeek = new Date(calYear, calMonth - 1, 1).getDay()

  const requestsByDate = useMemo(() => {
    const map: Record<string, MarketingRequest[]> = {}
    for (const req of requests) {
      const date = req.confirmed_date || req.preferred_date
      if (date) {
        if (!map[date]) map[date] = []
        map[date].push(req)
      }
    }
    return map
  }, [requests])

  const prevMonth = () => {
    const d = new Date(calYear, calMonth - 2, 1)
    setCalendarMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }
  const nextMonth = () => {
    const d = new Date(calYear, calMonth, 1)
    setCalendarMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }

  return (
    <div className="space-y-5">
      {/* Toolbar: view toggle + status filter */}
      <div className="flex items-center justify-between gap-3">
        {/* Pill toggle buttons */}
        <div className="flex items-center gap-1.5 rounded-full bg-muted/60 p-1">
          <button
            onClick={() => setViewMode('list')}
            className={`inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-medium transition-all duration-200 ${
              viewMode === 'list'
                ? 'bg-neutral-900 text-white shadow-sm'
                : 'bg-transparent text-muted-foreground hover:text-foreground hover:bg-muted'
            }`}
          >
            <List className="h-3.5 w-3.5" />
            Lista
          </button>
          <button
            onClick={() => setViewMode('calendar')}
            className={`inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-medium transition-all duration-200 ${
              viewMode === 'calendar'
                ? 'bg-neutral-900 text-white shadow-sm'
                : 'bg-transparent text-muted-foreground hover:text-foreground hover:bg-muted'
            }`}
          >
            <CalendarDays className="h-3.5 w-3.5" />
            Calendário
          </button>
        </div>

        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px] rounded-full bg-muted/50 border-0 h-9 text-sm">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os estados</SelectItem>
            {Object.entries(STATUS_CONFIG).map(([value, { label }]) => (
              <SelectItem key={value} value={value}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* List View */}
      {viewMode === 'list' && (
        <>
          {loading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
            </div>
          ) : requests.length === 0 ? (
            <EmptyState
              icon={ClipboardList}
              title="Sem pedidos de marketing"
              description="Os pedidos dos consultores aparecerão aqui."
            />
          ) : (
            <div className="space-y-3">
              {requests.map((req) => {
                const status = STATUS_CONFIG[req.status] || STATUS_CONFIG.pending
                const category = req.order_item?.catalog_item?.category
                const timeLabel = req.confirmed_time
                  ? MARKETING_TIME_SLOTS[req.confirmed_time as keyof typeof MARKETING_TIME_SLOTS] || req.confirmed_time
                  : req.preferred_time
                    ? MARKETING_TIME_SLOTS[req.preferred_time as keyof typeof MARKETING_TIME_SLOTS] || req.preferred_time
                    : null

                return (
                  <div
                    key={req.id}
                    className="group rounded-xl border bg-card p-4 transition-all duration-300 hover:shadow-lg"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-2.5 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-sm">{req.order_item?.name || 'Serviço'}</span>
                          {category && (
                            <span className="rounded-full bg-muted text-[11px] px-2 py-0.5 text-muted-foreground font-medium">
                              {MARKETING_CATEGORIES[category as keyof typeof MARKETING_CATEGORIES]}
                            </span>
                          )}
                          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${status.bg} ${status.text}`}>
                            {status.label}
                          </span>
                        </div>

                        <div className="flex flex-wrap gap-1.5">
                          <span className="inline-flex items-center gap-1 rounded-full bg-muted text-[11px] px-2 py-0.5 text-muted-foreground">
                            <User className="h-3 w-3" />
                            {req.agent?.commercial_name || 'Consultor'}
                          </span>
                          {(req.confirmed_date || req.preferred_date) && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-muted text-[11px] px-2 py-0.5 text-muted-foreground">
                              <CalendarDays className="h-3 w-3" />
                              {req.confirmed_date || req.preferred_date}
                              {req.confirmed_date && (
                                <span className="rounded-full bg-emerald-100 text-emerald-700 text-[9px] px-1.5 py-px font-semibold ml-0.5">
                                  Confirmado
                                </span>
                              )}
                            </span>
                          )}
                          {timeLabel && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-muted text-[11px] px-2 py-0.5 text-muted-foreground">
                              <Clock className="h-3 w-3" />{timeLabel}
                            </span>
                          )}
                          {req.property && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-muted text-[11px] px-2 py-0.5 text-muted-foreground">
                              <Building2 className="h-3 w-3" />
                              {req.property.title}
                            </span>
                          )}
                          {req.address && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-muted text-[11px] px-2 py-0.5 text-muted-foreground">
                              <MapPin className="h-3 w-3" />
                              {req.address}, {req.city}
                            </span>
                          )}
                          {!req.contact_is_agent && req.contact_name && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-muted text-[11px] px-2 py-0.5 text-muted-foreground">
                              <Phone className="h-3 w-3" />
                              {req.contact_name} — {req.contact_phone}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}

      {/* Calendar View */}
      {viewMode === 'calendar' && (
        <Card className="rounded-xl border">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <Button variant="ghost" size="icon" onClick={prevMonth} className="rounded-full h-8 w-8">
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <CardTitle className="text-base font-semibold">
                {MONTHS_PT[calMonth - 1]} {calYear}
              </CardTitle>
              <Button variant="ghost" size="icon" onClick={nextMonth} className="rounded-full h-8 w-8">
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {/* Day headers */}
            <div className="grid grid-cols-7 gap-1 mb-1">
              {DAYS_PT.map(day => (
                <div key={day} className="text-center text-[11px] font-semibold text-muted-foreground py-2 uppercase tracking-wide">
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar grid */}
            <div className="grid grid-cols-7 gap-1">
              {/* Empty cells for days before the 1st */}
              {Array.from({ length: firstDayOfWeek }).map((_, i) => (
                <div key={`empty-${i}`} className="min-h-[80px] rounded-xl bg-muted/20" />
              ))}

              {/* Day cells */}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const day = i + 1
                const dateStr = `${calYear}-${String(calMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`
                const dayRequests = requestsByDate[dateStr] || []
                const isToday = dateStr === new Date().toISOString().split('T')[0]

                return (
                  <div
                    key={day}
                    className={`min-h-[80px] p-1.5 rounded-xl border transition-all duration-200 ${
                      isToday
                        ? 'border-primary bg-primary/5 shadow-sm'
                        : 'border-transparent hover:bg-muted/50 hover:border-muted-foreground/10'
                    }`}
                  >
                    <div className={`text-xs font-semibold mb-1 ${isToday ? 'text-primary' : 'text-muted-foreground'}`}>
                      {day}
                    </div>
                    <div className="space-y-0.5">
                      {dayRequests.slice(0, 3).map((req) => {
                        const status = STATUS_CONFIG[req.status] || STATUS_CONFIG.pending
                        return (
                          <div
                            key={req.id}
                            className={`text-[10px] leading-tight px-1.5 py-0.5 rounded-full ${status.bg} ${status.text} truncate font-medium`}
                            title={`${req.order_item?.name} — ${req.agent?.commercial_name}`}
                          >
                            {req.order_item?.name || 'Pedido'}
                          </div>
                        )
                      })}
                      {dayRequests.length > 3 && (
                        <div className="text-[10px] text-muted-foreground px-1.5 font-medium">
                          +{dayRequests.length - 3} mais
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
