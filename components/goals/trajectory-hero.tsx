'use client'

import { useMemo } from 'react'
import { Area, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { TrendingUp, TrendingDown, Sparkles, Target } from 'lucide-react'
import { useTrajectory } from '@/hooks/use-trajectory'
import type { TrajectoryScope, TrajectoryWeekPoint } from '@/types/trajectory'
import type { FunnelStageStatus } from '@/types/funnel'

interface Props {
  year?: number
  consultantId?: string | null
  scope?: TrajectoryScope
}

const STATUS_BADGE: Record<FunnelStageStatus, { label: string; cls: string }> = {
  late: { label: 'Em risco', cls: 'bg-red-50 text-red-700 border-red-200/60' },
  attention: {
    label: 'Atenção',
    cls: 'bg-amber-50 text-amber-700 border-amber-200/60',
  },
  on_track: { label: 'No bom caminho', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200/60' },
  completed: { label: 'No objectivo', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200/60' },
  pending: { label: 'Sem objectivo', cls: 'bg-muted text-muted-foreground border-border/40' },
}

const eurFormatter = new Intl.NumberFormat('pt-PT', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 0,
})

const MONTH_TICKS = [
  { idx: 0, label: 'Jan' },
  { idx: 4, label: 'Fev' },
  { idx: 8, label: 'Mar' },
  { idx: 13, label: 'Abr' },
  { idx: 17, label: 'Mai' },
  { idx: 22, label: 'Jun' },
  { idx: 26, label: 'Jul' },
  { idx: 30, label: 'Ago' },
  { idx: 35, label: 'Set' },
  { idx: 39, label: 'Out' },
  { idx: 43, label: 'Nov' },
  { idx: 48, label: 'Dez' },
]

export function TrajectoryHero({ year, consultantId, scope = 'consultant' }: Props) {
  const { data, isLoading, error } = useTrajectory({ year, consultantId, scope })

  // Constrói a série final com a área de "projecção" sombreada à frente do
  // realizado actual. Pontos antes do "today" só têm `realized`; pontos
  // depois só têm `projection` (linear from current → projected_year_end).
  const chartData = useMemo(() => {
    if (!data) return []
    const todayIndex = data.weeks_elapsed - 1
    const realizedNow = data.summary.realized_count_ytd
    const pace = data.summary.pace_per_week
    return data.weekly.map((p: TrajectoryWeekPoint) => {
      const isPast = p.week_index <= todayIndex
      const projection = isPast
        ? null
        : Math.round((realizedNow + pace * (p.week_index - todayIndex)) * 10) / 10
      return {
        ...p,
        realized: isPast ? p.realized_cumulative : null,
        projection,
        // Para o tooltip mostrar sempre os 3 valores sem buracos:
        realizedDisplay: isPast ? p.realized_cumulative : null,
        targetDisplay: p.target_cumulative,
      }
    })
  }, [data])

  if (isLoading) {
    return <Skeleton className="h-[220px] w-full rounded-3xl" />
  }
  if (error) {
    return (
      <div className="rounded-3xl border border-red-200/60 bg-red-50/60 backdrop-blur-sm p-6 text-sm text-red-700">
        {error}
      </div>
    )
  }
  if (!data || data.summary.annual_target_count <= 0) {
    return null
  }

  const s = data.summary
  const badge = STATUS_BADGE[s.status]
  const TrendIcon = s.status === 'late' ? TrendingDown : TrendingUp
  const isAhead = s.projected_year_end_count >= s.annual_target_count

  return (
    <div className="overflow-hidden rounded-3xl border-0 ring-1 ring-border/50 bg-gradient-to-br from-background/85 to-muted/20 backdrop-blur-sm shadow-[0_2px_24px_-12px_rgb(0_0_0_/_0.12)]">
      <div className="px-5 py-5 sm:px-7 sm:py-6">
        {/* Top row: label + badge */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] text-muted-foreground font-medium tracking-wider uppercase flex items-center gap-1.5">
              <Sparkles className="h-3 w-3 text-orange-500" />
              Trajectória {data.year}
            </p>
            <p className="text-sm sm:text-[15px] mt-1.5 leading-snug font-medium text-foreground/90 max-w-2xl">
              {s.headline}
            </p>
            {s.action_hint && (
              <p className="text-xs text-muted-foreground mt-1 max-w-2xl">{s.action_hint}</p>
            )}
          </div>
          <span
            className={cn(
              'shrink-0 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium backdrop-blur-sm',
              badge.cls,
            )}
          >
            <TrendIcon className="h-3 w-3" />
            {badge.label}
          </span>
        </div>

        {/* Big number row */}
        <div className="grid grid-cols-3 gap-4 sm:gap-6 mt-5">
          <Stat
            label="Realizado"
            value={String(s.realized_count_ytd)}
            sub={`${eurFormatter.format(s.realized_eur_ytd)}`}
            tone="default"
          />
          <Stat
            label="Projectado"
            value={String(Math.round(s.projected_year_end_count))}
            sub={`Ritmo ${s.pace_per_week.toFixed(2)} / semana`}
            tone={isAhead ? 'positive' : s.status === 'late' ? 'negative' : 'default'}
          />
          <Stat
            label="Objectivo"
            value={String(Math.round(s.annual_target_count))}
            sub={eurFormatter.format(s.annual_target_eur)}
            tone="default"
            icon={<Target className="h-3 w-3 text-muted-foreground" />}
          />
        </div>

        {/* Chart */}
        <div className="mt-5 h-[140px] sm:h-[160px] -mx-2">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="trajRealizedFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="rgb(59 130 246)" stopOpacity={0.25} />
                  <stop offset="100%" stopColor="rgb(59 130 246)" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="trajProjectionFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="rgb(148 163 184)" stopOpacity={0.18} />
                  <stop offset="100%" stopColor="rgb(148 163 184)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="week_index"
                ticks={MONTH_TICKS.map((t) => t.idx)}
                tickFormatter={(v) => MONTH_TICKS.find((t) => t.idx === v)?.label || ''}
                tick={{ fontSize: 10, fill: 'rgb(100 116 139)' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 10, fill: 'rgb(100 116 139)' }}
                axisLine={false}
                tickLine={false}
                width={28}
                allowDecimals={false}
              />
              <Tooltip
                cursor={{ stroke: 'rgb(148 163 184)', strokeDasharray: '3 3' }}
                contentStyle={{
                  backgroundColor: 'rgba(255,255,255,0.95)',
                  backdropFilter: 'blur(8px)',
                  border: '1px solid rgba(0,0,0,0.06)',
                  borderRadius: 12,
                  fontSize: 11,
                  padding: '8px 10px',
                  boxShadow: '0 4px 12px -4px rgba(0,0,0,0.12)',
                }}
                labelFormatter={(label, payload) => {
                  const w = payload?.[0]?.payload as TrajectoryWeekPoint | undefined
                  return w ? `Semana de ${w.week_start}` : ''
                }}
                formatter={(value: number, name: string) => {
                  const labels: Record<string, string> = {
                    realized: 'Realizado',
                    projection: 'Projectado',
                    targetDisplay: 'Objectivo',
                  }
                  return [value !== null ? value : '—', labels[name] ?? name]
                }}
              />
              <ReferenceLine
                x={data.weeks_elapsed - 1}
                stroke="rgb(100 116 139)"
                strokeDasharray="3 3"
                strokeOpacity={0.5}
              />
              {/* Linha do objectivo (rampa linear) */}
              <Line
                type="monotone"
                dataKey="targetDisplay"
                stroke="rgb(148 163 184)"
                strokeDasharray="4 4"
                strokeWidth={1.5}
                dot={false}
                activeDot={false}
                isAnimationActive={false}
              />
              {/* Realizado cumulativo */}
              <Area
                type="monotone"
                dataKey="realized"
                stroke="rgb(37 99 235)"
                strokeWidth={2}
                fill="url(#trajRealizedFill)"
                isAnimationActive={false}
                connectNulls={false}
              />
              {/* Projecção (linha mais ténue à frente) */}
              <Area
                type="monotone"
                dataKey="projection"
                stroke="rgb(100 116 139)"
                strokeWidth={1.5}
                strokeDasharray="2 3"
                fill="url(#trajProjectionFill)"
                isAnimationActive={false}
                connectNulls={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 mt-2 text-[10px] text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-1.5 w-3 rounded-full bg-blue-600" />
            Realizado
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-px w-3 bg-slate-400" style={{ borderTop: '1.5px dashed' }} />
            Projecção
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-px w-3 bg-slate-400" style={{ borderTop: '1.5px dashed' }} />
            Ritmo necessário
          </span>
        </div>
      </div>
    </div>
  )
}

function Stat({
  label,
  value,
  sub,
  tone = 'default',
  icon,
}: {
  label: string
  value: string
  sub?: string
  tone?: 'default' | 'positive' | 'negative'
  icon?: React.ReactNode
}) {
  const valueCls =
    tone === 'positive' ? 'text-emerald-600' : tone === 'negative' ? 'text-red-600' : 'text-foreground'
  return (
    <div className="min-w-0">
      <p className="text-[10px] text-muted-foreground tracking-wider uppercase font-medium flex items-center gap-1">
        {icon}
        {label}
      </p>
      <p className={cn('text-2xl sm:text-3xl font-semibold tabular-nums leading-tight mt-1', valueCls)}>
        {value}
      </p>
      {sub && <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{sub}</p>}
    </div>
  )
}
