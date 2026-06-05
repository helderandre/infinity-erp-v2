'use client'

import { useMemo } from 'react'
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ReferenceLine, Legend,
} from 'recharts'
import type { MonthlyRevenueData } from '@/hooks/use-monthly-revenue'
import { formatCurrency } from '@/lib/utils'
import { LineChart as LineChartIcon } from 'lucide-react'

const MONTHS_PT = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']

interface TrajectoryChartProps {
  data: MonthlyRevenueData | null
  isLoading?: boolean
}

interface ChartPoint {
  monthIdx: number
  monthLabel: string
  realized: number | null
  projection: number | null
  target: number
}

// Cumulative monthly revenue chart with linear projection forward to year-end.
export function TrajectoryChart({ data, isLoading }: TrajectoryChartProps) {
  const series: ChartPoint[] = useMemo(() => {
    if (!data) return []
    const monthsCum: number[] = []
    let running = 0
    for (let i = 0; i < 12; i++) {
      const m = data.months[i]
      running += (m?.vendedor_eur ?? 0) + (m?.comprador_eur ?? 0)
      monthsCum.push(running)
    }
    const today = new Date()
    const isCurrentYear = today.getFullYear() === data.year
    const currentMonthIdx = isCurrentYear ? today.getMonth() : 11
    const currentRealized = monthsCum[currentMonthIdx] ?? 0
    // Projection: linear from current cumulative → year-end estimate
    const dayOfYear = Math.floor(
      (today.getTime() - new Date(data.year, 0, 1).getTime()) / 86_400_000
    ) + 1
    const yearDays = 365
    const projectedYearEnd = isCurrentYear && dayOfYear > 0
      ? (currentRealized * yearDays) / dayOfYear
      : currentRealized

    return Array.from({ length: 12 }, (_, i) => {
      const isPast = i <= currentMonthIdx
      const isCurrent = i === currentMonthIdx
      // Linear projection from current point → year-end
      const projection = !isPast || isCurrent
        ? currentRealized + ((projectedYearEnd - currentRealized) * (i - currentMonthIdx)) / Math.max(1, 11 - currentMonthIdx)
        : null
      return {
        monthIdx: i,
        monthLabel: MONTHS_PT[i],
        realized: isPast ? monthsCum[i] : null,
        projection,
        target: data.annual_target_eur,
      }
    })
  }, [data])

  if (isLoading) {
    return (
      <div className="rounded-2xl border border-border/40 bg-background/40 supports-[backdrop-filter]:bg-background/30 backdrop-blur-sm p-4 shadow-sm">
        <div className="h-64 w-full animate-pulse rounded-xl bg-muted/30" />
      </div>
    )
  }

  if (!data) {
    return (
      <div className="rounded-2xl border border-border/40 bg-background/40 supports-[backdrop-filter]:bg-background/30 backdrop-blur-sm p-4 shadow-sm">
        <p className="text-sm text-muted-foreground">Sem dados de trajetória.</p>
      </div>
    )
  }

  return (
    <section className="rounded-2xl border border-border/40 bg-background/40 supports-[backdrop-filter]:bg-background/30 backdrop-blur-sm p-4 shadow-sm space-y-3">
      <div className="flex items-center gap-2">
        <LineChartIcon className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-medium">Trajetória anual</h3>
      </div>

      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={series} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="realizedGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="rgb(16 185 129)" stopOpacity={0.4} />
                <stop offset="100%" stopColor="rgb(16 185 129)" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="projectionGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="rgb(148 163 184)" stopOpacity={0.25} />
                <stop offset="100%" stopColor="rgb(148 163 184)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-border/40" vertical={false} />
            <XAxis
              dataKey="monthLabel"
              tick={{ fill: 'currentColor', fontSize: 11 }}
              className="text-muted-foreground"
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              tick={{ fill: 'currentColor', fontSize: 11 }}
              className="text-muted-foreground"
              tickLine={false}
              axisLine={false}
              tickFormatter={(v: number) => `€${(v / 1000).toFixed(0)}k`}
            />
            <Tooltip
              contentStyle={{
                background: 'var(--background)',
                border: '1px solid var(--border)',
                borderRadius: 12,
                fontSize: 12,
              }}
              formatter={(value: unknown, name: string) => {
                const numericValue = typeof value === 'number' ? value : Number(value ?? 0)
                const labels: Record<string, string> = {
                  realized: 'Realizado',
                  projection: 'Projeção',
                  target: 'Alvo',
                }
                return [formatCurrency(numericValue), labels[name] ?? name]
              }}
            />
            <Legend
              wrapperStyle={{ fontSize: 11 }}
              formatter={(value: string) => {
                const labels: Record<string, string> = {
                  realized: 'Realizado',
                  projection: 'Projeção',
                }
                return labels[value] ?? value
              }}
            />
            <ReferenceLine
              y={data.annual_target_eur}
              stroke="rgb(245 158 11)"
              strokeDasharray="4 4"
              label={{
                value: `Alvo ${formatCurrency(data.annual_target_eur)}`,
                position: 'insideTopRight',
                fill: 'rgb(245 158 11)',
                fontSize: 10,
              }}
            />
            <Area
              type="monotone"
              dataKey="projection"
              stroke="rgb(148 163 184)"
              strokeWidth={1.5}
              strokeDasharray="4 4"
              fill="url(#projectionGradient)"
              connectNulls
            />
            <Area
              type="monotone"
              dataKey="realized"
              stroke="rgb(16 185 129)"
              strokeWidth={2}
              fill="url(#realizedGradient)"
              connectNulls={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </section>
  )
}
