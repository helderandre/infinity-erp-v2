// @ts-nocheck
'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useUser } from '@/hooks/use-user'
import { usePermissions } from '@/hooks/use-permissions'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from '@/components/ui/sheet'
import {
  TrendingUp, TrendingDown, Minus, Building2, Target, Euro,
  Trophy, Calendar, AlertTriangle, AlertCircle,
  ArrowRight, Clock, FileSignature, Home, Handshake,
  PiggyBank, Receipt, Wallet,
  MapPin, FileCheck, UserCheck, ChevronRight, Sparkles,
} from 'lucide-react'
import { cn } from '@/lib/utils'
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

// ─── Formatters ──────────────────────────────────────────────────────────────

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

// ─── Drill-Down Sheet ────────────────────────────────────────────────────────

interface DrillDownConfig {
  title: string
  description?: string
  fetcher: () => Promise<{ items: DrillDownItem[]; error: string | null }>
}

function DrillDownSheet({ config, open, onOpenChange }: {
  config: DrillDownConfig | null; open: boolean; onOpenChange: (open: boolean) => void
}) {
  const router = useRouter()
  const [items, setItems] = useState<DrillDownItem[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (open && config) {
      setLoading(true); setItems([])
      config.fetcher().then(res => { if (!res.error) setItems(res.items); setLoading(false) })
    }
  }, [open, config])

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto px-6 py-0">
        <div className="-mx-6 mb-5 bg-neutral-900 px-6 py-6">
          <SheetHeader>
            <SheetTitle className="text-white text-lg">{config?.title || ''}</SheetTitle>
            {config?.description && <SheetDescription className="text-neutral-400">{config.description}</SheetDescription>}
          </SheetHeader>
          {!loading && items.length > 0 && (
            <div className="mt-3 inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-full px-3 py-1.5">
              <span className="text-white text-sm font-bold tabular-nums">{items.length}</span>
              <span className="text-neutral-400 text-xs">{items.length === 1 ? 'resultado' : 'resultados'}</span>
            </div>
          )}
        </div>
        <div className="pb-6">
        {loading ? (
          <div className="space-y-3">{[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-20 rounded-xl" />)}</div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <Building2 className="h-8 w-8 mb-3 opacity-40" />
            <p className="text-sm">Nenhum resultado encontrado</p>
          </div>
        ) : (
          <div className="space-y-2">
            {items.map(item => (
              <button key={item.id} onClick={() => { onOpenChange(false); router.push(item.href) }}
                className="w-full flex items-center gap-3 rounded-xl border border-white/50 dark:border-white/10 bg-white/60 dark:bg-neutral-900/60 backdrop-blur-xl shadow-[0_1px_3px_rgba(0,0,0,0.08),0_4px_12px_rgba(0,0,0,0.04)] p-4 text-left hover:shadow-md hover:bg-card/80 transition-all group"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold truncate group-hover:text-primary transition-colors">{item.title}</p>
                    {item.badge && <Badge variant={item.badge.variant} className="text-[10px] shrink-0 rounded-full">{item.badge.label}</Badge>}
                  </div>
                  {item.subtitle && <p className="text-xs text-muted-foreground mt-1 truncate">{item.subtitle}</p>}
                  {item.date && <p className="text-[11px] text-muted-foreground/70 mt-0.5">{item.date}</p>}
                </div>
                {item.extra && <span className="text-sm font-bold text-right shrink-0">{item.extra}</span>}
                <ChevronRight className="h-4 w-4 text-muted-foreground/30 group-hover:text-primary shrink-0" />
              </button>
            ))}
          </div>
        )}
        </div>
      </SheetContent>
    </Sheet>
  )
}

// ─── Mini Sparkline SVG ──────────────────────────────────────────────────────

function MiniSparkline({ data, color, height = 32, width = 64 }: {
  data: number[]; color: string; height?: number; width?: number
}) {
  if (data.length < 2) return null
  const max = Math.max(...data, 1)
  const min = Math.min(...data, 0)
  const range = max - min || 1
  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width
    const y = height - ((v - min) / range) * (height * 0.8) - height * 0.1
    return `${x},${y}`
  }).join(' ')

  const trend = data[data.length - 1] >= data[data.length - 2]

  return (
    <svg width={width} height={height} className="overflow-visible">
      <defs>
        <linearGradient id={`spark-${color}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={trend ? '#10b981' : '#ef4444'} stopOpacity="0.3" />
          <stop offset="100%" stopColor={trend ? '#10b981' : '#ef4444'} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon
        points={`0,${height} ${points} ${width},${height}`}
        fill={`url(#spark-${color})`}
      />
      <polyline
        points={points}
        fill="none"
        stroke={trend ? '#10b981' : '#ef4444'}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

// ─── KPI Card ────────────────────────────────────────────────────────────────

function KpiCard({ label, value, sub, icon: Icon, iconBg, iconColor, valueColor, onClick, trend, sparkData }: {
  label: string; value: string; sub?: string; icon: React.ElementType
  iconBg: string; iconColor: string; valueColor?: string; onClick?: () => void
  trend?: { value: number; label: string }; sparkData?: number[]
}) {
  const Comp = onClick ? 'button' : 'div'
  const isUp = trend && trend.value >= 0
  return (
    <Comp
      onClick={onClick}
      className={cn(
        'relative rounded-2xl border border-white/60 dark:border-white/10 bg-white/70 dark:bg-neutral-900/70 backdrop-blur-xl p-5 shadow-[0_1px_3px_rgba(0,0,0,0.08),0_4px_12px_rgba(0,0,0,0.04)] transition-all duration-300 hover:shadow-lg hover:shadow-black/[0.06] text-left w-full overflow-hidden',
        onClick && 'cursor-pointer group'
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider mb-2">{label}</p>
          <p className={cn('text-2xl font-bold tracking-tight tabular-nums', valueColor)}>{value}</p>
          <div className="flex items-center gap-2 mt-1">
            {trend && (
              <span className={cn(
                'inline-flex items-center gap-0.5 text-[11px] font-medium',
                isUp ? 'text-emerald-600' : 'text-red-500'
              )}>
                {isUp ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                {isUp ? '+' : ''}{trend.value}%
              </span>
            )}
            {sub && <p className="text-[11px] text-muted-foreground">{sub}</p>}
          </div>
        </div>
        {sparkData && sparkData.length > 1 && (
          <div className="shrink-0 mt-1">
            <MiniSparkline data={sparkData} color={label.replace(/\s/g, '')} />
          </div>
        )}
        {!sparkData && onClick && <ChevronRight className="h-4 w-4 text-muted-foreground/30 group-hover:text-foreground shrink-0 transition-colors mt-2" />}
      </div>
    </Comp>
  )
}

// ─── Mini stat row ───────────────────────────────────────────────────────────

function MiniStat({ label, value, accent, onClick }: {
  label: string; value: string | number; accent?: string; onClick?: () => void
}) {
  if (onClick) {
    return (
      <button onClick={onClick}
        className="flex items-center justify-between w-full text-left rounded-xl bg-white/50 dark:bg-white/5 backdrop-blur-sm border border-white/40 dark:border-white/5 px-3.5 py-2.5 mb-1.5 hover:shadow-sm hover:bg-white/80 dark:hover:bg-white/10 transition-all group"
      >
        <span className="text-xs text-muted-foreground group-hover:text-foreground transition-colors">{label}</span>
        <span className="flex items-center gap-1.5">
          <span className={cn('text-xs font-bold tabular-nums', accent)}>{value}</span>
          <ChevronRight className="h-3 w-3 text-muted-foreground/30 group-hover:text-primary transition-colors" />
        </span>
      </button>
    )
  }
  return (
    <div className="flex items-center justify-between rounded-xl bg-white/50 dark:bg-white/5 backdrop-blur-sm border border-white/40 dark:border-white/5 px-3.5 py-2.5 mb-1.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={cn('text-xs font-bold tabular-nums', accent)}>{value}</span>
    </div>
  )
}

// ─── Skeleton ────────────────────────────────────────────────────────────────

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-32 rounded-xl" />
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24 rounded-2xl" />)}
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {[1, 2, 3].map(i => <Skeleton key={i} className="h-64 rounded-2xl" />)}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// MANAGEMENT DASHBOARD
// ═══════════════════════════════════════════════════════════════════════════════

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

type ChartPeriod = '3m' | '6m' | '12m' | 'ytd'
type TimePeriod = 'ytd' | 'month' | 'custom'

function ManagementDashboard() {
  const [data, setData] = useState<MgmtData | null>(null)
  const [chart, setChart] = useState<{ month: string; revenue: number; margin: number }[]>([])
  const [alerts, setAlerts] = useState<PerformanceAlert[]>([])
  const [rankings, setRankings] = useState<AgentRanking[]>([])
  const [rankingsAcq, setRankingsAcq] = useState<AgentRanking[]>([])
  const [pipeline, setPipeline] = useState<RevenuePipelineItem[]>([])
  const [loading, setLoading] = useState(true)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [sheetConfig, setSheetConfig] = useState<DrillDownConfig | null>(null)
  const [chartPeriod, setChartPeriod] = useState<ChartPeriod>('12m')
  const [rankingTab, setRankingTab] = useState<'revenue' | 'acquisitions'>('revenue')
  const [rankingPeriod, setRankingPeriod] = useState<TimePeriod>('ytd')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')

  const openDrillDown = useCallback((config: DrillDownConfig) => {
    setSheetConfig(config); setSheetOpen(true)
  }, [])

  // Ranking date helpers
  const rankingDateFrom = rankingPeriod === 'month'
    ? startOfMonth()
    : rankingPeriod === 'custom' && customFrom
      ? customFrom
      : `${new Date().getFullYear()}-01-01`

  const rankingDateTo = rankingPeriod === 'custom' && customTo ? customTo : undefined

  const rankingApiPeriod = rankingPeriod === 'month' ? 'month' : undefined

  // Fetch rankings when period changes
  const fetchRankings = useCallback(() => {
    getAgentRankings('revenue', rankingApiPeriod).then(res => { if (!res.error) setRankings(res.rankings) })
    getAgentRankings('acquisitions', rankingApiPeriod).then(res => { if (!res.error) setRankingsAcq(res.rankings) })
  }, [rankingApiPeriod])

  useEffect(() => {
    getManagementDashboard().then(res => {
      if (!res.error) { const { error: _, ...rest } = res; setData(rest) }
      setLoading(false)
    })
    getRevenueChart(12).then(res => { if (!res.error) setChart(res.data) })
    getPerformanceAlerts().then(res => { if (!res.error) setAlerts(res.alerts) })
    getRevenuePipeline().then(res => { if (!res.error) setPipeline(res.pipeline) })
  }, [])

  useEffect(() => { fetchRankings() }, [fetchRankings])

  if (loading || !data) return <DashboardSkeleton />

  const { forecasts: fc, acquisitions: acq, reporting: rpt, margin: mg, portfolio: pf } = data
  const pipeTotal = pipeline.reduce((s, p) => s + p.weighted_value, 0)
  const urgentAlerts = alerts.filter(a => a.severity === 'urgent').length
  const monthStart = startOfMonth()

  // Filter chart by period
  const filteredChart = chartPeriod === '3m' ? chart.slice(-3) : chartPeriod === '6m' ? chart.slice(-6) : chartPeriod === 'ytd' ? chart.filter(c => {
    const currentYear = new Date().getFullYear().toString()
    return c.month.includes(currentYear) || c.month.includes(currentYear.slice(-2))
  }) : chart
  const chartMax = Math.max(...filteredChart.map(c => c.revenue), 1)

  // Strip year from month labels (e.g. "Jan 2026" → "Jan")
  const shortMonth = (m: string) => m.replace(/\s*\d{4}$/, '').replace(/\s*'\d{2}$/, '')

  const currentRankings = rankingTab === 'revenue' ? rankings : rankingsAcq

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-400">
      <DrillDownSheet config={sheetConfig} open={sheetOpen} onOpenChange={setSheetOpen} />

      {/* Hero — clean, large type */}
      <div className="pt-2">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">Dashboard</h1>
            <p className="text-sm text-muted-foreground capitalize mt-1">{today()}</p>
          </div>
          <div className="hidden md:flex items-center gap-4">
            <div className="rounded-2xl border border-white/60 dark:border-white/10 bg-white/70 dark:bg-neutral-900/70 backdrop-blur-xl shadow-[0_1px_3px_rgba(0,0,0,0.08),0_4px_12px_rgba(0,0,0,0.04)] px-5 py-3 text-center">
              <p className="text-xl font-bold text-emerald-600 tabular-nums">{fmt.format(rpt.reported_this_month)}</p>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">Este Mês</p>
            </div>
            <div className="rounded-2xl border border-white/60 dark:border-white/10 bg-white/70 dark:bg-neutral-900/70 backdrop-blur-xl shadow-[0_1px_3px_rgba(0,0,0,0.08),0_4px_12px_rgba(0,0,0,0.04)] px-5 py-3 text-center">
              <p className="text-xl font-bold tabular-nums">{fmt.format(rpt.reported_this_year)}</p>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">Este Ano</p>
            </div>
            {urgentAlerts > 0 && (
              <Badge variant="destructive" className="gap-1.5 rounded-full h-8 px-3">
                <AlertCircle className="h-3.5 w-3.5" />
                {urgentAlerts} alertas
              </Badge>
            )}
          </div>
        </div>
      </div>

      {/* Main Tabs */}
      <Tabs defaultValue="overview">
        <TabsList className="inline-flex items-center gap-1 p-1 rounded-full bg-white/50 dark:bg-white/5 backdrop-blur-xl border border-white/60 dark:border-white/10 shadow-[0_1px_3px_rgba(0,0,0,0.08),0_4px_12px_rgba(0,0,0,0.04)] h-auto">
          {[
            { value: 'overview', label: 'Visão Geral', icon: Euro },
            { value: 'pipeline', label: 'Pipeline', icon: Handshake },
            { value: 'rankings', label: 'Rankings', icon: Trophy },
            { value: 'alerts', label: 'Alertas', icon: AlertTriangle, badge: urgentAlerts > 0 ? urgentAlerts : null },
          ].map(tab => (
            <TabsTrigger key={tab.value} value={tab.value}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-medium transition-colors duration-300 data-[state=active]:bg-neutral-900 data-[state=active]:text-white data-[state=active]:shadow-sm dark:data-[state=active]:bg-white dark:data-[state=active]:text-neutral-900 data-[state=inactive]:text-muted-foreground data-[state=inactive]:bg-transparent hover:text-foreground border-0 flex-initial"
            >
              <tab.icon className="h-3.5 w-3.5" />
              {tab.label}
              {tab.badge && <Badge variant="destructive" className="text-[9px] rounded-full px-1.5 ml-0.5 h-4 min-w-4">{tab.badge}</Badge>}
            </TabsTrigger>
          ))}
        </TabsList>

        {/* ═══ Tab: Visão Geral ═══ */}
        <TabsContent value="overview" className="mt-6 space-y-6">
          {/* KPIs */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard label="Facturação YTD" value={fmt.format(rpt.reported_this_year)} sub="este mês"
              icon={Euro} iconBg="bg-neutral-100 dark:bg-white/10" iconColor="text-foreground"
              sparkData={chart.slice(-6).map(c => c.revenue)}
              trend={chart.length >= 2 ? { value: Math.round(((chart[chart.length - 1]?.revenue || 0) / Math.max(chart[chart.length - 2]?.revenue || 1, 1) - 1) * 100), label: 'vs mês anterior' } : undefined}
              onClick={() => openDrillDown({ title: 'Facturação Este Ano', fetcher: () => getDrillDownTransactions({ status: 'paid', date_from: `${new Date().getFullYear()}-01-01` }) })}
            />
            <KpiCard label="Margem YTD" value={fmt.format(mg.margin_this_year)} sub="este mês"
              icon={PiggyBank} iconBg="bg-neutral-100 dark:bg-white/10" iconColor="text-foreground"
              sparkData={chart.slice(-6).map(c => c.margin)}
              trend={chart.length >= 2 ? { value: Math.round(((chart[chart.length - 1]?.margin || 0) / Math.max(chart[chart.length - 2]?.margin || 1, 1) - 1) * 100), label: 'vs mês anterior' } : undefined}
            />
            <KpiCard label="Pipeline Ponderado" value={fmt.format(pipeTotal)} sub={`${pipeline.length} negócios`}
              icon={Handshake} iconBg="bg-neutral-100 dark:bg-white/10" iconColor="text-foreground"
              onClick={() => openDrillDown({ title: 'Pipeline Ativo', fetcher: () => getDrillDownProperties({ status: ['active'] }) })}
            />
            <KpiCard label="Carteira Ativa" value={fmt.format(pf.active_volume)} sub={`${fmtCompact.format(pf.potential_revenue)} potencial`}
              icon={Building2} iconBg="bg-neutral-100 dark:bg-white/10" iconColor="text-foreground"
              onClick={() => openDrillDown({ title: 'Imóveis Ativos', fetcher: () => getDrillDownProperties({ status: 'active' }) })}
            />
          </div>

          {/* Chart + Angariações */}
          <div className="grid gap-4 lg:grid-cols-3">
            {/* Revenue Chart */}
            <div className="lg:col-span-2 rounded-2xl border border-white/60 dark:border-white/10 bg-white/70 dark:bg-neutral-900/70 backdrop-blur-xl shadow-[0_1px_3px_rgba(0,0,0,0.08),0_4px_12px_rgba(0,0,0,0.04)] p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-sm font-semibold">Evolução Mensal</h3>
                  <p className="text-[11px] text-muted-foreground">Facturação por mês</p>
                </div>
                <div className="inline-flex items-center gap-0.5 p-0.5 rounded-full bg-muted/30">
                  {([['3m', '3M'], ['6m', '6M'], ['12m', '12M'], ['ytd', 'YTD']] as const).map(([val, label]) => (
                    <button key={val} onClick={() => setChartPeriod(val)}
                      className={cn('px-3 py-1 rounded-full text-[10px] font-medium transition-colors',
                        chartPeriod === val ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 shadow-sm' : 'text-muted-foreground hover:text-foreground'
                      )}
                    >{label}</button>
                  ))}
                </div>
              </div>
              {/* Revenue summary */}
              {filteredChart.length > 0 && (
                <div className="flex items-baseline gap-3 mb-4">
                  <span className="text-3xl font-bold tabular-nums tracking-tight">{fmt.format(filteredChart.reduce((s, c) => s + c.revenue, 0))}</span>
                  {filteredChart.length >= 2 && (() => {
                    const curr = filteredChart[filteredChart.length - 1]?.revenue || 0
                    const prev = filteredChart[filteredChart.length - 2]?.revenue || 1
                    const pctChange = Math.round(((curr / Math.max(prev, 1)) - 1) * 100)
                    return (
                      <span className={cn('inline-flex items-center gap-0.5 text-xs font-medium rounded-full px-2 py-0.5',
                        pctChange >= 0 ? 'bg-emerald-500/10 text-emerald-600' : 'bg-red-500/10 text-red-500'
                      )}>
                        {pctChange >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                        {pctChange >= 0 ? '+' : ''}{pctChange}% vs mês anterior
                      </span>
                    )
                  })()}
                </div>
              )}
              <div className="flex items-end gap-[3px] h-40">
                {filteredChart.map((c, i) => {
                  const h = Math.max((c.revenue / chartMax) * 100, 4)
                  const isLast = i === filteredChart.length - 1
                  const isPrev = i === filteredChart.length - 2
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center h-full justify-end group relative">
                      <div className={cn(
                        'w-full rounded-lg transition-all duration-300',
                        isLast ? 'bg-neutral-900 dark:bg-white' :
                        isPrev ? 'bg-neutral-400/50 dark:bg-neutral-500/50' :
                        'bg-neutral-200 dark:bg-neutral-700/50',
                        'group-hover:opacity-90'
                      )}
                        style={{ height: `${h}%` }}
                      />
                      <div className="absolute -top-14 left-1/2 -translate-x-1/2 bg-neutral-900 text-white rounded-xl px-3 py-2 text-[11px] shadow-2xl opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-10">
                        <p className="font-semibold">{c.month}</p>
                        <p className="text-neutral-300 tabular-nums">{fmtFull.format(c.revenue)}</p>
                      </div>
                      <span className="text-[9px] text-muted-foreground mt-2 truncate w-full text-center font-medium">{shortMonth(c.month)}</span>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Angariações */}
            <div className="rounded-2xl border border-white/60 dark:border-white/10 bg-white/70 dark:bg-neutral-900/70 backdrop-blur-xl shadow-[0_1px_3px_rgba(0,0,0,0.08),0_4px_12px_rgba(0,0,0,0.04)] p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold">Angariações</h3>
                <div className="rounded-full px-2.5 py-1 text-[10px] font-bold tabular-nums bg-neutral-100 dark:bg-white/10 text-foreground">
                  {acq.days_without_acquisition}d sem angariar
                </div>
              </div>

              {/* Grid of stats */}
              <div className="grid grid-cols-2 gap-2 mb-3">
                {[
                  { label: 'Novas', value: acq.new_this_month, fetcher: () => getDrillDownProperties({ created_after: monthStart }) },
                  { label: 'Ativas', value: acq.active, fetcher: () => getDrillDownProperties({ status: 'active' }) },
                  { label: 'Reservadas', value: acq.reserved, fetcher: () => getDrillDownProperties({ status: 'reserved' }) },
                  { label: 'Vendidas', value: acq.sold, fetcher: () => getDrillDownProperties({ status: 'sold' }) },
                ].map(s => (
                  <button key={s.label} onClick={() => openDrillDown({ title: s.label, fetcher: s.fetcher })}
                    className="rounded-xl p-3 text-center transition-all hover:shadow-md bg-neutral-50 dark:bg-white/5 border border-neutral-200/60 dark:border-white/5 group"
                  >
                    <p className="text-2xl font-bold tabular-nums">{s.value}</p>
                    <p className="text-[10px] text-muted-foreground font-medium">{s.label}</p>
                  </button>
                ))}
              </div>

              <button onClick={() => openDrillDown({ title: 'Canceladas', fetcher: () => getDrillDownProperties({ status: 'cancelled' }) })}
                className="w-full flex items-center justify-between rounded-xl bg-muted/20 px-3.5 py-2.5 hover:bg-muted/40 transition-all group"
              >
                <span className="text-xs text-muted-foreground">Canceladas</span>
                <span className="flex items-center gap-1.5">
                  <span className={cn('text-xs font-bold tabular-nums', acq.cancelled > 0 ? 'text-red-600' : '')}>{acq.cancelled}</span>
                  <ChevronRight className="h-3 w-3 text-muted-foreground/30 group-hover:text-primary transition-colors" />
                </span>
              </button>
            </div>
          </div>

          {/* Forecasts + Pending — side by side */}
          <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-white/60 dark:border-white/10 bg-white/70 dark:bg-neutral-900/70 backdrop-blur-xl shadow-[0_1px_3px_rgba(0,0,0,0.08),0_4px_12px_rgba(0,0,0,0.04)] p-5">
            <h3 className="text-sm font-semibold mb-4">Previsões</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {[
                { label: 'Facturação Prevista', value: fmt.format(fc.expected_revenue) },
                { label: 'Margem Prevista', value: fmt.format(fc.expected_margin) },
                { label: 'Angariações Previstas', value: String(fc.expected_acquisitions) },
                { label: 'Negócios a Fechar', value: String(fc.expected_deals) },
                { label: 'Negócios Ativos', value: String(fc.active_deals) },
                { label: 'Pendentes Aprovação', value: String(fc.pending_acquisitions),
                  onClick: () => openDrillDown({ title: 'Pendentes Aprovação', fetcher: () => getDrillDownProperties({ status: 'pending_approval' }) }) },
              ].map((tile) => {
                const Comp = tile.onClick ? 'button' : 'div'
                return (
                  <Comp key={tile.label} onClick={tile.onClick}
                    className={cn('rounded-xl p-4 text-left transition-all bg-neutral-50 dark:bg-white/5 border border-neutral-200/60 dark:border-white/5', tile.onClick && 'hover:shadow-md cursor-pointer group')}
                  >
                    <p className="text-2xl font-bold tabular-nums tracking-tight">{tile.value}</p>
                    <p className="text-[10px] text-muted-foreground font-medium mt-1 leading-tight flex items-center justify-between">
                      {tile.label}
                      {tile.onClick && <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/30 group-hover:text-foreground transition-colors" />}
                    </p>
                  </Comp>
                )
              })}
            </div>
          </div>

          {/* Valores Pendentes */}
          <div className="rounded-2xl border border-white/60 dark:border-white/10 bg-white/70 dark:bg-neutral-900/70 backdrop-blur-xl shadow-[0_1px_3px_rgba(0,0,0,0.08),0_4px_12px_rgba(0,0,0,0.04)] p-5">
            <h3 className="text-sm font-semibold mb-4">Valores Pendentes</h3>

            <div className="grid grid-cols-2 gap-3 mb-3">
              {/* Por reportar */}
              <button onClick={() => openDrillDown({ title: 'Por Reportar', fetcher: () => getDrillDownTransactions({ status: 'approved' }) })}
                className="rounded-xl bg-neutral-50 dark:bg-white/5 border border-neutral-200/60 dark:border-white/5 p-4 text-left hover:shadow-md transition-all group"
              >
                <div className="flex items-center gap-2 mb-1">
                  {rpt.signed_pending > 0 && <span className="h-2 w-2 rounded-full bg-neutral-900 dark:bg-white animate-pulse" />}
                  <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Por Reportar</p>
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-2xl font-bold tabular-nums tracking-tight">
                    {fmt.format(rpt.signed_pending)}
                  </p>
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/30 group-hover:text-foreground transition-colors self-end" />
                </div>
              </button>

              {/* Por receber */}
              <button onClick={() => openDrillDown({ title: 'Por Receber', fetcher: () => getDrillDownTransactions({ status: 'approved' }) })}
                className="rounded-xl bg-neutral-50 dark:bg-white/5 border border-neutral-200/60 dark:border-white/5 p-4 text-left hover:shadow-md transition-all group"
              >
                <div className="flex items-center gap-2 mb-1">
                  {mg.pending_collection > 0 && <span className="h-2 w-2 rounded-full bg-neutral-900 dark:bg-white animate-pulse" />}
                  <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Por Receber</p>
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-2xl font-bold tabular-nums tracking-tight">
                    {fmt.format(mg.pending_collection)}
                  </p>
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/30 group-hover:text-foreground transition-colors self-end" />
                </div>
              </button>
            </div>

            {/* Receita Potencial */}
            <div className="rounded-xl bg-neutral-900 dark:bg-white p-4 shadow-lg shadow-neutral-900/20 dark:shadow-black/10">
              <p className="text-[10px] text-neutral-400 dark:text-neutral-500 uppercase tracking-wider font-medium">Receita Potencial</p>
              <p className="text-2xl font-bold text-white dark:text-neutral-900 tabular-nums mt-1">{fmt.format(pf.potential_revenue)}</p>
              <div className="mt-3 h-2 rounded-full bg-white/10 dark:bg-neutral-200 overflow-hidden">
                <div className="h-full rounded-full bg-emerald-500 transition-all duration-500" style={{ width: `${Math.min((rpt.reported_this_year / Math.max(pf.potential_revenue, 1)) * 100, 100)}%` }} />
              </div>
              <div className="flex items-center justify-between mt-2">
                <p className="text-[10px] text-neutral-500 dark:text-neutral-400">{fmtCompact.format(rpt.reported_this_year)} realizado</p>
                <p className="text-[10px] text-neutral-500 dark:text-neutral-400">{fmtCompact.format(pf.active_volume)} carteira</p>
              </div>
            </div>
          </div>
          </div>
        </TabsContent>

        {/* ═══ Tab: Pipeline ═══ */}
        <TabsContent value="pipeline" className="mt-6 space-y-6">
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-white/60 dark:border-white/10 bg-white/70 dark:bg-neutral-900/70 backdrop-blur-xl shadow-[0_1px_3px_rgba(0,0,0,0.08),0_4px_12px_rgba(0,0,0,0.04)] p-5">
              <h3 className="text-sm font-semibold mb-1">Pipeline de Receita</h3>
              <p className="text-[11px] text-muted-foreground mb-4">Valor ponderado por fase × probabilidade</p>
              {pipeline.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">Sem negócios activos</p>
              ) : (
                <div className="space-y-4">
                  {pipeline.map(p => {
                    const pMax = Math.max(...pipeline.map(x => x.weighted_value), 1)
                    return (
                      <div key={p.stage}>
                        <div className="flex justify-between text-xs mb-1.5">
                          <span className="font-medium">{p.label}</span>
                          <span className="font-bold tabular-nums">{fmt.format(p.weighted_value)}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="flex-1 h-3 rounded-full bg-muted/50 overflow-hidden">
                            <div className="h-full rounded-full bg-gradient-to-r from-blue-400 to-blue-600 transition-all duration-500" style={{ width: `${(p.weighted_value / pMax) * 100}%` }} />
                          </div>
                          <span className="text-[10px] text-muted-foreground w-10 text-right tabular-nums">{Math.round(p.probability * 100)}%</span>
                        </div>
                      </div>
                    )
                  })}
                  <div className="rounded-xl bg-muted/30 p-3 flex items-center justify-between mt-2">
                    <span className="text-xs font-medium">Total Ponderado</span>
                    <span className="text-lg font-bold tabular-nums">{fmt.format(pipeTotal)}</span>
                  </div>
                </div>
              )}
            </div>
            <div className="rounded-2xl border border-white/60 dark:border-white/10 bg-white/70 dark:bg-neutral-900/70 backdrop-blur-xl shadow-[0_1px_3px_rgba(0,0,0,0.08),0_4px_12px_rgba(0,0,0,0.04)] p-5">
              <h3 className="text-sm font-semibold mb-3">Previsões</h3>
              <MiniStat label="Facturação prevista" value={fmt.format(fc.expected_revenue)} />
              <MiniStat label="Margem prevista" value={fmt.format(fc.expected_margin)} />
              <MiniStat label="Negócios a fechar" value={fc.expected_deals} />
              <MiniStat label="Negócios activos" value={fc.active_deals} />
              <MiniStat label="Pendentes aprovação" value={fc.pending_acquisitions}
                onClick={() => openDrillDown({ title: 'Pendentes Aprovação', fetcher: () => getDrillDownProperties({ status: 'pending_approval' }) })}
              />
            </div>
          </div>
        </TabsContent>

        {/* ═══ Tab: Rankings ═══ */}
        <TabsContent value="rankings" className="mt-6 space-y-4">
          {/* Controls row */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Metric pills */}
            <div className="inline-flex items-center gap-1 p-1 rounded-full bg-white/50 dark:bg-white/5 backdrop-blur-xl border border-white/50 dark:border-white/10 shadow-[0_1px_3px_rgba(0,0,0,0.08),0_4px_12px_rgba(0,0,0,0.04)]">
              <button onClick={() => setRankingTab('revenue')}
                className={cn('px-4 py-1.5 rounded-full text-xs font-medium transition-colors duration-300',
                  rankingTab === 'revenue' ? 'bg-neutral-900 text-white shadow-sm dark:bg-white dark:text-neutral-900' : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                )}
              >Facturação</button>
              <button onClick={() => setRankingTab('acquisitions')}
                className={cn('px-4 py-1.5 rounded-full text-xs font-medium transition-colors duration-300',
                  rankingTab === 'acquisitions' ? 'bg-neutral-900 text-white shadow-sm dark:bg-white dark:text-neutral-900' : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                )}
              >Angariações</button>
            </div>

            {/* Period pills */}
            <div className="inline-flex items-center gap-1 p-1 rounded-full bg-white/50 dark:bg-white/5 backdrop-blur-xl border border-white/50 dark:border-white/10 shadow-[0_1px_3px_rgba(0,0,0,0.08),0_4px_12px_rgba(0,0,0,0.04)]">
              {([['ytd', 'Este Ano'], ['month', 'Este Mês'], ['custom', 'Personalizado']] as const).map(([val, label]) => (
                <button key={val} onClick={() => setRankingPeriod(val)}
                  className={cn('px-3 py-1.5 rounded-full text-[10px] font-medium transition-colors duration-300',
                    rankingPeriod === val ? 'bg-neutral-900 text-white shadow-sm dark:bg-white dark:text-neutral-900' : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                  )}
                >{label}</button>
              ))}
            </div>

            {/* Custom date inputs */}
            {rankingPeriod === 'custom' && (
              <div className="flex items-center gap-2">
                <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)}
                  className="h-8 rounded-full border bg-background px-3 text-xs" />
                <span className="text-xs text-muted-foreground">a</span>
                <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)}
                  className="h-8 rounded-full border bg-background px-3 text-xs" />
              </div>
            )}

          </div>

          <div className="rounded-2xl border border-white/60 dark:border-white/10 bg-white/70 dark:bg-neutral-900/70 backdrop-blur-xl shadow-[0_1px_3px_rgba(0,0,0,0.08),0_4px_12px_rgba(0,0,0,0.04)] overflow-hidden">
            {currentRankings.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground"><p className="text-sm">Sem dados disponíveis</p></div>
            ) : (
              <div className="divide-y divide-border/50">
                {currentRankings.map((r) => {
                  const medals = ['', '🥇', '🥈', '🥉']
                  const medal = medals[r.position] || ''
                  const pct = r.pct_achieved ?? 0
                  const isTop3 = r.position <= 3
                  return (
                    <button
                      key={r.consultant_id}
                      onClick={() => openDrillDown({
                        title: r.consultant_name,
                        description: rankingTab === 'revenue'
                          ? `Facturação: ${fmt.format(r.value)}`
                          : `${r.value} angariações`,
                        fetcher: rankingTab === 'revenue'
                          ? () => getDrillDownTransactions({ consultant_id: r.consultant_id, date_from: rankingDateFrom, date_to: rankingDateTo })
                          : () => getDrillDownProperties({ consultant_id: r.consultant_id, created_after: rankingDateFrom }),
                      })}
                      className={cn(
                        'w-full flex items-center gap-3 px-4 py-2.5 hover:bg-muted/30 transition-colors group text-left',
                      )}
                    >
                      <span className={cn('w-7 text-center font-bold shrink-0 text-xs', isTop3 ? 'text-sm' : 'text-muted-foreground')}>
                        {medal || `#${r.position}`}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium truncate group-hover:text-primary transition-colors">
                            {r.consultant_name}
                          </span>
                          <span className="text-sm font-bold tabular-nums ml-3 shrink-0">
                            {rankingTab === 'revenue' ? fmt.format(r.value) : r.value}
                          </span>
                        </div>
                        {r.target && r.target > 0 && (
                          <div className="flex items-center gap-2 mt-1">
                            <div className="flex-1 h-1.5 rounded-full bg-muted/50 overflow-hidden">
                              <div className="h-full rounded-full bg-neutral-900 dark:bg-white transition-all duration-500"
                                style={{ width: `${Math.min(pct, 100)}%` }} />
                            </div>
                            <span className="text-[10px] font-medium w-8 text-right tabular-nums text-muted-foreground">{Math.round(pct)}%</span>
                          </div>
                        )}
                      </div>
                      <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/30 group-hover:text-foreground shrink-0 transition-colors" />
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </TabsContent>

        {/* ═══ Tab: Alertas ═══ */}
        <TabsContent value="alerts" className="mt-6">
          <div className="rounded-2xl border border-white/60 dark:border-white/10 bg-white/70 dark:bg-neutral-900/70 backdrop-blur-xl shadow-[0_1px_3px_rgba(0,0,0,0.08),0_4px_12px_rgba(0,0,0,0.04)] p-5">
            {alerts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <div className="rounded-full bg-emerald-500/10 p-4 mb-3"><TrendingUp className="h-6 w-6 text-emerald-500" /></div>
                <h3 className="text-base font-medium">Sem alertas</h3>
                <p className="text-sm mt-1">Tudo em ordem — nenhum alerta de performance activo.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {alerts.map((a, i) => (
                  <Link key={i} href={`/dashboard/consultores/${a.consultant_id}`}
                    className={cn(
                      'flex items-start gap-3 rounded-xl p-4 transition-colors group',
                      a.severity === 'urgent' ? 'bg-red-500/10 hover:bg-red-500/15' : 'bg-amber-500/10 hover:bg-amber-500/15'
                    )}
                  >
                    {a.severity === 'urgent'
                      ? <AlertCircle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
                      : <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium group-hover:underline">{a.consultant_name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{a.message}</p>
                    </div>
                    <Badge variant={a.severity === 'urgent' ? 'destructive' : 'outline'} className="text-[10px] shrink-0 rounded-full">
                      {a.severity === 'urgent' ? 'Urgente' : 'Aviso'}
                    </Badge>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
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
  const [sheetOpen, setSheetOpen] = useState(false)
  const [sheetConfig, setSheetConfig] = useState<DrillDownConfig | null>(null)

  const openDrillDown = useCallback((config: DrillDownConfig) => {
    setSheetConfig(config); setSheetOpen(true)
  }, [])

  useEffect(() => {
    getAgentDashboard(userId).then(res => {
      if (!res.error) { const { error: _, ...rest } = res; setData(rest) }
      setLoading(false)
    })
  }, [userId])

  if (loading || !data) return <DashboardSkeleton />

  const barMax = Math.max(...data.monthly_evolution.map(m => Math.max(m.revenue, m.target)), 1)
  const pctRing = Math.min(data.pct_achieved, 100)
  const monthlyTarget = data.annual_target / 12
  const monthlyPct = monthlyTarget > 0 ? Math.min((data.revenue_this_month / monthlyTarget) * 100, 100) : 0

  const actionIcons: Record<string, React.ElementType> = {
    visit: MapPin, cpcv: FileSignature, escritura: FileCheck,
    contract_expiry: Clock, lead_followup: UserCheck,
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-400">
      <DrillDownSheet config={sheetConfig} open={sheetOpen} onOpenChange={setSheetOpen} />

      {/* Hero */}
      <div className="relative overflow-hidden bg-neutral-900 rounded-2xl shadow-xl shadow-neutral-900/20">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-600/15 via-transparent to-violet-600/10" />
        <div className="absolute inset-0 bg-gradient-to-r from-neutral-900/95 via-neutral-900/85 to-neutral-900/70" />
        <div className="relative z-10 px-8 py-8 sm:px-10 sm:py-10">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-neutral-400 text-xs font-medium tracking-widest uppercase mb-1">O Meu Espaço</p>
              <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">Olá, {userName.split(' ')[0]}</h1>
              <p className="text-neutral-500 text-sm capitalize mt-0.5">{today()}</p>
            </div>
            <div className="hidden md:flex items-center gap-6">
              {/* Progress ring */}
              <div className="relative h-16 w-16">
                <svg viewBox="0 0 36 36" className="h-16 w-16 -rotate-90">
                  <circle cx="18" cy="18" r="15.9" fill="none" stroke="currentColor" strokeWidth="2" className="text-white/10" />
                  <circle cx="18" cy="18" r="15.9" fill="none" stroke="currentColor" strokeWidth="2.5"
                    className={pctRing >= 80 ? 'text-emerald-400' : pctRing >= 50 ? 'text-amber-400' : 'text-red-400'}
                    strokeDasharray={`${pctRing} ${100 - pctRing}`} strokeLinecap="round" />
                </svg>
                <span className="absolute inset-0 flex items-center justify-center text-sm font-bold text-white">
                  {Math.round(data.pct_achieved)}%
                </span>
              </div>
              <div className="text-right">
                <p className="text-xl font-bold text-white tabular-nums">{fmt.format(data.revenue_ytd)}</p>
                <p className="text-[10px] text-neutral-400 uppercase tracking-wider">de {fmtCompact.format(data.annual_target)}</p>
              </div>
              {data.ranking_position > 0 && (
                <>
                  <div className="h-10 w-px bg-white/10" />
                  <Badge variant="outline" className="text-sm px-3 py-1.5 gap-1.5 border-white/20 text-white rounded-full">
                    <Trophy className="h-4 w-4 text-amber-400" />
                    #{data.ranking_position}
                  </Badge>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Row 1: KPIs */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Facturação YTD" value={fmt.format(data.revenue_ytd)} icon={Euro}
          iconBg="bg-neutral-100 dark:bg-white/10" iconColor="text-foreground"
          onClick={() => openDrillDown({ title: 'As Minhas Transacções (Ano)', fetcher: () => getDrillDownTransactions({ consultant_id: userId, date_from: `${new Date().getFullYear()}-01-01` }) })}
        />
        <KpiCard label="Este Mês" value={fmt.format(data.revenue_this_month)} icon={Receipt}
          iconBg="bg-neutral-100 dark:bg-white/10" iconColor="text-foreground"
          onClick={() => openDrillDown({ title: 'Transacções Este Mês', fetcher: () => getDrillDownTransactions({ consultant_id: userId, date_from: startOfMonth() }) })}
        />
        <KpiCard label="Objectivo Anual" value={fmt.format(data.annual_target)} icon={Target}
          iconBg="bg-neutral-100 dark:bg-white/10" iconColor="text-foreground"
        />
        <div className="rounded-2xl border border-white/60 dark:border-white/10 bg-white/70 dark:bg-neutral-900/70 backdrop-blur-xl shadow-[0_1px_3px_rgba(0,0,0,0.08),0_4px_12px_rgba(0,0,0,0.04)] p-5 flex items-center gap-4">
          <div className="relative h-14 w-14 shrink-0">
            <svg viewBox="0 0 36 36" className="h-14 w-14 -rotate-90">
              <circle cx="18" cy="18" r="15.9" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-muted" />
              <circle cx="18" cy="18" r="15.9" fill="none" stroke="currentColor" strokeWidth="2.5"
                className={pctRing >= 80 ? 'text-emerald-500' : pctRing >= 50 ? 'text-amber-500' : 'text-red-500'}
                strokeDasharray={`${pctRing} ${100 - pctRing}`} strokeLinecap="round" />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-sm font-bold">{Math.round(data.pct_achieved)}%</span>
          </div>
          <div className="min-w-0">
            <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">Atingido</p>
            <p className="text-sm font-bold">{fmt.format(data.revenue_ytd)}</p>
            <p className="text-[11px] text-muted-foreground">de {fmt.format(data.annual_target)}</p>
          </div>
        </div>
      </div>

      {/* Row 2: Properties + Objectives */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* My Properties */}
        <div className="rounded-2xl border border-white/60 dark:border-white/10 bg-white/70 dark:bg-neutral-900/70 backdrop-blur-xl shadow-[0_1px_3px_rgba(0,0,0,0.08),0_4px_12px_rgba(0,0,0,0.04)] p-5">
          <h3 className="text-sm font-semibold mb-4">Os Meus Imóveis</h3>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Ativas', value: data.my_properties.active, status: 'active' },
              { label: 'Reservadas', value: data.my_properties.reserved, status: 'reserved' },
              { label: 'Vendidas', value: data.my_properties.sold_year, status: 'sold' },
              { label: 'Volume', value: fmtCompact.format(data.my_properties.volume), status: null },
            ].map(tile => tile.status ? (
              <button key={tile.label} onClick={() => openDrillDown({ title: `Os Meus Imóveis — ${tile.label}`, fetcher: () => getDrillDownProperties({ consultant_id: userId, status: tile.status }) })}
                className="rounded-xl p-4 text-center transition-all hover:shadow-md cursor-pointer group bg-neutral-50 dark:bg-white/5 border border-neutral-200/60 dark:border-white/5"
              >
                <p className="text-2xl font-bold tabular-nums">{tile.value}</p>
                <p className="text-[11px] text-muted-foreground">{tile.label}</p>
              </button>
            ) : (
              <div key={tile.label} className="rounded-xl p-4 text-center bg-neutral-50 dark:bg-white/5 border border-neutral-200/60 dark:border-white/5">
                <p className="text-xl font-bold tabular-nums">{tile.value}</p>
                <p className="text-[11px] text-muted-foreground">{tile.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Objectives */}
        <div className="rounded-2xl border border-white/60 dark:border-white/10 bg-white/70 dark:bg-neutral-900/70 backdrop-blur-xl shadow-[0_1px_3px_rgba(0,0,0,0.08),0_4px_12px_rgba(0,0,0,0.04)] p-5">
          <h3 className="text-sm font-semibold mb-4">Objectivos vs Realizado</h3>
          <div className="space-y-5">
            {[
              { label: 'Anual', actual: data.revenue_ytd, target: data.annual_target, pct: data.pct_achieved },
              { label: 'Mensal', actual: data.revenue_this_month, target: monthlyTarget, pct: monthlyPct },
            ].map(obj => (
              <div key={obj.label}>
                <div className="flex items-center justify-between text-sm mb-2">
                  <span className="font-medium">{obj.label}</span>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {fmtCompact.format(obj.actual)} / {fmtCompact.format(obj.target)}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-3 rounded-full bg-muted/50 overflow-hidden">
                    <div className={cn(
                      'h-full rounded-full transition-all duration-500',
                      obj.pct >= 80 ? 'bg-gradient-to-r from-emerald-400 to-emerald-600' :
                      obj.pct >= 50 ? 'bg-gradient-to-r from-amber-400 to-amber-600' :
                      'bg-gradient-to-r from-red-400 to-red-600'
                    )} style={{ width: `${Math.min(obj.pct, 100)}%` }} />
                  </div>
                  <span className={cn(
                    'text-sm font-bold tabular-nums w-12 text-right',
                    obj.pct >= 80 ? 'text-emerald-600' : obj.pct >= 50 ? 'text-amber-600' : 'text-red-600'
                  )}>
                    {Math.round(obj.pct)}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Row 3: Actions + Comparison */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Actions */}
        <div className="rounded-2xl border border-white/60 dark:border-white/10 bg-white/70 dark:bg-neutral-900/70 backdrop-blur-xl shadow-[0_1px_3px_rgba(0,0,0,0.08),0_4px_12px_rgba(0,0,0,0.04)] p-5">
          <h3 className="text-sm font-semibold mb-4">Próximas Acções</h3>
          {data.upcoming_actions.length === 0 ? (
            <div className="flex flex-col items-center py-8 text-muted-foreground">
              <Sparkles className="h-6 w-6 mb-2 opacity-40" />
              <p className="text-sm">Sem acções pendentes</p>
            </div>
          ) : (
            <div className="space-y-1">
              {data.upcoming_actions.slice(0, 7).map((a, i) => {
                const Icon = actionIcons[a.type] || Calendar
                const isToday = a.date === new Date().toISOString().split('T')[0]
                return (
                  <Link key={i} href={a.link || '#'}
                    className={cn('flex items-center gap-3 rounded-xl p-2.5 hover:bg-muted/30 transition-colors group', isToday && 'bg-blue-500/10')}
                  >
                    <div className={cn('rounded-lg p-2', isToday ? 'bg-blue-500/15 text-blue-600' : 'bg-muted/50 text-muted-foreground')}>
                      <Icon className="h-3.5 w-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">{a.title}</p>
                      {a.property_ref && <p className="text-[11px] text-muted-foreground">{a.property_ref}</p>}
                    </div>
                    <p className={cn('text-xs font-medium shrink-0', isToday ? 'text-blue-600' : 'text-muted-foreground')}>
                      {isToday ? 'Hoje' : new Date(a.date).toLocaleDateString('pt-PT', { day: 'numeric', month: 'short' })}
                    </p>
                  </Link>
                )
              })}
            </div>
          )}
        </div>

        {/* Vs Average */}
        <div className="rounded-2xl border border-white/60 dark:border-white/10 bg-white/70 dark:bg-neutral-900/70 backdrop-blur-xl shadow-[0_1px_3px_rgba(0,0,0,0.08),0_4px_12px_rgba(0,0,0,0.04)] p-5">
          <h3 className="text-sm font-semibold mb-4">Eu vs Média da Agência</h3>
          {data.vs_average.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">Sem dados</p>
          ) : (
            <>
              <div className="grid grid-cols-[1fr_auto_auto_auto] gap-x-4 text-[10px] text-muted-foreground uppercase tracking-wider mb-2 px-1">
                <span /><span className="text-right">Eu</span><span className="text-right">Média</span><span />
              </div>
              {data.vs_average.map((v, i) => {
                const DirIcon = v.direction === 'above' ? TrendingUp : v.direction === 'below' ? TrendingDown : Minus
                const dirClass = v.direction === 'above' ? 'text-foreground bg-neutral-100 dark:bg-white/10' : v.direction === 'below' ? 'text-muted-foreground bg-neutral-100 dark:bg-white/10' : 'text-muted-foreground bg-neutral-100 dark:bg-white/10'
                return (
                  <div key={i} className="grid grid-cols-[1fr_auto_auto_auto] gap-x-4 items-center py-3 border-b border-border/50 last:border-0 px-1">
                    <span className="text-sm">{v.metric}</span>
                    <span className="text-sm font-bold tabular-nums text-right">{fmtCompact.format(v.my_value)}</span>
                    <span className="text-sm text-muted-foreground tabular-nums text-right">{fmtCompact.format(v.agency_avg)}</span>
                    <div className={cn('rounded-full p-1', dirClass)}><DirIcon className="h-3 w-3" /></div>
                  </div>
                )
              })}
            </>
          )}
        </div>
      </div>

      {/* Row 4: Monthly Evolution */}
      <div className="rounded-2xl border border-white/60 dark:border-white/10 bg-white/70 dark:bg-neutral-900/70 backdrop-blur-xl shadow-[0_1px_3px_rgba(0,0,0,0.08),0_4px_12px_rgba(0,0,0,0.04)] p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold">Evolução Mensal</h3>
            <p className="text-[11px] text-muted-foreground">Facturação por mês vs objectivo</p>
          </div>
          <div className="flex gap-3 text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1.5"><span className="h-2 w-5 rounded-full bg-gradient-to-r from-blue-400 to-blue-600" />Facturação</span>
            <span className="flex items-center gap-1.5"><span className="h-0 w-4 border-t-2 border-dashed border-amber-400" />Objectivo</span>
          </div>
        </div>
        <div className="flex items-end gap-1 h-44">
          {data.monthly_evolution.map((m, i) => {
            const h = Math.max((m.revenue / barMax) * 100, 3)
            const tH = Math.max((m.target / barMax) * 100, 0)
            return (
              <div key={i} className="flex-1 flex flex-col items-center h-full justify-end group relative">
                {/* Target line */}
                {m.target > 0 && (
                  <div className="absolute w-[calc(100%+2px)] border-t-2 border-dashed border-amber-400/40" style={{ bottom: `${tH}%` }} />
                )}
                <div className="w-full rounded-t-md bg-gradient-to-t from-blue-500 to-blue-400 opacity-80 group-hover:opacity-100 transition-all"
                  style={{ height: `${h}%` }}
                />
                <div className="absolute -top-16 left-1/2 -translate-x-1/2 bg-neutral-900 text-white rounded-lg px-3 py-2 text-xs shadow-xl opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-10">
                  <p className="font-semibold">{m.month}</p>
                  <p className="text-neutral-300">Receita: {fmtFull.format(m.revenue)}</p>
                  <p className="text-neutral-400">Meta: {fmtFull.format(m.target)}</p>
                </div>
                <span className="text-[8px] text-muted-foreground mt-1.5 truncate w-full text-center">{m.month}</span>
              </div>
            )
          })}
        </div>
      </div>
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
