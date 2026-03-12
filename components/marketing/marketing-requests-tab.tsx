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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
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
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex items-center gap-3">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
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

      <Tabs defaultValue="list" className="space-y-4">
        <TabsList>
          <TabsTrigger value="list" className="gap-1.5">
            <List className="h-4 w-4" />Lista
          </TabsTrigger>
          <TabsTrigger value="calendar" className="gap-1.5">
            <CalendarDays className="h-4 w-4" />Calendário
          </TabsTrigger>
        </TabsList>

        {/* List View */}
        <TabsContent value="list">
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
                  <Card key={req.id}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="space-y-2 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium">{req.order_item?.name || 'Serviço'}</span>
                            {category && (
                              <Badge variant="outline" className="text-[10px]">
                                {MARKETING_CATEGORIES[category as keyof typeof MARKETING_CATEGORIES]}
                              </Badge>
                            )}
                            <Badge className={`${status.bg} ${status.text} border-0 text-xs`}>
                              {status.label}
                            </Badge>
                          </div>

                          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <User className="h-3 w-3" />
                              {req.agent?.commercial_name || 'Consultor'}
                            </span>
                            {(req.confirmed_date || req.preferred_date) && (
                              <span className="flex items-center gap-1">
                                <CalendarDays className="h-3 w-3" />
                                {req.confirmed_date || req.preferred_date}
                                {req.confirmed_date && <Badge variant="secondary" className="text-[9px] ml-1">Confirmado</Badge>}
                              </span>
                            )}
                            {timeLabel && (
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />{timeLabel}
                              </span>
                            )}
                            {req.property && (
                              <span className="flex items-center gap-1">
                                <Building2 className="h-3 w-3" />
                                {req.property.title}
                              </span>
                            )}
                            {req.address && (
                              <span className="flex items-center gap-1">
                                <MapPin className="h-3 w-3" />
                                {req.address}, {req.city}
                              </span>
                            )}
                            {!req.contact_is_agent && req.contact_name && (
                              <span className="flex items-center gap-1">
                                <Phone className="h-3 w-3" />
                                {req.contact_name} — {req.contact_phone}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </TabsContent>

        {/* Calendar View */}
        <TabsContent value="calendar">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <Button variant="ghost" size="icon" onClick={prevMonth}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <CardTitle className="text-base">
                  {MONTHS_PT[calMonth - 1]} {calYear}
                </CardTitle>
                <Button variant="ghost" size="icon" onClick={nextMonth}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {/* Day headers */}
              <div className="grid grid-cols-7 gap-px mb-1">
                {DAYS_PT.map(day => (
                  <div key={day} className="text-center text-xs font-medium text-muted-foreground py-2">
                    {day}
                  </div>
                ))}
              </div>

              {/* Calendar grid */}
              <div className="grid grid-cols-7 gap-px">
                {/* Empty cells for days before the 1st */}
                {Array.from({ length: firstDayOfWeek }).map((_, i) => (
                  <div key={`empty-${i}`} className="min-h-[80px] bg-muted/30 rounded-md" />
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
                      className={`min-h-[80px] p-1 rounded-md border ${isToday ? 'border-primary bg-primary/5' : 'border-transparent hover:bg-muted/50'}`}
                    >
                      <div className={`text-xs font-medium mb-1 ${isToday ? 'text-primary' : 'text-muted-foreground'}`}>
                        {day}
                      </div>
                      <div className="space-y-0.5">
                        {dayRequests.slice(0, 3).map((req) => {
                          const status = STATUS_CONFIG[req.status] || STATUS_CONFIG.pending
                          return (
                            <div
                              key={req.id}
                              className={`text-[10px] leading-tight px-1 py-0.5 rounded ${status.bg} ${status.text} truncate`}
                              title={`${req.order_item?.name} — ${req.agent?.commercial_name}`}
                            >
                              {req.order_item?.name || 'Pedido'}
                            </div>
                          )
                        })}
                        {dayRequests.length > 3 && (
                          <div className="text-[10px] text-muted-foreground px-1">
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
        </TabsContent>
      </Tabs>
    </div>
  )
}
