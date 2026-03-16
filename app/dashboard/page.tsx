'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useUser } from '@/hooks/use-user'
import { usePermissions } from '@/hooks/use-permissions'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Progress } from '@/components/ui/progress'
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from '@/components/ui/sheet'
import {
  TrendingUp, TrendingDown, Minus, Building2, Target, Euro,
  Trophy, Calendar, AlertTriangle, AlertCircle,
  ArrowRight, Clock, FileSignature, Home, Handshake,
  Ban, CalendarClock, PiggyBank, Receipt, Wallet,
  MapPin, FileCheck, UserCheck, ChevronRight, Loader2, ExternalLink,
} from 'lucide-react'
import {
  getManagementDashboard,
  getRevenueChart,
  getPerformanceAlerts,
  getAgentRankings,
  getRevenuePipeline,
  getAgentDashboard,
} from '@/app/dashboard/comissoes/actions'
import {
  getDrillDownProperties,
  getDrillDownTransactions,
} from '@/app/dashboard/drill-down-actions'
import type { DrillDownItem } from '@/app/dashboard/drill-down-actions'
import type {
  ManagementDashboard as MgmtData,
  PerformanceAlert,
  AgentRanking,
  RevenuePipelineItem,
  AgentDashboard as AgentData,
} from '@/types/financial'
import Link from 'next/link'

// ─── Formatters ─────────────────────────────────────────────────────────────

const fmt = new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })
const fmtFull = new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' })
const fmtCompact = new Intl.NumberFormat('pt-PT', {
  style: 'currency', currency: 'EUR', notation: 'compact', maximumFractionDigits: 1,
})

function today() {
  return new Date().toLocaleDateString('pt-PT', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
}

function startOfMonth() {
  const d = new Date()
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0]
}

// ─── Drill-Down Sheet ───────────────────────────────────────────────────────

interface DrillDownConfig {
  title: string
  description?: string
  fetcher: () => Promise<{ items: DrillDownItem[]; error: string | null }>
}

function DrillDownSheet({
  config,
  open,
  onOpenChange,
}: {
  config: DrillDownConfig | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const router = useRouter()
  const [items, setItems] = useState<DrillDownItem[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (open && config) {
      setLoading(true)
      setItems([])
      config.fetcher().then(res => {
        if (!res.error) setItems(res.items)
        setLoading(false)
      })
    }
  }, [open, config])

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto px-6 py-8">
        <SheetHeader className="pb-6">
          <SheetTitle className="text-xl">{config?.title || ''}</SheetTitle>
          {config?.description && <SheetDescription>{config.description}</SheetDescription>}
        </SheetHeader>

        {loading ? (
          <div className="space-y-3 px-1">
            {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-20 rounded-xl" />)}
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <Building2 className="h-8 w-8 mb-3 opacity-40" />
            <p className="text-sm">Nenhum resultado encontrado</p>
          </div>
        ) : (
          <div className="space-y-2 px-1">
            {items.map(item => (
              <button
                key={item.id}
                onClick={() => { onOpenChange(false); router.push(item.href) }}
                className="w-full flex items-center gap-3 rounded-xl border bg-card p-4 text-left shadow-sm hover:shadow-md hover:border-primary/30 transition-all group"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold truncate group-hover:text-primary transition-colors">{item.title}</p>
                    {item.badge && (
                      <Badge variant={item.badge.variant} className="text-[10px] shrink-0">
                        {item.badge.label}
                      </Badge>
                    )}
                  </div>
                  {item.subtitle && <p className="text-xs text-muted-foreground mt-1 truncate">{item.subtitle}</p>}
                  {item.date && <p className="text-[11px] text-muted-foreground/70 mt-0.5">{item.date}</p>}
                </div>
                {item.extra && <span className="text-sm font-bold text-right shrink-0">{item.extra}</span>}
                <ChevronRight className="h-4 w-4 text-muted-foreground/30 group-hover:text-primary shrink-0 transition-colors" />
              </button>
            ))}
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}

// ─── Clickable Stat Card ────────────────────────────────────────────────────

function StatCard({ label, value, sub, icon: Icon, accent, onClick }: {
  label: string; value: string; sub?: string; icon: React.ElementType
  accent: 'blue' | 'emerald' | 'amber' | 'violet' | 'red' | 'slate' | 'sky'
  onClick?: () => void
}) {
  const colors = {
    blue: 'bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400',
    emerald: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400',
    amber: 'bg-amber-50 text-amber-600 dark:bg-amber-950 dark:text-amber-400',
    violet: 'bg-violet-50 text-violet-600 dark:bg-violet-950 dark:text-violet-400',
    red: 'bg-red-50 text-red-600 dark:bg-red-950 dark:text-red-400',
    slate: 'bg-slate-50 text-slate-600 dark:bg-slate-950 dark:text-slate-400',
    sky: 'bg-sky-50 text-sky-600 dark:bg-sky-950 dark:text-sky-400',
  }
  const Wrapper = onClick ? 'button' : 'div'
  return (
    <Card className={onClick ? 'cursor-pointer hover:shadow-md hover:border-primary/20 transition-all' : ''}>
      <Wrapper onClick={onClick} className="w-full text-left">
        <CardContent className="flex items-center gap-4 p-5">
          <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${colors[accent]}`}>
            <Icon className="h-6 w-6" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</p>
            <p className="text-2xl font-bold tracking-tight">{value}</p>
            {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
          </div>
          {onClick && <ChevronRight className="h-4 w-4 text-muted-foreground/40 shrink-0" />}
        </CardContent>
      </Wrapper>
    </Card>
  )
}

// ─── Clickable Mini stat ────────────────────────────────────────────────────

function MiniStat({ label, value, accent, onClick }: {
  label: string; value: string | number; accent?: string; onClick?: () => void
}) {
  if (onClick) {
    return (
      <button
        onClick={onClick}
        className="flex items-center justify-between w-full text-left rounded-md border bg-card px-3 py-2 mb-1 hover:shadow-sm hover:border-primary/25 transition-all group"
      >
        <span className="text-[13px] text-muted-foreground group-hover:text-foreground transition-colors">{label}</span>
        <span className="flex items-center gap-1.5">
          <span className={`text-[13px] font-bold ${accent || ''}`}>{value}</span>
          <ChevronRight className="h-3 w-3 text-muted-foreground/30 group-hover:text-primary transition-colors" />
        </span>
      </button>
    )
  }
  return (
    <div className="flex items-center justify-between rounded-md border bg-card/50 px-3 py-2 mb-1">
      <span className="text-[13px] text-muted-foreground">{label}</span>
      <span className={`text-[13px] font-bold ${accent || ''}`}>{value}</span>
    </div>
  )
}

// ─── Skeleton ───────────────────────────────────────────────────────────────

function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <div><Skeleton className="h-8 w-48 mb-2" /><Skeleton className="h-4 w-64" /></div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-28 rounded-xl" />)}
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {[1, 2, 3].map(i => <Skeleton key={i} className="h-64 rounded-xl" />)}
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {[1, 2].map(i => <Skeleton key={i} className="h-72 rounded-xl" />)}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// MANAGEMENT DASHBOARD
// ═══════════════════════════════════════════════════════════════════════════════

function ManagementDashboard() {
  const [data, setData] = useState<MgmtData | null>(null)
  const [chart, setChart] = useState<{ month: string; revenue: number; margin: number }[]>([])
  const [alerts, setAlerts] = useState<PerformanceAlert[]>([])
  const [rankings, setRankings] = useState<AgentRanking[]>([])
  const [pipeline, setPipeline] = useState<RevenuePipelineItem[]>([])
  const [loading, setLoading] = useState(true)

  // Drill-down state
  const [sheetOpen, setSheetOpen] = useState(false)
  const [sheetConfig, setSheetConfig] = useState<DrillDownConfig | null>(null)

  const openDrillDown = useCallback((config: DrillDownConfig) => {
    setSheetConfig(config)
    setSheetOpen(true)
  }, [])

  useEffect(() => {
    // Load KPIs first (fastest), show dashboard immediately, then load rest
    getManagementDashboard().then(res => {
      if (!res.error) { const { error: _, ...rest } = res; setData(rest) }
      setLoading(false)
    })
    // Load secondary data in parallel without blocking render
    getRevenueChart(12).then(res => { if (!res.error) setChart(res.data) })
    getPerformanceAlerts().then(res => { if (!res.error) setAlerts(res.alerts) })
    getAgentRankings('revenue').then(res => { if (!res.error) setRankings(res.rankings.slice(0, 5)) })
    getRevenuePipeline().then(res => { if (!res.error) setPipeline(res.pipeline) })
  }, [])

  if (loading || !data) return <DashboardSkeleton />

  const { forecasts: fc, acquisitions: acq, reporting: rpt, margin: mg, portfolio: pf } = data
  const chartMax = Math.max(...chart.map(c => c.revenue), 1)
  const pipeTotal = pipeline.reduce((s, p) => s + p.weighted_value, 0)
  const urgentAlerts = alerts.filter(a => a.severity === 'urgent').length
  const monthStart = startOfMonth()

  return (
    <div className="flex flex-col gap-6 p-6">
      <DrillDownSheet config={sheetConfig} open={sheetOpen} onOpenChange={setSheetOpen} />

      {/* ─── Header ─── */}
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground capitalize">{today()}</p>
        </div>
        {urgentAlerts > 0 && (
          <Badge variant="destructive" className="gap-1.5">
            <AlertCircle className="h-3.5 w-3.5" />
            {urgentAlerts} {urgentAlerts === 1 ? 'alerta urgente' : 'alertas urgentes'}
          </Badge>
        )}
      </div>

      {/* ─── Row 1: Key Financial KPIs ─── */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Facturação Este Ano" value={fmt.format(rpt.reported_this_year)} sub={`${fmt.format(rpt.reported_this_month)} este mês`} icon={Euro} accent="emerald"
          onClick={() => openDrillDown({
            title: 'Facturação Este Ano',
            description: 'Transacções de comissão pagas este ano',
            fetcher: () => getDrillDownTransactions({ status: 'paid', date_from: `${new Date().getFullYear()}-01-01` }),
          })}
        />
        <StatCard label="Margem Este Ano" value={fmt.format(mg.margin_this_year)} sub={`${fmt.format(mg.margin_this_month)} este mês`} icon={PiggyBank} accent="violet" />
        <StatCard label="Pipeline Ponderado" value={fmt.format(pipeTotal)} sub={`${pipeline.length} negócios activos`} icon={Handshake} accent="blue"
          onClick={() => openDrillDown({
            title: 'Pipeline Activo',
            description: 'Imóveis com processos activos',
            fetcher: () => getDrillDownProperties({ status: ['active'] }),
          })}
        />
        <StatCard label="Carteira Activa" value={fmt.format(pf.active_volume)} sub={`${fmt.format(pf.potential_revenue)} potencial`} icon={Building2} accent="amber"
          onClick={() => openDrillDown({
            title: 'Imóveis Activos',
            description: 'Todos os imóveis activos em carteira',
            fetcher: () => getDrillDownProperties({ status: 'active' }),
          })}
        />
      </div>

      {/* ─── Row 2: Chart + Angariações ─── */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Revenue Chart */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Evolução Mensal</CardTitle>
            <CardDescription>Facturação e margem dos últimos 12 meses</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-[3px] h-44">
              {chart.map((c, i) => {
                const h = Math.max((c.revenue / chartMax) * 100, 2)
                return (
                  <div key={i} className="flex-1 flex flex-col items-center h-full justify-end group relative">
                    <div className="w-full rounded-t-sm bg-blue-500/80 transition-colors group-hover:bg-blue-600" style={{ height: `${h}%` }} />
                    <div className="absolute -top-16 left-1/2 -translate-x-1/2 bg-popover border rounded-lg px-2.5 py-1.5 text-xs shadow-md opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-10">
                      <p className="font-medium">{c.month}</p>
                      <p>Receita: {fmtFull.format(c.revenue)}</p>
                      <p>Margem: {fmtFull.format(c.margin)}</p>
                    </div>
                    <span className="text-[9px] text-muted-foreground mt-1.5 truncate w-full text-center">{c.month}</span>
                  </div>
                )
              })}
            </div>
            <div className="flex gap-4 mt-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-blue-500/80" />Facturação</span>
            </div>
          </CardContent>
        </Card>

        {/* Angariações — every row is clickable */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Angariações</CardTitle>
          </CardHeader>
          <CardContent>
            <MiniStat label="Novas este mês" value={acq.new_this_month}
              onClick={() => openDrillDown({
                title: 'Novas Angariações Este Mês',
                fetcher: () => getDrillDownProperties({ created_after: monthStart }),
              })}
            />
            <MiniStat label="Activas" value={acq.active}
              onClick={() => openDrillDown({
                title: 'Angariações Activas',
                fetcher: () => getDrillDownProperties({ status: 'active' }),
              })}
            />
            <MiniStat label="Reservadas" value={acq.reserved}
              onClick={() => openDrillDown({
                title: 'Imóveis Reservados',
                fetcher: () => getDrillDownProperties({ business_status: 'reserved' }),
              })}
            />
            <MiniStat label="Vendidas (período)" value={acq.sold} accent="text-emerald-600"
              onClick={() => openDrillDown({
                title: 'Imóveis Vendidos',
                fetcher: () => getDrillDownProperties({ status: 'sold' }),
              })}
            />
            <MiniStat label="Canceladas" value={acq.cancelled} accent={acq.cancelled > 0 ? 'text-red-600' : ''}
              onClick={() => openDrillDown({
                title: 'Imóveis Cancelados',
                fetcher: () => getDrillDownProperties({ status: 'cancelled' }),
              })}
            />
            <MiniStat
              label="Dias sem angariar"
              value={`${acq.days_without_acquisition}d`}
              accent={acq.days_without_acquisition > 14 ? 'text-red-600 font-bold' : acq.days_without_acquisition > 7 ? 'text-amber-600' : ''}
              onClick={() => openDrillDown({
                title: 'Últimas Angariações',
                description: 'Imóveis angariados mais recentemente',
                fetcher: () => getDrillDownProperties({ limit: 20 }),
              })}
            />
          </CardContent>
        </Card>
      </div>

      {/* ─── Row 3: Pipeline + Previsões + Pendentes ─── */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Pipeline de Receita</CardTitle>
            <CardDescription>Valor ponderado por probabilidade</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {pipeline.length === 0 && <p className="text-sm text-muted-foreground py-4 text-center">Sem negócios activos</p>}
            {pipeline.map(p => {
              const pipeMax = Math.max(...pipeline.map(x => x.weighted_value), 1)
              return (
                <div key={p.stage}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-muted-foreground">{p.label} <span className="text-[10px]">({Math.round(p.probability * 100)}%)</span></span>
                    <span className="font-medium">{fmt.format(p.weighted_value)}</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div className="h-full rounded-full bg-gradient-to-r from-blue-400 to-blue-600 transition-all" style={{ width: `${(p.weighted_value / pipeMax) * 100}%` }} />
                  </div>
                </div>
              )
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Previsões</CardTitle>
          </CardHeader>
          <CardContent>
            <MiniStat label="Facturação prevista" value={fmt.format(fc.expected_revenue)} />
            <MiniStat label="Margem prevista" value={fmt.format(fc.expected_margin)} />
            <MiniStat label="Angariações previstas" value={fc.expected_acquisitions} />
            <MiniStat label="Pendentes de aprovação" value={fc.pending_acquisitions}
              onClick={() => openDrillDown({
                title: 'Pendentes de Aprovação',
                fetcher: () => getDrillDownProperties({ status: 'pending_approval' }),
              })}
            />
            <MiniStat label="Negócios a fechar" value={fc.expected_deals} />
            <MiniStat label="Negócios activos" value={fc.active_deals} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Valores Pendentes</CardTitle>
          </CardHeader>
          <CardContent>
            <MiniStat label="Assinado por reportar" value={fmt.format(rpt.signed_pending)} accent={rpt.signed_pending > 0 ? 'text-amber-600' : ''}
              onClick={() => openDrillDown({
                title: 'Assinado por Reportar',
                description: 'Transacções pendentes de reporte',
                fetcher: () => getDrillDownTransactions({ status: 'approved' }),
              })}
            />
            <MiniStat label="Assinado por receber" value={fmt.format(mg.pending_collection)} accent={mg.pending_collection > 0 ? 'text-amber-600' : ''}
              onClick={() => openDrillDown({
                title: 'Assinado por Receber',
                description: 'Transacções aprovadas por pagar',
                fetcher: () => getDrillDownTransactions({ status: 'approved' }),
              })}
            />
            <div className="pt-3 mt-1 border-t">
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Facturação Potencial</p>
              <p className="text-lg font-bold">{fmt.format(pf.potential_revenue)}</p>
              <p className="text-xs text-muted-foreground">de {fmt.format(pf.active_volume)} em carteira</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ─── Row 4: Rankings + Alerts ─── */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div>
              <CardTitle className="text-base">Top Consultores</CardTitle>
              <CardDescription>Ranking por facturação YTD</CardDescription>
            </div>
            <Link href="/dashboard/comissoes/rankings" className="text-xs text-primary hover:underline flex items-center gap-1">
              Ver todos <ArrowRight className="h-3 w-3" />
            </Link>
          </CardHeader>
          <CardContent>
            {rankings.length === 0 && <p className="text-sm text-muted-foreground py-4 text-center">Sem dados disponíveis</p>}
            <div className="space-y-2.5">
              {rankings.map(r => {
                const medals = ['', '🥇', '🥈', '🥉']
                const medal = medals[r.position] || ''
                const pct = r.pct_achieved ?? 0
                return (
                  <Link key={r.consultant_id} href={`/dashboard/consultores/${r.consultant_id}`} className="flex items-center gap-3 hover:bg-muted/50 rounded-lg p-1 -mx-1 transition-colors group">
                    <span className="w-8 text-center text-sm font-bold text-muted-foreground">
                      {medal || `#${r.position}`}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium truncate group-hover:text-primary transition-colors">{r.consultant_name}</span>
                        <span className="text-sm font-bold ml-2">{fmt.format(r.value)}</span>
                      </div>
                      {r.target && r.target > 0 && (
                        <div className="flex items-center gap-2">
                          <Progress value={Math.min(pct, 100)} className="h-1.5 flex-1" />
                          <span className="text-[10px] text-muted-foreground w-8 text-right">{Math.round(pct)}%</span>
                        </div>
                      )}
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground/30 group-hover:text-foreground shrink-0 transition-colors" />
                  </Link>
                )
              })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div>
              <CardTitle className="text-base">Alertas de Performance</CardTitle>
              <CardDescription>{alerts.length} {alerts.length === 1 ? 'alerta activo' : 'alertas activos'}</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            {alerts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                <div className="rounded-full bg-emerald-50 p-3 mb-2"><TrendingUp className="h-5 w-5 text-emerald-500" /></div>
                <p className="text-sm">Sem alertas — tudo em ordem!</p>
              </div>
            ) : (
              <div className="space-y-2">
                {alerts.slice(0, 6).map((a, i) => (
                  <Link key={i} href={`/dashboard/consultores/${a.consultant_id}`}
                    className={`flex items-start gap-3 rounded-lg p-3 transition-colors group ${a.severity === 'urgent' ? 'bg-red-50 hover:bg-red-100 dark:bg-red-950/30' : 'bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/30'}`}
                  >
                    {a.severity === 'urgent'
                      ? <AlertCircle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
                      : <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium group-hover:underline">{a.consultant_name}</p>
                      <p className="text-xs text-muted-foreground">{a.message}</p>
                    </div>
                    <Badge variant={a.severity === 'urgent' ? 'destructive' : 'outline'} className="text-[10px] shrink-0">
                      {a.severity === 'urgent' ? 'Urgente' : 'Aviso'}
                    </Badge>
                  </Link>
                ))}
                {alerts.length > 6 && (
                  <p className="text-xs text-center text-muted-foreground pt-1">+{alerts.length - 6} mais alertas</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// AGENT DASHBOARD
// ═══════════════════════════════════════════════════════════════════════════════

function AgentDashboardView({ userId, userName }: { userId: string; userName: string }) {
  const router = useRouter()
  const [data, setData] = useState<AgentData | null>(null)
  const [loading, setLoading] = useState(true)

  // Drill-down
  const [sheetOpen, setSheetOpen] = useState(false)
  const [sheetConfig, setSheetConfig] = useState<DrillDownConfig | null>(null)

  const openDrillDown = useCallback((config: DrillDownConfig) => {
    setSheetConfig(config)
    setSheetOpen(true)
  }, [])

  useEffect(() => {
    async function load() {
      const res = await getAgentDashboard(userId)
      if (!res.error) { const { error: _, ...rest } = res; setData(rest) }
      setLoading(false)
    }
    load()
  }, [userId])

  if (loading || !data) return <DashboardSkeleton />

  const barMax = Math.max(...data.monthly_evolution.map(m => Math.max(m.revenue, m.target)), 1)
  const pctRing = Math.min(data.pct_achieved, 100)
  const monthlyTarget = data.annual_target / 12
  const weeklyTarget = monthlyTarget / 4
  const monthlyPct = monthlyTarget > 0 ? Math.min((data.revenue_this_month / monthlyTarget) * 100, 100) : 0

  const actionIcons: Record<string, React.ElementType> = {
    visit: MapPin, cpcv: FileSignature, escritura: FileCheck,
    contract_expiry: CalendarClock, lead_followup: UserCheck,
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <DrillDownSheet config={sheetConfig} open={sheetOpen} onOpenChange={setSheetOpen} />

      {/* ─── Header ─── */}
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">O Meu Dashboard</h1>
          <p className="text-sm text-muted-foreground">{userName} · <span className="capitalize">{today()}</span></p>
        </div>
        {data.ranking_position > 0 && (
          <Badge variant="outline" className="text-sm px-3 py-1.5 gap-1.5">
            <Trophy className="h-4 w-4 text-amber-500" />
            #{data.ranking_position} de {data.total_agents}
          </Badge>
        )}
      </div>

      {/* ─── Row 1: Financial KPIs ─── */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Facturação YTD" value={fmt.format(data.revenue_ytd)} icon={Euro} accent="emerald"
          onClick={() => openDrillDown({
            title: 'As Minhas Transacções (Ano)',
            fetcher: () => getDrillDownTransactions({ consultant_id: userId, date_from: `${new Date().getFullYear()}-01-01` }),
          })}
        />
        <StatCard label="Este Mês" value={fmt.format(data.revenue_this_month)} icon={Receipt} accent="blue"
          onClick={() => openDrillDown({
            title: 'As Minhas Transacções (Mês)',
            fetcher: () => getDrillDownTransactions({ consultant_id: userId, date_from: startOfMonth() }),
          })}
        />
        <StatCard label="Objectivo Anual" value={fmt.format(data.annual_target)} icon={Target} accent="amber" />
        <Card>
          <CardContent className="flex items-center gap-4 p-5">
            <div className="relative h-14 w-14 shrink-0">
              <svg viewBox="0 0 36 36" className="h-14 w-14 -rotate-90">
                <circle cx="18" cy="18" r="15.9" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-muted" />
                <circle cx="18" cy="18" r="15.9" fill="none" stroke="currentColor" strokeWidth="2.5"
                  className={pctRing >= 80 ? 'text-emerald-500' : pctRing >= 50 ? 'text-amber-500' : 'text-red-500'}
                  strokeDasharray={`${pctRing} ${100 - pctRing}`} strokeLinecap="round" />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-sm font-bold">
                {Math.round(data.pct_achieved)}%
              </span>
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Atingido</p>
              <p className="text-sm font-semibold">{fmt.format(data.revenue_ytd)}</p>
              <p className="text-xs text-muted-foreground">de {fmt.format(data.annual_target)}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ─── Row 2: Properties + Objectives ─── */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Os Meus Imóveis</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Activas', value: data.my_properties.active, color: 'blue', status: 'active' },
                { label: 'Reservadas', value: data.my_properties.reserved, color: 'amber', status: 'reserved' },
                { label: 'Vendidas', value: data.my_properties.sold_year, color: 'emerald', status: 'sold' },
              ].map(tile => (
                <button
                  key={tile.label}
                  onClick={() => openDrillDown({
                    title: `Os Meus Imóveis — ${tile.label}`,
                    fetcher: () => getDrillDownProperties({ consultant_id: userId, status: tile.status }),
                  })}
                  className={`rounded-lg bg-${tile.color}-50 dark:bg-${tile.color}-950/30 p-3 text-center hover:ring-2 hover:ring-${tile.color}-300 transition-all cursor-pointer`}
                >
                  <p className={`text-2xl font-bold text-${tile.color}-600`}>{tile.value}</p>
                  <p className="text-xs text-muted-foreground">{tile.label}</p>
                </button>
              ))}
              <div className="rounded-lg bg-violet-50 dark:bg-violet-950/30 p-3 text-center">
                <p className="text-xl font-bold text-violet-600">{fmtCompact.format(data.my_properties.volume)}</p>
                <p className="text-xs text-muted-foreground">Volume</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Objectivos vs Realizado</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {[
              { label: 'Anual', actual: data.revenue_ytd, target: data.annual_target, pct: data.pct_achieved },
              { label: 'Mensal', actual: data.revenue_this_month, target: monthlyTarget, pct: monthlyPct },
              { label: 'Semanal', actual: 0, target: weeklyTarget, pct: 0 },
            ].map(obj => (
              <div key={obj.label}>
                <div className="flex items-center justify-between text-sm mb-1.5">
                  <span className="font-medium">{obj.label}</span>
                  <span className="text-xs text-muted-foreground">
                    {fmtCompact.format(obj.actual)} <span className="text-muted-foreground/60">/ {fmtCompact.format(obj.target)}</span>
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Progress value={Math.min(obj.pct, 100)} className="h-2.5 flex-1" />
                  <span className={`text-xs font-medium w-10 text-right ${obj.pct >= 80 ? 'text-emerald-600' : obj.pct >= 50 ? 'text-amber-600' : 'text-red-600'}`}>
                    {Math.round(obj.pct)}%
                  </span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* ─── Row 3: Actions + Comparison ─── */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Próximas Acções</CardTitle>
          </CardHeader>
          <CardContent>
            {data.upcoming_actions.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">Sem acções pendentes</p>
            ) : (
              <div className="space-y-1">
                {data.upcoming_actions.slice(0, 7).map((a, i) => {
                  const Icon = actionIcons[a.type] || Calendar
                  const isToday = a.date === new Date().toISOString().split('T')[0]
                  return (
                    <Link key={i} href={a.link || '#'}
                      className={`flex items-center gap-3 rounded-lg p-2.5 hover:bg-muted/70 transition-colors group ${isToday ? 'bg-blue-50 dark:bg-blue-950/30' : ''}`}
                    >
                      <div className={`rounded-lg p-2 ${isToday ? 'bg-blue-100 text-blue-600' : 'bg-muted text-muted-foreground'}`}>
                        <Icon className="h-3.5 w-3.5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">{a.title}</p>
                        {a.property_ref && <p className="text-[11px] text-muted-foreground">{a.property_ref}</p>}
                      </div>
                      <div className="text-right shrink-0 flex items-center gap-1">
                        <p className={`text-xs font-medium ${isToday ? 'text-blue-600' : 'text-muted-foreground'}`}>
                          {isToday ? 'Hoje' : new Date(a.date).toLocaleDateString('pt-PT', { day: 'numeric', month: 'short' })}
                        </p>
                        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/30 group-hover:text-foreground transition-colors" />
                      </div>
                    </Link>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Eu vs Média da Agência</CardTitle>
          </CardHeader>
          <CardContent>
            {data.vs_average.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">Sem dados disponíveis</p>
            ) : (
              <>
                <div className="grid grid-cols-[1fr_auto_auto_auto] gap-x-4 text-xs text-muted-foreground mb-2 px-1">
                  <span /><span className="text-right">Eu</span><span className="text-right">Média</span><span />
                </div>
                {data.vs_average.map((v, i) => {
                  const DirIcon = v.direction === 'above' ? TrendingUp : v.direction === 'below' ? TrendingDown : Minus
                  const dirClass = v.direction === 'above' ? 'text-emerald-600 bg-emerald-50' : v.direction === 'below' ? 'text-red-600 bg-red-50' : 'text-muted-foreground bg-muted'
                  return (
                    <div key={i} className="grid grid-cols-[1fr_auto_auto_auto] gap-x-4 items-center py-2.5 border-b last:border-0 px-1">
                      <span className="text-sm">{v.metric}</span>
                      <span className="text-sm font-semibold text-right">{fmtCompact.format(v.my_value)}</span>
                      <span className="text-sm text-muted-foreground text-right">{fmtCompact.format(v.agency_avg)}</span>
                      <div className={`rounded-full p-1 ${dirClass}`}><DirIcon className="h-3 w-3" /></div>
                    </div>
                  )
                })}
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ─── Row 4: Monthly Evolution ─── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Evolução Mensal</CardTitle>
          <CardDescription>Facturação por mês vs objectivo</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-end gap-[3px] h-44">
            {data.monthly_evolution.map((m, i) => {
              const h = Math.max((m.revenue / barMax) * 100, 2)
              return (
                <div key={i} className="flex-1 flex flex-col items-center h-full justify-end group relative">
                  <div className="w-full rounded-t-sm bg-blue-500/80 transition-colors group-hover:bg-blue-600" style={{ height: `${h}%` }} />
                  <div className="absolute -top-16 left-1/2 -translate-x-1/2 bg-popover border rounded-lg px-2.5 py-1.5 text-xs shadow-md opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-10">
                    <p className="font-medium">{m.month}</p>
                    <p>Receita: {fmtFull.format(m.revenue)}</p>
                    <p>Objectivo: {fmtFull.format(m.target)}</p>
                  </div>
                  <span className="text-[9px] text-muted-foreground mt-1.5 truncate w-full text-center">{m.month}</span>
                </div>
              )
            })}
          </div>
          <div className="flex gap-4 mt-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-blue-500/80" />Facturação</span>
            <span className="flex items-center gap-1.5"><span className="h-0 w-4 border-t-2 border-dashed border-amber-400" />Objectivo</span>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// PAGE ENTRY POINT
// ═══════════════════════════════════════════════════════════════════════════════

export default function DashboardPage() {
  const { user, loading: userLoading } = useUser()
  const { hasPermission, isBroker, loading: permLoading } = usePermissions()

  if (userLoading || permLoading || !user) return <DashboardSkeleton />

  const isManagement = isBroker() || hasPermission('financial' as any)

  if (isManagement) return <ManagementDashboard />

  return (
    <AgentDashboardView
      userId={user.id}
      userName={user.commercial_name || 'Consultor'}
    />
  )
}
