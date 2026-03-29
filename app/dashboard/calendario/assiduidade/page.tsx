'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import {
  BarChart3, Users, Calendar, RefreshCw, CheckCircle2,
  XCircle, Clock, ChevronLeft, AlertTriangle,
} from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { useIsMobile } from '@/hooks/use-mobile'

const PERIODS = [
  { value: '30', label: '30 dias' },
  { value: '90', label: '90 dias' },
  { value: '180', label: '6 meses' },
  { value: '365', label: '1 ano' },
]

interface Absence {
  event_id: string
  event_title: string
  event_date: string
  reason: string | null
}

interface AgentStat {
  id: string
  name: string
  total_events: number
  going: number
  not_going: number
  pending: number
  attendance_rate: number | null
  reasons: string[]
  absences: Absence[]
}

interface EventBreakdown {
  id: string
  title: string
  category: string
  start_date: string
  going: number
  not_going: number
  pending: number
  total: number
}

export default function AssiduidadePage() {
  const [period, setPeriod] = useState('90')
  const [agents, setAgents] = useState<AgentStat[]>([])
  const [events, setEvents] = useState<EventBreakdown[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null)
  const [absenceSheetAgent, setAbsenceSheetAgent] = useState<AgentStat | null>(null)
  const isMobile = useIsMobile()

  const fetchData = useCallback(async () => {
    setIsLoading(true)
    try {
      const from = new Date(Date.now() - parseInt(period) * 86400000).toISOString()
      const params = new URLSearchParams({ from })
      if (selectedAgent) params.set('agent_id', selectedAgent)
      const res = await fetch(`/api/calendar/attendance?${params}`)
      if (res.ok) {
        const json = await res.json()
        setAgents(json.agents ?? [])
        setEvents(json.events ?? [])
      }
    } finally {
      setIsLoading(false)
    }
  }, [period, selectedAgent])

  useEffect(() => { fetchData() }, [fetchData])

  return (
    <div className="space-y-6">
      {/* Hero header */}
      <div className="relative overflow-hidden rounded-xl bg-neutral-900">
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-900/20 via-neutral-900/80 to-neutral-950" />
        <div className="relative z-10 px-6 py-8 sm:px-8 sm:py-10">
          <div className="flex items-center gap-2 mb-2">
            <Button variant="ghost" size="icon" className="text-neutral-400 hover:text-white -ml-2" asChild>
              <Link href="/dashboard/calendario">
                <ChevronLeft className="h-4 w-4" />
              </Link>
            </Button>
            <BarChart3 className="h-4 w-4 text-neutral-400" />
            <span className="text-xs font-medium uppercase tracking-wider text-neutral-400">Calendário</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-white">Assiduidade</h1>
          <p className="text-neutral-400 mt-1 text-sm">
            Presenças em eventos de empresa e reuniões
          </p>
        </div>
        <div className="absolute top-6 right-6 z-20 flex items-center gap-2">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-[120px] h-8 rounded-full text-xs bg-white/10 backdrop-blur-sm text-white border-white/20">
              <Calendar className="h-3 w-3 mr-1.5" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PERIODS.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button
            variant="ghost" size="sm" onClick={fetchData} disabled={isLoading}
            className="rounded-full bg-white/10 text-white border border-white/20 hover:bg-white/20 h-8 w-8 p-0"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", isLoading && "animate-spin")} />
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
        </div>
      ) : (
        <>
          {/* Agent cards */}
          {agents.length > 0 && (
            <div className="space-y-2">
              {agents.map((agent) => {
                const rate = agent.attendance_rate ?? 0
                return (
                  <div
                    key={agent.id}
                    className="flex items-center gap-3 rounded-xl border bg-card/50 px-4 py-3 transition-colors hover:bg-muted/30"
                  >
                    {/* Avatar / rank */}
                    <div className={cn(
                      'flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold',
                      rate >= 80 ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400'
                        : rate >= 50 ? 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400'
                        : 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400',
                    )}>
                      {rate}%
                    </div>

                    {/* Name + stats */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{agent.name}</p>
                      <div className="flex items-center gap-3 mt-0.5 text-[11px] text-muted-foreground">
                        <span>{agent.total_events} eventos</span>
                        <span className="text-emerald-600">
                          <CheckCircle2 className="inline h-3 w-3 mr-0.5" />{agent.going}
                        </span>
                        <span className="text-red-500">
                          <XCircle className="inline h-3 w-3 mr-0.5" />{agent.not_going}
                        </span>
                        {agent.pending > 0 && (
                          <span>
                            <Clock className="inline h-3 w-3 mr-0.5" />{agent.pending}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Absence detail button */}
                    {agent.not_going > 0 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="shrink-0 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950 text-xs"
                        onClick={() => setAbsenceSheetAgent(agent)}
                      >
                        <XCircle className="h-3.5 w-3.5 mr-1" />
                        {agent.not_going} ausência{agent.not_going !== 1 ? 's' : ''}
                      </Button>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {/* Events breakdown */}
          {events.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1 flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5" />
                Eventos ({events.length})
              </h3>
              {events.map((ev) => {
                const total = ev.going + ev.not_going + ev.pending
                const pct = total > 0 ? Math.round((ev.going / total) * 100) : 0
                return (
                  <div key={ev.id} className="flex items-center gap-3 rounded-xl border bg-card/50 px-4 py-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{ev.title}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {format(parseISO(ev.start_date), "d MMM yyyy", { locale: ptBR })}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 text-xs shrink-0">
                      <span className="text-emerald-600 font-medium">{ev.going}</span>
                      <span className="text-muted-foreground">/</span>
                      <span className="text-red-500 font-medium">{ev.not_going}</span>
                      <Badge variant="outline" className={cn('text-[10px] ml-1',
                        pct >= 80 ? 'text-emerald-600 border-emerald-200 dark:border-emerald-800' :
                        pct >= 50 ? 'text-amber-600 border-amber-200 dark:border-amber-800' :
                        'text-red-600 border-red-200 dark:border-red-800'
                      )}>
                        {pct}%
                      </Badge>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {agents.length === 0 && events.length === 0 && (
            <div className="text-center py-16 text-muted-foreground">
              <Calendar className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p className="text-sm">Sem dados de assiduidade neste período.</p>
              <p className="text-xs mt-1">Crie eventos com &quot;Pedir confirmação de presença&quot; activado.</p>
            </div>
          )}
        </>
      )}

      {/* Absence detail sheet */}
      <Sheet open={!!absenceSheetAgent} onOpenChange={(v) => !v && setAbsenceSheetAgent(null)}>
        <SheetContent
          side={isMobile ? 'bottom' : 'right'}
          className={cn(
            'p-0 flex flex-col',
            isMobile ? 'h-[75dvh] rounded-t-2xl' : 'w-full sm:max-w-[400px]',
          )}
        >
          {absenceSheetAgent && (
            <>
              <div className="px-5 pt-5 pb-4 sm:px-6 border-b bg-red-500/5 shrink-0">
                <SheetHeader className="p-0">
                  <SheetTitle className="flex items-center gap-2 text-base">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-red-100 dark:bg-red-950">
                      <AlertTriangle className="h-4 w-4 text-red-500" />
                    </div>
                    Ausências — {absenceSheetAgent.name}
                  </SheetTitle>
                </SheetHeader>
                <p className="text-xs text-muted-foreground mt-1.5">
                  {absenceSheetAgent.not_going} ausência{absenceSheetAgent.not_going !== 1 ? 's' : ''} em {absenceSheetAgent.total_events} eventos
                </p>
              </div>
              <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-2">
                {absenceSheetAgent.absences.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">Sem detalhes de ausências.</p>
                ) : (
                  absenceSheetAgent.absences.map((absence, i) => (
                    <div key={i} className="rounded-lg border p-3 space-y-1.5">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-medium truncate">{absence.event_title}</p>
                        <Badge variant="outline" className="text-[10px] text-red-500 border-red-200 dark:border-red-800 shrink-0">
                          Ausente
                        </Badge>
                      </div>
                      {absence.event_date && (
                        <p className="text-[11px] text-muted-foreground">
                          {format(parseISO(absence.event_date), "EEEE, d 'de' MMMM yyyy", { locale: ptBR })}
                        </p>
                      )}
                      {absence.reason ? (
                        <div className="rounded-md bg-muted/40 px-3 py-2">
                          <p className="text-xs text-muted-foreground italic">&quot;{absence.reason}&quot;</p>
                        </div>
                      ) : (
                        <p className="text-[11px] text-muted-foreground/60">Sem motivo indicado</p>
                      )}
                    </div>
                  ))
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Mobile FAB — back to calendar */}
      <Button
        size="icon"
        className="fixed bottom-20 right-4 z-40 h-12 w-12 rounded-full shadow-lg sm:hidden"
        asChild
      >
        <Link href="/dashboard/calendario">
          <Calendar className="h-5 w-5" />
        </Link>
      </Button>
    </div>
  )
}
