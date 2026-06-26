'use client'

/**
 * Análise — KPI dashboard for the consultor across leads_entries + negocios.
 * Default period: last 30 days. Switcher: Última semana / Último mês / Este ano
 * / Personalizado (range picker).
 *
 * Numbers come from /api/leads/analytics; the endpoint scopes by the
 * authenticated consultor (management can pass agent_id).
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Sparkles, Check, TrendingUp, Briefcase, Timer,
  Trophy, Euro, AlertOctagon, BarChart3, Globe, ArrowDownRight, ArrowUpRight,
  CalendarIcon, CalendarDays, CalendarCheck, Percent,
} from 'lucide-react'
import { format, isValid, parseISO, startOfDay, startOfYear, subDays } from 'date-fns'
import { pt } from 'date-fns/locale'

import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useUser } from '@/hooks/use-user'
import { isManagementRole } from '@/lib/auth/roles'
import { AnaliseScopePicker, type AnaliseScope } from '@/components/leads/pipeline/analise-scope-picker'
import {
  AnaliseDetailSheet,
  type SheetKind,
} from '@/components/leads/pipeline/analise-detail-sheet'
import { getSourceBrand, getPortalBrand } from '@/lib/leads/source-brand'
import { cn } from '@/lib/utils'

type Preset = 'week' | 'month' | 'year' | 'custom'

interface Aggregates {
  leads: {
    total: number
    qualified: number
    qualifyRate: number
    bySource: Record<string, number>
    byPortal: Record<string, number>
    funnel: { novo: number; contactado: number; qualificado: number; perdido: number }
    lostReasons: Record<string, number>
    avgFirstContactHours: number | null
    avgQualifyHours: number | null
  }
  negocios: {
    total: number
    won: number
    lost: number
    open: number
    winRate: number
    avgValueEur: number | null
    pipelineOpenEur: number
    wonEur: number
    avgCloseDays: number | null
    bySector: Record<string, number>
    bySource: Record<string, number>
    byPortal: Record<string, number>
    statusFunnel: { aberto: number; ganho: number; perdido: number }
    lostReasons: Record<string, number>
  }
  visits: {
    scheduled: number // agendadas (todos os agendamentos reais do período)
    completed: number // realizadas
    noShow: number
    cancelled: number
    pending: number // ainda por realizar (data futura)
    due: number // agendamentos já vencidos
    completionRate: number // realizadas ÷ vencidas
  }
}

interface AnalyticsResponse extends Aggregates {
  range: { from: string; to: string; previousFrom: string; previousTo: string }
  previous: Aggregates
}


function presetRange(p: Preset): { from: string; to: string } | null {
  const today = startOfDay(new Date())
  const toStr = format(today, 'yyyy-MM-dd')
  if (p === 'week') return { from: format(subDays(today, 6), 'yyyy-MM-dd'), to: toStr }
  if (p === 'month') return { from: format(subDays(today, 29), 'yyyy-MM-dd'), to: toStr }
  if (p === 'year') return { from: format(startOfYear(today), 'yyyy-MM-dd'), to: toStr }
  return null
}

const EUR = new Intl.NumberFormat('pt-PT', {
  style: 'currency', currency: 'EUR', maximumFractionDigits: 0,
})

function formatHours(h: number | null): string {
  if (h == null) return '—'
  if (h < 1) return `${Math.round(h * 60)} min`
  if (h < 24) return `${h.toFixed(1)} h`
  return `${(h / 24).toFixed(1)} dias`
}

function formatDays(d: number | null): string {
  if (d == null) return '—'
  if (d < 1) return `${(d * 24).toFixed(1)} h`
  return `${d.toFixed(1)} dias`
}

function pctDelta(current: number, prev: number): number | null {
  if (prev === 0) return current === 0 ? 0 : null
  return ((current - prev) / prev) * 100
}

function DeltaChip({ delta, invert = false }: { delta: number | null; invert?: boolean }) {
  if (delta == null) return null
  const positive = invert ? delta < 0 : delta > 0
  const negative = invert ? delta > 0 : delta < 0
  const Icon = delta > 0 ? ArrowUpRight : delta < 0 ? ArrowDownRight : null
  return (
    <span
      className={cn(
        'inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-medium tabular-nums',
        positive && 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
        negative && 'bg-red-500/10 text-red-600 dark:text-red-400',
        !positive && !negative && 'bg-muted/60 text-muted-foreground',
      )}
    >
      {Icon && <Icon className="h-2.5 w-2.5" />}
      {Math.abs(delta).toFixed(0)}%
    </span>
  )
}

interface KpiProps {
  Icon: typeof Sparkles
  label: string
  value: string | number
  delta?: number | null
  /** When true, a negative delta is shown as "positive" (e.g. time-to-close drops are good). */
  invertDelta?: boolean
  hint?: string
  onClick?: () => void
}

function KpiCard({ Icon, label, value, delta, invertDelta, hint, onClick }: KpiProps) {
  const interactive = !!onClick
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!interactive}
      className={cn(
        'text-left rounded-2xl border border-border/40 bg-card/60 backdrop-blur-sm p-4 space-y-1.5 transition-all',
        interactive && 'hover:border-primary/40 hover:shadow-sm cursor-pointer',
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-medium text-muted-foreground">
          <Icon className="h-3 w-3 text-muted-foreground/70" />
          {label}
        </span>
        <DeltaChip delta={delta ?? null} invert={invertDelta} />
      </div>
      <div className="text-2xl font-bold tabular-nums">{value}</div>
      {hint && <div className="text-[11px] text-muted-foreground">{hint}</div>}
    </button>
  )
}

function BreakdownList({
  title,
  Icon,
  data,
  brandKind,
  labelMap,
  emptyText = 'Sem dados no período',
  onClick,
}: {
  title: string
  Icon: typeof BarChart3
  data: Record<string, number>
  /** Renders a favicon + brand-coloured progress bar when set. */
  brandKind?: 'source' | 'portal'
  labelMap?: Record<string, string>
  emptyText?: string
  onClick?: () => void
}) {
  const entries = Object.entries(data).sort((a, b) => b[1] - a[1])
  const max = entries[0]?.[1] ?? 0
  const interactive = !!onClick

  return (
    <Card
      onClick={onClick}
      className={cn(
        'border-border/40 bg-card/60 transition-all',
        interactive && 'cursor-pointer hover:border-primary/40 hover:shadow-sm',
      )}
    >
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold inline-flex items-center gap-2">
          <Icon className="h-4 w-4 text-muted-foreground" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        {entries.length === 0 ? (
          <p className="text-xs text-muted-foreground py-2">{emptyText}</p>
        ) : (
          <ul className="space-y-2">
            {entries.map(([key, count]) => {
              const pct = max > 0 ? (count / max) * 100 : 0
              let label = labelMap?.[key] || key
              let logoUrl: string | null = null
              let color: string | null = null
              if (brandKind === 'source') {
                const b = getSourceBrand(key)
                label = b.label
                logoUrl = b.logoUrl
                color = b.color
              } else if (brandKind === 'portal') {
                const b = getPortalBrand(key)
                label = b.label
                logoUrl = b.logoUrl
                color = b.color
              }
              return (
                <li key={key}>
                  <div className="flex items-center gap-2 text-xs">
                    {brandKind && (
                      logoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={logoUrl} alt="" className="h-3.5 w-3.5 rounded-sm shrink-0" />
                      ) : (
                        <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: color ?? '#94A3B8' }} />
                      )
                    )}
                    <span className="flex-1 truncate">{label}</span>
                    <span className="tabular-nums font-medium">{count}</span>
                  </div>
                  <div className="mt-1 h-1.5 rounded-full bg-muted/50 overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${pct}%`, backgroundColor: color ?? 'hsl(var(--primary) / 0.7)' }}
                    />
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}

interface FunnelStep { key: string; label: string; value: number; color: string }

function FunnelCard({
  title = 'Funil de leads',
  steps,
  onClick,
}: {
  title?: string
  steps: FunnelStep[]
  onClick?: () => void
}) {
  const max = Math.max(...steps.map((s) => s.value), 1)
  const interactive = !!onClick

  return (
    <Card
      onClick={onClick}
      className={cn(
        'border-border/40 bg-card/60 transition-all',
        interactive && 'cursor-pointer hover:border-primary/40 hover:shadow-sm',
      )}
    >
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold inline-flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-muted-foreground" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0 space-y-3">
        {steps.map((s) => {
          const pct = (s.value / max) * 100
          return (
            <div key={s.key}>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-muted-foreground">{s.label}</span>
                <span className="tabular-nums font-medium">{s.value}</span>
              </div>
              <div className="h-2 rounded-full bg-muted/50 overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: s.color }} />
              </div>
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}

export function AnaliseTab() {
  const { user } = useUser()
  const isManagement = isManagementRole(user?.role_names ?? [])

  const [preset, setPreset] = useState<Preset>('month')
  const [from, setFrom] = useState<string | null>(null)
  const [to, setTo] = useState<string | null>(null)
  // Management can switch between Empresa (kind=company) and a specific
  // consultor. Non-management always sees their own data.
  const [scope, setScope] = useState<AnaliseScope>({ kind: 'company' })
  const [data, setData] = useState<AnalyticsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [sheetConfig, setSheetConfig] = useState<SheetKind | null>(null)
  const openSheet = useCallback((cfg: SheetKind) => setSheetConfig(cfg), [])
  const agentParam = isManagement ? (scope.kind === 'company' ? 'all' : scope.agentId) : undefined

  // Apply preset → derived from/to (unless custom).
  useEffect(() => {
    if (preset === 'custom') return
    const r = presetRange(preset)
    if (r) { setFrom(r.from); setTo(r.to) }
  }, [preset])

  const fetchData = useCallback(async () => {
    if (!from || !to) return
    setLoading(true)
    try {
      const params = new URLSearchParams({
        from: new Date(`${from}T00:00:00.000Z`).toISOString(),
        to: new Date(`${to}T23:59:59.999Z`).toISOString(),
      })
      if (isManagement) {
        params.set('agent_id', scope.kind === 'company' ? 'all' : scope.agentId)
      }
      const res = await fetch(`/api/leads/analytics?${params}`)
      if (!res.ok) throw new Error()
      setData(await res.json())
    } catch { setData(null) }
    finally { setLoading(false) }
  }, [from, to, scope, isManagement])

  useEffect(() => { fetchData() }, [fetchData])

  const rangeLabel = useMemo(() => {
    if (!from || !to) return ''
    const f = parseISO(from)
    const t = parseISO(to)
    if (!isValid(f) || !isValid(t)) return ''
    return `${format(f, 'dd MMM', { locale: pt })} – ${format(t, 'dd MMM yyyy', { locale: pt })}`
  }, [from, to])

  return (
    <div className="space-y-5">
      {/* Scope picker — management only. */}
      {isManagement && (
        <AnaliseScopePicker scope={scope} onChange={setScope} />
      )}

      {/* Period switcher */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="inline-flex items-center gap-0.5 p-0.5 rounded-full bg-muted/40 border border-border/30">
          {([
            { key: 'week' as Preset,   label: 'Esta semana',  short: 'Semana' },
            { key: 'month' as Preset,  label: 'Último mês',   short: 'Mês' },
            { key: 'year' as Preset,   label: 'Este ano',     short: 'Ano' },
            { key: 'custom' as Preset, label: 'Personalizado', short: 'Custom' },
          ]).map(({ key, label, short }) => (
            <button
              key={key}
              type="button"
              onClick={() => setPreset(key)}
              className={cn(
                'px-3 py-1 rounded-full text-xs font-medium transition-colors whitespace-nowrap',
                preset === key
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <span className="sm:hidden">{short}</span>
              <span className="hidden sm:inline">{label}</span>
            </button>
          ))}
        </div>
        {preset === 'custom' && (
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 rounded-full text-xs">
                <CalendarIcon className="h-3.5 w-3.5 mr-1.5" />
                {rangeLabel || 'Escolher datas'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="range"
                selected={{
                  from: from && isValid(parseISO(from)) ? parseISO(from) : undefined,
                  to:   to   && isValid(parseISO(to))   ? parseISO(to)   : undefined,
                }}
                onSelect={(r) => {
                  setFrom(r?.from ? format(r.from, 'yyyy-MM-dd') : null)
                  setTo(r?.to ? format(r.to, 'yyyy-MM-dd') : null)
                }}
                locale={pt}
                numberOfMonths={2}
                captionLayout="dropdown"
                fromYear={2020}
                toYear={new Date().getFullYear() + 1}
              />
            </PopoverContent>
          </Popover>
        )}
        {preset !== 'custom' && from && to && (
          <span className="text-xs text-muted-foreground">{rangeLabel}</span>
        )}
      </div>

      {loading || !data ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-2xl" />
          ))}
        </div>
      ) : (
        <>
          {/* KPI row 1 — Leads */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KpiCard
              Icon={Sparkles}
              label="Leads"
              value={data.leads.total}
              delta={pctDelta(data.leads.total, data.previous.leads.total)}
              onClick={() => openSheet({ layout: 'list', title: 'Leads no período', selector: { kind: 'entries', filter: 'all' } })}
            />
            <KpiCard
              Icon={Check}
              label="Qualificados"
              value={data.leads.qualified}
              delta={pctDelta(data.leads.qualified, data.previous.leads.qualified)}
              onClick={() => openSheet({ layout: 'list', title: 'Leads qualificadas', selector: { kind: 'entries', filter: 'qualified' } })}
            />
            <KpiCard
              Icon={TrendingUp}
              label="Taxa qualif."
              value={`${(data.leads.qualifyRate * 100).toFixed(0)}%`}
              delta={pctDelta(data.leads.qualifyRate, data.previous.leads.qualifyRate)}
              onClick={() => openSheet({ layout: 'list', title: 'Todas as leads (rate)', selector: { kind: 'entries', filter: 'all' } })}
            />
            <KpiCard
              Icon={Timer}
              label="Tempo 1.º contacto"
              value={formatHours(data.leads.avgFirstContactHours)}
              invertDelta
              hint="Lead → 1.º contacto"
              onClick={() => openSheet({ layout: 'list', title: 'Leads contactadas', selector: { kind: 'entries', filter: 'all' } })}
            />
          </div>

          {/* KPI row 2 — Oportunidades / dinheiro */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KpiCard
              Icon={Briefcase}
              label="Oportunidades"
              value={data.negocios.total}
              delta={pctDelta(data.negocios.total, data.previous.negocios.total)}
              onClick={() => openSheet({ layout: 'list', title: 'Oportunidades', selector: { kind: 'negocios', filter: 'all' } })}
            />
            <KpiCard
              Icon={Trophy}
              label="Ganhas"
              value={data.negocios.won}
              delta={pctDelta(data.negocios.won, data.previous.negocios.won)}
              hint={`Taxa fecho ${(data.negocios.winRate * 100).toFixed(0)}%`}
              onClick={() => openSheet({ layout: 'list', title: 'Negócios ganhos', selector: { kind: 'negocios', filter: 'won' } })}
            />
            <KpiCard
              Icon={Timer}
              label="Tempo médio fecho"
              value={formatDays(data.negocios.avgCloseDays)}
              invertDelta
              onClick={() => openSheet({ layout: 'list', title: 'Negócios ganhos (tempo de fecho)', selector: { kind: 'negocios', filter: 'won' } })}
            />
            <KpiCard
              Icon={Euro}
              label="Valor médio negócio"
              value={data.negocios.avgValueEur != null ? EUR.format(data.negocios.avgValueEur) : '—'}
              onClick={() => openSheet({ layout: 'list', title: 'Negócios (valor)', selector: { kind: 'negocios', filter: 'all' } })}
            />
          </div>

          {/* KPI row 3 — pipeline / qualify time (timeline+list on click) */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <KpiCard
              Icon={Euro}
              label="Pipeline aberto"
              value={EUR.format(data.negocios.pipelineOpenEur)}
              hint={`${data.negocios.open} negócios em aberto`}
              onClick={() => openSheet({
                layout: 'timeline',
                title: 'Pipeline aberto',
                selector: { kind: 'negocios', filter: 'open' },
                useDate: 'created_at',
                valueKey: 'value',
              })}
            />
            <KpiCard
              Icon={Trophy}
              label="Fechado (€)"
              value={EUR.format(data.negocios.wonEur)}
              onClick={() => openSheet({
                layout: 'timeline',
                title: 'Negócios fechados',
                selector: { kind: 'negocios', filter: 'won' },
                useDate: 'won_date',
                valueKey: 'value',
              })}
            />
            <KpiCard
              Icon={Timer}
              label="Tempo médio para qualificar"
              value={formatHours(data.leads.avgQualifyHours)}
              invertDelta
              hint="Lead → Qualificado"
              onClick={() => openSheet({
                layout: 'timeline',
                title: 'Leads qualificadas',
                selector: { kind: 'entries', filter: 'qualified' },
                useDate: 'processed_at',
                valueKey: 'count',
              })}
            />
          </div>

          {/* KPI row — Visitas (agendadas vs realizadas) */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <KpiCard
              Icon={CalendarDays}
              label="Visitas agendadas"
              value={data.visits.scheduled}
              delta={pctDelta(data.visits.scheduled, data.previous.visits.scheduled)}
              hint={data.visits.pending > 0 ? `${data.visits.pending} por realizar` : 'Agendamentos no período'}
            />
            <KpiCard
              Icon={CalendarCheck}
              label="Visitas realizadas"
              value={data.visits.completed}
              delta={pctDelta(data.visits.completed, data.previous.visits.completed)}
              hint={`de ${data.visits.due} já vencidas`}
            />
            <KpiCard
              Icon={Percent}
              label="Taxa de realização"
              value={data.visits.due > 0 ? `${(data.visits.completionRate * 100).toFixed(0)}%` : '—'}
              delta={pctDelta(data.visits.completionRate, data.previous.visits.completionRate)}
              hint={`${data.visits.noShow} faltou · ${data.visits.cancelled} cancel.`}
            />
          </div>

          {/* Breakdowns — open a donut sheet on click */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            <BreakdownList
              title="Leads por origem"
              Icon={BarChart3}
              data={data.leads.bySource}
              brandKind="source"
              onClick={() => openSheet({ layout: 'donut', title: 'Leads por origem', data: data.leads.bySource, brandKind: 'source' })}
            />
            <BreakdownList
              title="Leads por portal"
              Icon={Globe}
              data={data.leads.byPortal}
              brandKind="portal"
              emptyText="Nenhuma lead veio de um portal."
              onClick={() => openSheet({ layout: 'donut', title: 'Leads por portal', data: data.leads.byPortal, brandKind: 'portal' })}
            />
            <FunnelCard
              title="Funil de leads"
              steps={[
                { key: 'novo',         label: 'Novo',         value: data.leads.funnel.novo,         color: '#3b82f6' },
                { key: 'contactado',   label: 'Contactado',   value: data.leads.funnel.contactado,   color: '#f59e0b' },
                { key: 'qualificado',  label: 'Qualificado',  value: data.leads.funnel.qualificado,  color: '#10b981' },
                { key: 'perdido',      label: 'Perdido',      value: data.leads.funnel.perdido,      color: '#ef4444' },
              ]}
              onClick={() => openSheet({
                layout: 'donut',
                title: 'Funil de leads',
                data: data.leads.funnel as unknown as Record<string, number>,
                colorMap: { novo: '#3b82f6', contactado: '#f59e0b', qualificado: '#10b981', perdido: '#ef4444' },
                labelMap: { novo: 'Novo', contactado: 'Contactado', qualificado: 'Qualificado', perdido: 'Perdido' },
              })}
            />
            {/* Same shape as leads — origem + portal + funil — but at the deal level. */}
            <BreakdownList
              title="Oportunidades por origem"
              Icon={BarChart3}
              data={data.negocios.bySource}
              brandKind="source"
              emptyText="Sem oportunidades."
              onClick={() => openSheet({ layout: 'donut', title: 'Oportunidades por origem', data: data.negocios.bySource, brandKind: 'source' })}
            />
            <BreakdownList
              title="Oportunidades por portal"
              Icon={Globe}
              data={data.negocios.byPortal}
              brandKind="portal"
              emptyText="Nenhuma oportunidade veio de um portal."
              onClick={() => openSheet({ layout: 'donut', title: 'Oportunidades por portal', data: data.negocios.byPortal, brandKind: 'portal' })}
            />
            <FunnelCard
              title="Funil de oportunidades"
              steps={[
                { key: 'aberto',  label: 'Aberto',  value: data.negocios.statusFunnel.aberto,  color: '#3b82f6' },
                { key: 'ganho',   label: 'Ganho',   value: data.negocios.statusFunnel.ganho,   color: '#10b981' },
                { key: 'perdido', label: 'Perdido', value: data.negocios.statusFunnel.perdido, color: '#ef4444' },
              ]}
              onClick={() => openSheet({
                layout: 'donut',
                title: 'Funil de oportunidades',
                data: data.negocios.statusFunnel as unknown as Record<string, number>,
                colorMap: { aberto: '#3b82f6', ganho: '#10b981', perdido: '#ef4444' },
                labelMap: { aberto: 'Aberto', ganho: 'Ganho', perdido: 'Perdido' },
              })}
            />

            <BreakdownList
              title="Motivos de perda (leads)"
              Icon={AlertOctagon}
              data={data.leads.lostReasons}
              emptyText="Sem leads perdidas."
              onClick={() => openSheet({ layout: 'donut', title: 'Motivos de perda (leads)', data: data.leads.lostReasons })}
            />
            <BreakdownList
              title="Negócios por tipo"
              Icon={Briefcase}
              data={data.negocios.bySector}
              emptyText="Sem negócios."
              onClick={() => openSheet({ layout: 'donut', title: 'Negócios por tipo', data: data.negocios.bySector })}
            />
            <BreakdownList
              title="Motivos de perda (negócios)"
              Icon={AlertOctagon}
              data={data.negocios.lostReasons}
              emptyText="Sem negócios perdidos."
              onClick={() => openSheet({ layout: 'donut', title: 'Motivos de perda (negócios)', data: data.negocios.lostReasons })}
            />
          </div>
        </>
      )}

      <AnaliseDetailSheet
        open={!!sheetConfig}
        onOpenChange={(o) => { if (!o) setSheetConfig(null) }}
        config={sheetConfig}
        from={from}
        to={to}
        agentParam={agentParam}
      />
    </div>
  )
}
