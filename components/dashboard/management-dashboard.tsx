'use client'

/**
 * Gestor / management dashboard (PC).
 *
 * Visual language follows the financeiro dashboard
 * (see [components/financial/financial-dashboard-tab.tsx]) — pastel-gradient
 * KPI tiles, rounded-3xl section cards with backdrop-blur, pipeline group
 * panel. Data fetching, period filters and drill-downs are preserved
 * verbatim from the previous inline implementation.
 */

import { useCallback, useEffect, useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Banknote, PiggyBank, Handshake, Building2, TrendingUp, TrendingDown,
  Trophy, AlertTriangle, Euro, ChevronRight, Target,
  FileSignature, FileCheck, CreditCard, Receipt, Wallet,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  getManagementDashboard, getRevenueChart, getPerformanceAlerts,
  getAgentRankings, getRevenuePipeline,
} from '@/app/dashboard/financeiro/actions'
import {
  getDrillDownProperties, getDrillDownTransactions,
} from '@/app/dashboard/drill-down-actions'
import type {
  ManagementDashboard as MgmtData,
  PerformanceAlert,
  AgentRanking,
  RevenuePipelineItem,
} from '@/types/financial'
import {
  SectionCard, FinanceiroKpiCard, FinanceiroPipelineCard, PipelineGroup,
} from '@/components/dashboard/shared/financeiro-style'
import {
  DrillDownSheet, type DrillDownConfig,
} from '@/components/dashboard/shared/drill-down-sheet'
import { ConsultantAlertsTab } from '@/components/dashboard/consultant-alerts-tab'
import { Area, AreaChart, CartesianGrid, XAxis } from 'recharts'
import {
  ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig,
} from '@/components/ui/chart'

// ─── Formatters ─────────────────────────────────────────────────────────────

const fmt = new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })
const fmtFull = new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' })
const fmtCompact = new Intl.NumberFormat('pt-PT', {
  style: 'currency', currency: 'EUR', notation: 'compact', maximumFractionDigits: 1,
})

function startOfMonth() {
  const d = new Date()
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0]
}

const shortMonth = (m: string) =>
  m.replace(/\s*\d{4}$/, '').replace(/\s*'\d{2}$/, '')

const revenueChartConfig = {
  revenue: { label: 'Facturação', color: '#10b981' },
  margin: { label: 'Margem', color: '#047857' },
} satisfies ChartConfig

const PT_MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

function monthLabelToDate(label: string): Date | null {
  const [name, year] = label.split(' ')
  const idx = PT_MONTH_NAMES.indexOf(name)
  if (idx < 0 || !year) return null
  return new Date(parseInt(year, 10), idx, 1)
}

// ─── Skeleton ───────────────────────────────────────────────────────────────

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-12 w-72 rounded-full" />
      <Skeleton className="h-44 rounded-3xl" />
      <Skeleton className="h-80 rounded-3xl" />
      <Skeleton className="h-64 rounded-3xl" />
    </div>
  )
}

// ─── Types ──────────────────────────────────────────────────────────────────

type ChartPeriod = 'month' | '6m' | 'year' | 'custom'
type TimePeriod = 'ytd' | 'month' | 'custom'

// ─── Component ──────────────────────────────────────────────────────────────

export function ManagementDashboard() {
  const [data, setData] = useState<MgmtData | null>(null)
  const [chart, setChart] = useState<{ month: string; revenue: number; margin: number }[]>([])
  const [alerts, setAlerts] = useState<PerformanceAlert[]>([])
  const [rankings, setRankings] = useState<AgentRanking[]>([])
  const [rankingsAcq, setRankingsAcq] = useState<AgentRanking[]>([])
  const [pipeline, setPipeline] = useState<RevenuePipelineItem[]>([])
  const [loading, setLoading] = useState(true)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [sheetConfig, setSheetConfig] = useState<DrillDownConfig | null>(null)
  const [chartPeriod, setChartPeriod] = useState<ChartPeriod>('year')
  const [chartCustomFrom, setChartCustomFrom] = useState('')
  const [chartCustomTo, setChartCustomTo] = useState('')
  const [rankingTab, setRankingTab] = useState<'revenue' | 'acquisitions'>('revenue')
  const [rankingPeriod, setRankingPeriod] = useState<TimePeriod>('ytd')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [activeMainTab, setActiveMainTab] = useState<'overview' | 'pipeline' | 'rankings' | 'alerts'>('overview')

  const openDrillDown = useCallback((config: DrillDownConfig) => {
    setSheetConfig(config)
    setSheetOpen(true)
  }, [])

  const rankingDateFrom = rankingPeriod === 'month'
    ? startOfMonth()
    : rankingPeriod === 'custom' && customFrom
      ? customFrom
      : `${new Date().getFullYear()}-01-01`
  const rankingDateTo = rankingPeriod === 'custom' && customTo ? customTo : undefined
  const rankingApiPeriod = rankingPeriod === 'month' ? 'month' : undefined

  const fetchRankings = useCallback((kind: 'revenue' | 'acquisitions' | 'both' = 'both') => {
    if (kind === 'revenue' || kind === 'both') {
      getAgentRankings('revenue', rankingApiPeriod).then((res) => {
        if (!res.error) setRankings(res.rankings)
      })
    }
    if (kind === 'acquisitions' || kind === 'both') {
      getAgentRankings('acquisitions', rankingApiPeriod).then((res) => {
        if (!res.error) setRankingsAcq(res.rankings)
      })
    }
  }, [rankingApiPeriod])

  useEffect(() => {
    getManagementDashboard().then((res) => {
      if (!res.error) {
        const { error: _err, ...rest } = res
        setData(rest as MgmtData)
      }
      setLoading(false)
    })
    getRevenueChart(12).then((res) => { if (!res.error) setChart(res.data) })
    getPerformanceAlerts().then((res) => { if (!res.error) setAlerts(res.alerts) })
    getRevenuePipeline().then((res) => { if (!res.error) setPipeline(res.pipeline) })
  }, [])

  // Lazy-load rankings: only fetch when the Rankings tab is opened, and only
  // for the currently-visible sub-tab. Halves the initial-mount server-action
  // count and avoids competing with drill-down fetches for DB resources.
  useEffect(() => {
    if (activeMainTab !== 'rankings') return
    fetchRankings(rankingTab)
  }, [activeMainTab, rankingTab, fetchRankings])

  if (loading || !data) return <DashboardSkeleton />

  const { forecasts: fc, acquisitions: acq, reporting: rpt, margin: mg, portfolio: pf } = data
  const pipeTotal = pipeline.reduce((s, p) => s + p.weighted_value, 0)
  const urgentAlerts = alerts.filter((a) => a.severity === 'urgent').length
  const monthStart = startOfMonth()
  const filteredChart = chartPeriod === 'month'
    ? chart.slice(-1)
    : chartPeriod === '6m'
      ? chart.slice(-6)
      : chartPeriod === 'year'
        ? chart.filter((c) => {
            const y = new Date().getFullYear().toString()
            return c.month.includes(y) || c.month.includes(y.slice(-2))
          })
        : chartPeriod === 'custom' && (chartCustomFrom || chartCustomTo)
          ? chart.filter((c) => {
              const d = monthLabelToDate(c.month)
              if (!d) return false
              if (chartCustomFrom && d < new Date(chartCustomFrom)) return false
              if (chartCustomTo && d > new Date(chartCustomTo)) return false
              return true
            })
          : chart
  const currentRankings = rankingTab === 'revenue' ? rankings : rankingsAcq

  return (
    <div className="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-400">
      <DrillDownSheet config={sheetConfig} open={sheetOpen} onOpenChange={setSheetOpen} />

      {/* ─── Tabs ─────────────────────────────────────────────────── */}
      <Tabs value={activeMainTab} onValueChange={(v) => setActiveMainTab(v as typeof activeMainTab)} className="space-y-5">
        <TabsList className="inline-flex items-center gap-1 px-1.5 py-1 rounded-full bg-muted/40 backdrop-blur-sm border border-border/30 shadow-sm h-auto">
          {[
            { value: 'overview', label: 'Visão Geral', icon: Euro },
            { value: 'pipeline', label: 'Pipeline', icon: Handshake },
            { value: 'rankings', label: 'Rankings', icon: Trophy },
            { value: 'alerts', label: 'Alertas', icon: AlertTriangle, badge: urgentAlerts > 0 ? urgentAlerts : null },
          ].map((tab) => (
            <TabsTrigger
              key={tab.value}
              value={tab.value}
              className={cn(
                'group/tab inline-flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-full text-sm font-medium transition-colors duration-300',
                'data-[state=active]:bg-neutral-900 data-[state=active]:text-white data-[state=active]:shadow-sm',
                'data-[state=inactive]:bg-transparent data-[state=inactive]:text-muted-foreground data-[state=inactive]:hover:text-foreground data-[state=inactive]:hover:bg-muted/50',
                'dark:data-[state=active]:bg-white dark:data-[state=active]:text-neutral-900',
                'border-0 flex-initial',
              )}
            >
              <tab.icon className="h-4 w-4 shrink-0" />
              <span className="hidden group-data-[state=active]/tab:inline">{tab.label}</span>
              {tab.badge && (
                <Badge variant="destructive" className="text-[9px] rounded-full px-1.5 ml-0.5 h-4 min-w-4">
                  {tab.badge}
                </Badge>
              )}
            </TabsTrigger>
          ))}
        </TabsList>

        {/* ═══ Tab: Visão Geral ═══════════════════════════════════════ */}
        <TabsContent value="overview" className="space-y-5">
          {/* Indicadores YTD + Pipeline financeiro */}
          <SectionCard
            title="Indicadores do ano"
            description="Facturação acumulada, margem e estado da carteira"
          >
            <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
              <FinanceiroKpiCard
                icon={Banknote}
                label="Facturação YTD"
                value={fmt.format(rpt.reported_this_year)}
                tone="positive"
                onClick={() => openDrillDown({
                  title: 'Facturação Este Ano',
                  fetcher: () => getDrillDownTransactions({
                    status: 'paid',
                    date_from: `${new Date().getFullYear()}-01-01`,
                  }),
                })}
              />
              <FinanceiroKpiCard
                icon={PiggyBank}
                label="Margem YTD"
                value={fmt.format(mg.margin_this_year)}
                tone="info"
              />
              <FinanceiroKpiCard
                icon={Handshake}
                label="Pipeline ponderado"
                value={fmt.format(pipeTotal)}
                hint={`${pipeline.length} negócios activos`}
                tone="purple"
                onClick={() => openDrillDown({
                  title: 'Pipeline Activo',
                  fetcher: () => getDrillDownProperties({ status: ['active'] }),
                })}
              />
              <FinanceiroKpiCard
                icon={Building2}
                label="Carteira activa"
                value={fmt.format(pf.active_volume)}
                hint={`${fmtCompact.format(pf.potential_revenue)} potencial`}
                tone="warning"
                onClick={() => openDrillDown({
                  title: 'Imóveis Activos',
                  fetcher: () => getDrillDownProperties({ status: 'active' }),
                })}
              />
            </div>

            <PipelineGroup title="Valores em curso">
              <FinanceiroPipelineCard
                icon={FileSignature}
                label="Por reportar"
                value={fmt.format(rpt.signed_pending)}
                tone="warning"
                onClick={() => openDrillDown({
                  title: 'Por Reportar',
                  fetcher: () => getDrillDownTransactions({ status: 'approved' }),
                })}
              />
              <FinanceiroPipelineCard
                icon={FileCheck}
                label="Por receber"
                value={fmt.format(mg.pending_collection)}
                tone="info"
                onClick={() => openDrillDown({
                  title: 'Por Receber',
                  fetcher: () => getDrillDownTransactions({ status: 'approved' }),
                })}
              />
              <FinanceiroPipelineCard
                icon={CreditCard}
                label="Receita potencial"
                value={fmt.format(pf.potential_revenue)}
                tone="purple"
              />
            </PipelineGroup>
          </SectionCard>

          {/* Evolução mensal + Angariações */}
          <div className="grid gap-5 lg:grid-cols-3">
            {/* Chart */}
            <SectionCard
              className="lg:col-span-2"
              title="Evolução mensal"
              description="Facturação e margem por mês"
              rightSlot={
                <div className="inline-flex items-center gap-0.5 p-0.5 rounded-full bg-muted/40">
                  {([['month', 'Mês'], ['6m', '6 meses'], ['year', 'Ano'], ['custom', 'Custom']] as const).map(
                    ([val, label]) => (
                      <button
                        key={val}
                        onClick={() => setChartPeriod(val)}
                        className={cn(
                          'px-3 py-1 rounded-full text-[10px] font-medium transition-colors',
                          chartPeriod === val
                            ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 shadow-sm'
                            : 'text-muted-foreground hover:text-foreground',
                        )}
                      >
                        {label}
                      </button>
                    ),
                  )}
                </div>
              }
            >
              {chartPeriod === 'custom' && (
                <div className="flex items-center gap-2 -mt-2">
                  <input
                    type="date"
                    value={chartCustomFrom}
                    onChange={(e) => setChartCustomFrom(e.target.value)}
                    className="h-8 rounded-full border bg-background px-3 text-xs"
                  />
                  <span className="text-xs text-muted-foreground">a</span>
                  <input
                    type="date"
                    value={chartCustomTo}
                    onChange={(e) => setChartCustomTo(e.target.value)}
                    className="h-8 rounded-full border bg-background px-3 text-xs"
                  />
                </div>
              )}
              <div className="rounded-2xl bg-background/60 ring-1 ring-border/40 p-5">
                {filteredChart.length > 0 && (
                  <div className="flex flex-wrap items-baseline gap-3 mb-4">
                    <span className="text-2xl font-bold tabular-nums tracking-tight">
                      {fmt.format(filteredChart.reduce((s, c) => s + c.revenue, 0))}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      <span className="inline-block h-2 w-2 rounded-full bg-emerald-700 mr-1.5 align-middle" />
                      Margem {fmt.format(filteredChart.reduce((s, c) => s + c.margin, 0))}
                    </span>
                    {filteredChart.length >= 2 && (() => {
                      const curr = filteredChart[filteredChart.length - 1]?.revenue || 0
                      const prev = filteredChart[filteredChart.length - 2]?.revenue || 1
                      const pct = Math.round(((curr / Math.max(prev, 1)) - 1) * 100)
                      return (
                        <span className={cn(
                          'inline-flex items-center gap-0.5 text-xs font-medium rounded-full px-2 py-0.5',
                          pct >= 0 ? 'bg-emerald-500/10 text-emerald-600' : 'bg-red-500/10 text-red-500',
                        )}>
                          {pct >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                          {pct >= 0 ? '+' : ''}{pct}% vs mês anterior
                        </span>
                      )
                    })()}
                  </div>
                )}
                <ChartContainer config={revenueChartConfig} className="aspect-auto h-44 w-full">
                  <AreaChart data={filteredChart} margin={{ left: 4, right: 8, top: 4 }}>
                    <defs>
                      <linearGradient id="fillRevenueMgmt" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--color-revenue)" stopOpacity={0.7} />
                        <stop offset="95%" stopColor="var(--color-revenue)" stopOpacity={0.1} />
                      </linearGradient>
                      <linearGradient id="fillMarginMgmt" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--color-margin)" stopOpacity={0.9} />
                        <stop offset="95%" stopColor="var(--color-margin)" stopOpacity={0.25} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid vertical={false} className="stroke-muted/40" />
                    <XAxis
                      dataKey="month"
                      tickLine={false}
                      axisLine={false}
                      tickMargin={8}
                      minTickGap={20}
                      tick={{ fontSize: 10 }}
                      tickFormatter={(value: string) => shortMonth(value)}
                    />
                    <ChartTooltip
                      cursor={false}
                      content={
                        <ChartTooltipContent
                          indicator="dot"
                          labelFormatter={(value) => value}
                          formatter={(value) => fmtFull.format(Number(value))}
                        />
                      }
                    />
                    <Area
                      dataKey="revenue"
                      type="natural"
                      fill="url(#fillRevenueMgmt)"
                      stroke="var(--color-revenue)"
                      strokeWidth={2}
                    />
                    <Area
                      dataKey="margin"
                      type="natural"
                      fill="url(#fillMarginMgmt)"
                      stroke="var(--color-margin)"
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ChartContainer>
              </div>
            </SectionCard>

            {/* Angariações */}
            <SectionCard
              title="Angariações"
              description={`${acq.days_without_acquisition} dias sem angariar`}
            >
              <div className="grid grid-cols-2 gap-3">
                <FinanceiroKpiCard
                  label="Novas (mês)"
                  value={String(acq.new_this_month)}
                  tone="positive"
                  onClick={() => openDrillDown({
                    title: 'Novas Angariações',
                    fetcher: () => getDrillDownProperties({ created_after: monthStart }),
                  })}
                />
                <FinanceiroKpiCard
                  label="Activas"
                  value={String(acq.active)}
                  tone="info"
                  onClick={() => openDrillDown({
                    title: 'Activas',
                    fetcher: () => getDrillDownProperties({ status: 'active' }),
                  })}
                />
                <FinanceiroKpiCard
                  label="Reservadas"
                  value={String(acq.reserved)}
                  tone="warning"
                  onClick={() => openDrillDown({
                    title: 'Reservadas',
                    fetcher: () => getDrillDownProperties({ status: 'reserved' }),
                  })}
                />
                <FinanceiroKpiCard
                  label="Vendidas"
                  value={String(acq.sold)}
                  tone="purple"
                  onClick={() => openDrillDown({
                    title: 'Vendidas',
                    fetcher: () => getDrillDownProperties({ status: 'sold' }),
                  })}
                />
                <FinanceiroKpiCard
                  label="Canceladas"
                  value={String(acq.cancelled)}
                  tone="negative"
                  className="col-span-2"
                  onClick={() => openDrillDown({
                    title: 'Canceladas',
                    fetcher: () => getDrillDownProperties({ status: 'cancelled' }),
                  })}
                />
              </div>
            </SectionCard>
          </div>

          {/* Previsões */}
          <SectionCard
            title="Previsões"
            description="Estimativas para o próximo período"
          >
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <FinanceiroKpiCard
                icon={Receipt}
                label="Facturação prevista"
                value={fmt.format(fc.expected_revenue)}
                tone="positive"
              />
              <FinanceiroKpiCard
                icon={Wallet}
                label="Margem prevista"
                value={fmt.format(fc.expected_margin)}
                tone="info"
              />
              <FinanceiroKpiCard
                icon={Building2}
                label="Angariações previstas"
                value={String(fc.expected_acquisitions)}
                tone="warning"
              />
              <FinanceiroKpiCard
                icon={Handshake}
                label="Negócios a fechar"
                value={String(fc.expected_deals)}
                tone="purple"
              />
              <FinanceiroKpiCard
                icon={Target}
                label="Negócios activos"
                value={String(fc.active_deals)}
                tone="neutral"
              />
              <FinanceiroKpiCard
                icon={FileSignature}
                label="Pendentes aprovação"
                value={String(fc.pending_acquisitions)}
                tone="warning"
                onClick={() => openDrillDown({
                  title: 'Pendentes Aprovação',
                  fetcher: () => getDrillDownProperties({ status: 'pending_approval' }),
                })}
              />
            </div>
          </SectionCard>
        </TabsContent>

        {/* ═══ Tab: Pipeline ══════════════════════════════════════════ */}
        <TabsContent value="pipeline" className="space-y-5">
          <SectionCard
            title="Pipeline de receita"
            description="Valor ponderado por fase × probabilidade"
          >
            {pipeline.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">Sem negócios activos</p>
            ) : (
              <div className="rounded-2xl bg-background/60 ring-1 ring-border/40 p-5 space-y-4">
                {pipeline.map((p) => {
                  const pMax = Math.max(...pipeline.map((x) => x.weighted_value), 1)
                  return (
                    <div key={p.stage}>
                      <div className="flex justify-between text-xs mb-1.5">
                        <span className="font-medium">{p.label}</span>
                        <span className="font-bold tabular-nums">{fmt.format(p.weighted_value)}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="flex-1 h-3 rounded-full bg-muted/50 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-blue-400 to-blue-600 transition-all duration-500"
                            style={{ width: `${(p.weighted_value / pMax) * 100}%` }}
                          />
                        </div>
                        <span className="text-[10px] text-muted-foreground w-10 text-right tabular-nums">
                          {Math.round(p.probability * 100)}%
                        </span>
                      </div>
                    </div>
                  )
                })}
                <div className="rounded-xl bg-muted/30 p-3 flex items-center justify-between mt-2">
                  <span className="text-xs font-medium">Total ponderado</span>
                  <span className="text-lg font-bold tabular-nums">{fmt.format(pipeTotal)}</span>
                </div>
              </div>
            )}
          </SectionCard>

          <SectionCard title="Previsões" description="Resumo do que está a fechar">
            <div className="grid gap-3 grid-cols-2 lg:grid-cols-3">
              <FinanceiroKpiCard
                label="Facturação prevista"
                value={fmt.format(fc.expected_revenue)}
                tone="positive"
              />
              <FinanceiroKpiCard
                label="Margem prevista"
                value={fmt.format(fc.expected_margin)}
                tone="info"
              />
              <FinanceiroKpiCard
                label="Negócios a fechar"
                value={String(fc.expected_deals)}
                tone="purple"
              />
              <FinanceiroKpiCard
                label="Negócios activos"
                value={String(fc.active_deals)}
                tone="neutral"
              />
              <FinanceiroKpiCard
                label="Pendentes aprovação"
                value={String(fc.pending_acquisitions)}
                tone="warning"
                onClick={() => openDrillDown({
                  title: 'Pendentes Aprovação',
                  fetcher: () => getDrillDownProperties({ status: 'pending_approval' }),
                })}
              />
            </div>
          </SectionCard>
        </TabsContent>

        {/* ═══ Tab: Rankings ══════════════════════════════════════════ */}
        <TabsContent value="rankings" className="space-y-5">
          <SectionCard
            title="Ranking de consultores"
            description={rankingTab === 'revenue' ? 'Por facturação' : 'Por angariações'}
            rightSlot={
              <div className="flex flex-wrap items-center gap-2">
                <div className="inline-flex items-center gap-1 p-1 rounded-full bg-muted/40">
                  <button
                    onClick={() => setRankingTab('revenue')}
                    className={cn(
                      'px-3 py-1 rounded-full text-[10px] font-medium transition-colors',
                      rankingTab === 'revenue'
                        ? 'bg-neutral-900 text-white shadow-sm dark:bg-white dark:text-neutral-900'
                        : 'text-muted-foreground hover:text-foreground',
                    )}
                  >
                    Facturação
                  </button>
                  <button
                    onClick={() => setRankingTab('acquisitions')}
                    className={cn(
                      'px-3 py-1 rounded-full text-[10px] font-medium transition-colors',
                      rankingTab === 'acquisitions'
                        ? 'bg-neutral-900 text-white shadow-sm dark:bg-white dark:text-neutral-900'
                        : 'text-muted-foreground hover:text-foreground',
                    )}
                  >
                    Angariações
                  </button>
                </div>
                <div className="inline-flex items-center gap-1 p-1 rounded-full bg-muted/40">
                  {([['ytd', 'Ano'], ['month', 'Mês'], ['custom', 'Custom']] as const).map(([val, label]) => (
                    <button
                      key={val}
                      onClick={() => setRankingPeriod(val)}
                      className={cn(
                        'px-3 py-1 rounded-full text-[10px] font-medium transition-colors',
                        rankingPeriod === val
                          ? 'bg-neutral-900 text-white shadow-sm dark:bg-white dark:text-neutral-900'
                          : 'text-muted-foreground hover:text-foreground',
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            }
          >
            {rankingPeriod === 'custom' && (
              <div className="flex items-center gap-2 -mt-2">
                <input
                  type="date"
                  value={customFrom}
                  onChange={(e) => setCustomFrom(e.target.value)}
                  className="h-8 rounded-full border bg-background px-3 text-xs"
                />
                <span className="text-xs text-muted-foreground">a</span>
                <input
                  type="date"
                  value={customTo}
                  onChange={(e) => setCustomTo(e.target.value)}
                  className="h-8 rounded-full border bg-background px-3 text-xs"
                />
              </div>
            )}

            <div className="rounded-2xl bg-background/60 ring-1 ring-border/40 overflow-hidden">
              {currentRankings.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground">
                  <p className="text-sm">Sem dados disponíveis</p>
                </div>
              ) : (
                <div className="divide-y divide-border/40 max-h-[640px] overflow-y-auto overscroll-contain">
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
                            ? () => getDrillDownTransactions({
                                consultant_id: r.consultant_id,
                                date_from: rankingDateFrom,
                                date_to: rankingDateTo,
                              })
                            : () => getDrillDownProperties({
                                consultant_id: r.consultant_id,
                                created_after: rankingDateFrom,
                              }),
                        })}
                        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors group text-left"
                      >
                        <span className={cn(
                          'w-7 text-center font-bold shrink-0 text-xs',
                          isTop3 ? 'text-sm' : 'text-muted-foreground',
                        )}>
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
                                <div
                                  className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                                  style={{ width: `${Math.min(pct, 100)}%` }}
                                />
                              </div>
                              <span className="text-[10px] font-medium w-8 text-right tabular-nums text-muted-foreground">
                                {Math.round(pct)}%
                              </span>
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
          </SectionCard>
        </TabsContent>

        {/* ═══ Tab: Alertas ═══════════════════════════════════════════ */}
        <TabsContent value="alerts" className="space-y-5">
          <ConsultantAlertsTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}
