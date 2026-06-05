'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Card } from '@/components/ui/card'
import {
  TrendingUp,
  Receipt,
  PiggyBank,
  Target,
  Euro,
  Sparkles,
} from 'lucide-react'
import type { AgentMobileDashboard } from '@/app/dashboard/financeiro/actions'
import type { DrilldownKind } from '@/app/api/financial/dashboard/drilldown/route'
import { DashboardKpiDrilldownSheet } from '@/components/financial/sheets/dashboard-kpi-drilldown-sheet'
import { cn } from '@/lib/utils'
import { AnimatedNumber } from '@/components/shared/animated-number'
import {
  Area, CartesianGrid, ComposedChart, Line, XAxis,
} from 'recharts'
import {
  ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig,
} from '@/components/ui/chart'

const evolutionChartConfig = {
  revenue: { label: 'Report', color: '#3b82f6' },
  margin: { label: 'Margem', color: '#10b981' },
  target: { label: 'Meta', color: '#f59e0b' },
} satisfies ChartConfig

const fmt = new Intl.NumberFormat('pt-PT', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 0,
})
const fmtFull = new Intl.NumberFormat('pt-PT', {
  style: 'currency',
  currency: 'EUR',
})

interface FinanceCardProps {
  data: AgentMobileDashboard | null
  loading: boolean
  consultantId: string
  fillViewport?: boolean
}

interface SheetState {
  kind: DrilldownKind
  scope: 'month' | 'year'
  title: string
  month: number
  year: number
}

export function FinanceCard({
  data,
  loading,
  consultantId,
  fillViewport,
}: FinanceCardProps) {
  const [sheet, setSheet] = useState<SheetState | null>(null)

  const cardClass = cn(
    'rounded-3xl border-0 ring-1 ring-border/50 bg-gradient-to-br from-background/80 to-muted/20 backdrop-blur-sm shadow-[0_2px_24px_-12px_rgb(0_0_0_/_0.12)] p-5 gap-5 overflow-y-auto',
    fillViewport &&
      'h-[calc(100dvh-env(safe-area-inset-top,0px)-var(--mobile-nav-height,5rem)-6rem)] min-h-[24rem]',
  )

  const evolution = useMemo(
    () => data?.financial.monthly_evolution ?? [],
    [data],
  )

  const now = new Date()
  const month = now.getMonth() + 1
  const year = now.getFullYear()

  // Per-month filter (month index 0 = oldest, length-1 = current)
  const monthFilters = useMemo(
    () =>
      evolution.map((m, i) => {
        const offset = evolution.length - 1 - i
        const d = new Date(now.getFullYear(), now.getMonth() - offset, 1)
        return {
          month: d.getMonth() + 1,
          year: d.getFullYear(),
          monthName: m.month,
        }
      }),
    [evolution, now],
  )

  // Render the layout immediately with zero defaults; AnimatedNumber will
  // tween each value from 0 → real once `data` arrives. Avoids the skeleton
  // flash that made the dashboard feel slow on a cold load.
  const f = data?.financial ?? {
    report_mes: 0,
    report_ano: 0,
    margem_mes: 0,
    margem_ano: 0,
    report_previsto_mes: 0,
    margem_prevista_mes: 0,
    pct_achieved: 0,
    monthly_evolution: [],
  }
  const pct = Math.min(f.pct_achieved, 100)
  const interactive = !loading && !!data
  const pctRingColor =
    pct >= 80 ? 'text-emerald-500' : pct >= 50 ? 'text-amber-500' : 'text-red-500'
  const pctTextColor =
    pct >= 80 ? 'text-emerald-600' : pct >= 50 ? 'text-amber-600' : 'text-red-600'

  const open = (
    kind: DrilldownKind,
    scope: 'month' | 'year',
    title: string,
    overrideMonth?: number,
    overrideYear?: number,
  ) =>
    setSheet({
      kind,
      scope,
      title,
      month: overrideMonth ?? month,
      year: overrideYear ?? year,
    })

  return (
    <Card className={cardClass}>
      {/* ─── Header ─── */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <div className="h-8 w-8 rounded-full bg-neutral-100 dark:bg-white/10 flex items-center justify-center shrink-0">
            <TrendingUp className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <h3 className="text-base font-semibold tracking-tight leading-tight">
              Financeiro
            </h3>
            <p className="text-[10px] text-muted-foreground/80 leading-tight">
              {now.toLocaleDateString('pt-PT', {
                month: 'long',
                year: 'numeric',
              })}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Objective % button → /dashboard/objetivos */}
          <Link
            href="/dashboard/objetivos"
            className="group relative h-10 w-10 rounded-full bg-background/80 ring-1 ring-border/50 flex items-center justify-center hover:ring-border/80 transition-all"
            title={`${Math.round(f.pct_achieved)}% do objectivo anual`}
            aria-label="Ir para Objectivos"
          >
            <svg
              viewBox="0 0 36 36"
              className="h-9 w-9 -rotate-90 absolute inset-0.5"
            >
              <circle
                cx="18"
                cy="18"
                r="15.9"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                className="text-muted/40"
              />
              <circle
                cx="18"
                cy="18"
                r="15.9"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                className={cn(pctRingColor, 'transition-[stroke-dasharray] duration-700 ease-out')}
                strokeDasharray={`${pct} ${100 - pct}`}
                strokeLinecap="round"
              />
            </svg>
            <span
              className={cn(
                'relative text-[10px] font-bold tabular-nums leading-none',
                pctTextColor,
              )}
            >
              <AnimatedNumber value={f.pct_achieved} format={(n) => `${Math.round(n)}%`} />
            </span>
          </Link>

          {/* Financeiro dashboard button */}
          <Link
            href="/dashboard/financeiro"
            className="h-10 w-10 rounded-full bg-background/80 ring-1 ring-border/50 flex items-center justify-center text-muted-foreground hover:text-foreground hover:ring-border/80 transition-all"
            title="Ir para Financeiro"
            aria-label="Ir para Financeiro"
          >
            <Euro className="h-4 w-4" />
          </Link>
        </div>
      </div>

      {/* ─── Realizado ─── */}
      <Subsection label="Realizado" />
      <div className="grid grid-cols-2 gap-3">
        <KpiTile
          icon={Receipt}
          tone="positive"
          label="Report este mês"
          numericValue={f.report_mes}
          format={fmt.format}
          onClick={interactive ? () => open('revenue', 'month', 'Report este mês') : undefined}
        />
        <KpiTile
          icon={Receipt}
          tone="positive"
          label="Report este ano"
          numericValue={f.report_ano}
          format={fmt.format}
          onClick={interactive ? () => open('revenue', 'year', 'Report este ano') : undefined}
        />
        <KpiTile
          icon={PiggyBank}
          tone="info"
          label="Margem este mês"
          numericValue={f.margem_mes}
          format={fmt.format}
          onClick={interactive ? () => open('margin', 'month', 'Margem este mês') : undefined}
        />
        <KpiTile
          icon={PiggyBank}
          tone="info"
          label="Margem este ano"
          numericValue={f.margem_ano}
          format={fmt.format}
          onClick={interactive ? () => open('margin', 'year', 'Margem este ano') : undefined}
        />
      </div>

      {/* ─── Previsto ─── */}
      <Subsection label="Previsto" />
      <div className="grid grid-cols-2 gap-3">
        <KpiTile
          icon={Sparkles}
          tone="warning"
          label="Report previsto este mês"
          numericValue={f.report_previsto_mes}
          format={fmt.format}
          onClick={interactive ? () =>
            open('forecast_revenue', 'month', 'Report previsto este mês') : undefined
          }
        />
        <KpiTile
          icon={Target}
          tone="warning"
          label="Margem prevista este mês"
          numericValue={f.margem_prevista_mes}
          format={fmt.format}
          onClick={interactive ? () =>
            open('forecast_margin', 'month', 'Margem prevista este mês') : undefined
          }
        />
      </div>

      {/* ─── Monthly evolution graph ─── */}
      <div
        className={cn(
          'rounded-2xl ring-1 ring-border/40 bg-background/60 p-4 flex flex-col',
          fillViewport && 'flex-1 min-h-0',
        )}
      >
        <div className="flex items-center justify-between mb-3 shrink-0">
          <div>
            <p className="text-sm font-semibold tracking-tight">Evolução mensal</p>
            <p className="text-[10px] text-muted-foreground/80">
              Report e margem dos últimos 12 meses
            </p>
          </div>
          <div className="flex gap-2 text-[9px] text-muted-foreground">
            <span className="flex items-center gap-1">
              <span className="h-1.5 w-3 rounded-full bg-gradient-to-r from-blue-400 to-blue-600" />
              Report
            </span>
            <span className="flex items-center gap-1">
              <span className="h-1.5 w-3 rounded-full bg-emerald-500/70" />
              Margem
            </span>
            <span className="flex items-center gap-1">
              <span className="h-0 w-3 border-t-2 border-dashed border-amber-400" />
              Meta
            </span>
          </div>
        </div>

        <div
          className={cn(
            'w-full',
            fillViewport ? 'flex-1 min-h-0' : 'h-36',
          )}
        >
          <ChartContainer
            config={evolutionChartConfig}
            className="aspect-auto h-full w-full"
          >
            <ComposedChart
              data={evolution}
              margin={{ left: 4, right: 8, top: 4, bottom: 0 }}
              onClick={(state: any) => {
                if (!interactive) return
                const idx = state?.activeTooltipIndex
                if (typeof idx !== 'number') return
                const filter = monthFilters[idx]
                if (!filter) return
                open(
                  'revenue',
                  'month',
                  `Report — ${filter.monthName}`,
                  filter.month,
                  filter.year,
                )
              }}
            >
              <defs>
                <linearGradient id="fillRevenueAgent" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--color-revenue)" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="var(--color-revenue)" stopOpacity={0.1} />
                </linearGradient>
                <linearGradient id="fillMarginAgent" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--color-margin)" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="var(--color-margin)" stopOpacity={0.1} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} className="stroke-muted/40" />
              <XAxis
                dataKey="month"
                tickLine={false}
                axisLine={false}
                tickMargin={6}
                minTickGap={20}
                tick={{ fontSize: 9 }}
                tickFormatter={(value: string) =>
                  value.replace(/\s*\d{4}$/, '').replace(/\s*'\d{2}$/, '')
                }
              />
              <ChartTooltip
                cursor={{ stroke: 'var(--color-revenue)', strokeOpacity: 0.2 }}
                content={
                  <ChartTooltipContent
                    indicator="dot"
                    labelFormatter={(value) => value}
                    formatter={(value, name) => [
                      fmtFull.format(Number(value)),
                      String(name),
                    ]}
                  />
                }
              />
              <Area
                dataKey="revenue"
                name="Report"
                type="natural"
                fill="url(#fillRevenueAgent)"
                stroke="var(--color-revenue)"
                strokeWidth={2}
              />
              <Area
                dataKey="margin"
                name="Margem"
                type="natural"
                fill="url(#fillMarginAgent)"
                stroke="var(--color-margin)"
                strokeWidth={1.5}
              />
              <Line
                dataKey="target"
                name="Meta"
                type="natural"
                stroke="var(--color-target)"
                strokeWidth={1.5}
                strokeDasharray="4 4"
                dot={false}
                activeDot={false}
              />
            </ComposedChart>
          </ChartContainer>
        </div>
      </div>

      {/* Drill-down sheet — same component the financeiro dashboard uses */}
      <DashboardKpiDrilldownSheet
        kind={sheet?.kind ?? null}
        month={sheet?.month ?? month}
        year={sheet?.year ?? year}
        consultantId={consultantId}
        scope={sheet?.scope ?? 'month'}
        titleOverride={sheet?.title}
        onClose={() => setSheet(null)}
      />
    </Card>
  )
}

function Subsection({ label }: { label: string }) {
  return (
    <p className="text-[10px] font-medium text-muted-foreground/70 uppercase tracking-wider px-1">
      {label}
    </p>
  )
}

function KpiTile({
  icon: Icon,
  label,
  value,
  numericValue,
  format,
  tone,
  onClick,
}: {
  icon: React.ElementType
  label: string
  value?: string
  numericValue?: number
  format?: (n: number) => string
  tone: 'positive' | 'negative' | 'info' | 'warning' | 'purple'
  onClick?: () => void
}) {
  const toneMap = {
    positive: { from: 'from-emerald-500/15', icon: 'text-emerald-600', accent: 'bg-emerald-500/60' },
    negative: { from: 'from-red-500/15', icon: 'text-red-600', accent: 'bg-red-500/60' },
    info: { from: 'from-blue-500/15', icon: 'text-blue-600', accent: 'bg-blue-500/60' },
    warning: { from: 'from-amber-500/15', icon: 'text-amber-600', accent: 'bg-amber-500/60' },
    purple: { from: 'from-purple-500/15', icon: 'text-purple-600', accent: 'bg-purple-500/60' },
  }[tone]

  const Component = onClick ? 'button' : 'div'

  return (
    <Component
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={cn(
        'group relative overflow-hidden rounded-2xl bg-gradient-to-br to-transparent text-left w-full',
        'ring-1 ring-border/40 p-4 transition-all duration-300',
        'hover:ring-border/70 hover:shadow-[0_4px_20px_-4px_rgb(0_0_0_/_0.08)]',
        onClick &&
          'cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        toneMap.from,
      )}
    >
      <span
        className={cn(
          'absolute left-0 top-3 bottom-3 w-[3px] rounded-r-full',
          toneMap.accent,
        )}
      />
      <div className="flex items-center gap-2">
        <Icon className={cn('h-4 w-4 shrink-0', toneMap.icon)} />
        <p className="text-[11px] text-muted-foreground font-medium leading-tight">
          {label}
        </p>
      </div>
      <p className="text-base sm:text-xl font-semibold tracking-tight tabular-nums mt-2.5 text-foreground break-words">
        {numericValue !== undefined ? (
          <AnimatedNumber value={numericValue} format={format} />
        ) : (
          value
        )}
      </p>
    </Component>
  )
}
