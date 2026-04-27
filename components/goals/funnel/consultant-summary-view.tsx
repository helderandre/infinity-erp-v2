'use client'

import { useMemo } from 'react'
import { cn } from '@/lib/utils'
import { Target, Activity, AlertCircle, Sparkles } from 'lucide-react'
import type { FunnelResponse, FunnelStageResult, FunnelStageStatus } from '@/types/funnel'

interface Props {
  data: FunnelResponse
}

const STATUS_LABEL: Record<FunnelStageStatus, string> = {
  late: 'Atrasado',
  attention: 'Atenção',
  on_track: 'Em linha',
  completed: 'Concluído',
  pending: 'Pendente',
}

const STATUS_TEXT: Record<FunnelStageStatus, string> = {
  late: 'text-red-600',
  attention: 'text-amber-600',
  on_track: 'text-emerald-600',
  completed: 'text-emerald-600',
  pending: 'text-muted-foreground',
}

const eurFormatter = new Intl.NumberFormat('pt-PT', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 0,
})

function avgPct(stages: FunnelStageResult[]): number {
  if (stages.length === 0) return 0
  const capped = stages.map((s) => Math.min(100, s.percent))
  return Math.round(capped.reduce((acc, p) => acc + p, 0) / capped.length)
}

function totalActivity(data: FunnelResponse): number {
  return (
    data.buyer.stages.reduce((acc, s) => acc + s.realized, 0) +
    data.seller.stages.reduce((acc, s) => acc + s.realized, 0)
  )
}

function findBest(stages: FunnelStageResult[]): FunnelStageResult | null {
  return stages.reduce<FunnelStageResult | null>((best, s) => {
    if (s.target === 0 && s.realized === 0) return best
    if (!best) return s
    return s.percent > best.percent ? s : best
  }, null)
}

function findWorst(stages: FunnelStageResult[]): FunnelStageResult | null {
  return stages.reduce<FunnelStageResult | null>((worst, s) => {
    if (s.target === 0) return worst
    if (!worst) return s
    return s.percent < worst.percent ? s : worst
  }, null)
}

export function ConsultantSummaryView({ data }: Props) {
  const allStages = [...data.buyer.stages, ...data.seller.stages]
  const buyerAvg = useMemo(() => avgPct(data.buyer.stages), [data])
  const sellerAvg = useMemo(() => avgPct(data.seller.stages), [data])
  const totalRealizedEur = data.buyer.summary.realized_eur + data.seller.summary.realized_eur
  const activitySum = useMemo(() => totalActivity(data), [data])
  const revenuePct = data.period_target_eur > 0
    ? Math.round((totalRealizedEur / data.period_target_eur) * 100)
    : 0
  const isOver = revenuePct >= 100

  const worstAll = useMemo(() => findWorst(allStages), [data])
  const bestAll = useMemo(() => findBest(allStages), [data])

  return (
    <div className="space-y-3">
      {/* KPI grid 2x2 / 4x1 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCubicle
          icon={<Target className="h-3.5 w-3.5" />}
          eyebrow="Realizado"
          value={eurFormatter.format(totalRealizedEur)}
          sub={
            <span className="inline-flex items-center gap-1 tabular-nums">
              <span className="text-muted-foreground">{eurFormatter.format(data.period_target_eur)}</span>
              <span className={cn('font-semibold', isOver ? 'text-emerald-700' : 'text-foreground')}>
                {revenuePct}%
              </span>
            </span>
          }
          tone={isOver ? 'emerald' : revenuePct >= 50 ? 'amber' : 'red'}
        />
        <KpiCubicle
          icon={<Activity className="h-3.5 w-3.5" />}
          eyebrow="Actividade total"
          value={String(activitySum)}
          sub={<span className="text-muted-foreground">eventos no período</span>}
          tone="neutral"
        />
        <KpiCubicle
          icon={<span className="h-2 w-2 rounded-full bg-amber-500 ring-2 ring-amber-200/60" />}
          eyebrow="Compradores"
          value={`${Math.min(999, buyerAvg)}%`}
          sub={
            <span className={cn('font-medium', STATUS_TEXT[data.buyer.status])}>
              {STATUS_LABEL[data.buyer.status]}
            </span>
          }
          tone={data.buyer.status === 'late' ? 'red' : data.buyer.status === 'attention' ? 'amber' : 'emerald'}
        />
        <KpiCubicle
          icon={<span className="h-2 w-2 rounded-full bg-rose-500 ring-2 ring-rose-200/60" />}
          eyebrow="Vendedores"
          value={`${Math.min(999, sellerAvg)}%`}
          sub={
            <span className={cn('font-medium', STATUS_TEXT[data.seller.status])}>
              {STATUS_LABEL[data.seller.status]}
            </span>
          }
          tone={data.seller.status === 'late' ? 'red' : data.seller.status === 'attention' ? 'amber' : 'emerald'}
        />
      </div>

      {/* Bottleneck + Best stage */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <HighlightCard
          eyebrow="Gargalo"
          tone="red"
          icon={<AlertCircle className="h-4 w-4" />}
          stage={worstAll}
        />
        <HighlightCard
          eyebrow="Etapa mais forte"
          tone="emerald"
          icon={<Sparkles className="h-4 w-4" />}
          stage={bestAll}
        />
      </div>
    </div>
  )
}

function KpiCubicle({
  icon,
  eyebrow,
  value,
  sub,
  tone,
}: {
  icon: React.ReactNode
  eyebrow: string
  value: string
  sub: React.ReactNode
  tone: 'emerald' | 'amber' | 'red' | 'neutral'
}) {
  const ring =
    tone === 'emerald'
      ? 'ring-emerald-200/60 bg-emerald-50/70 text-emerald-700'
      : tone === 'amber'
        ? 'ring-amber-200/60 bg-amber-50/70 text-amber-700'
        : tone === 'red'
          ? 'ring-red-200/60 bg-red-50/70 text-red-700'
          : 'ring-border/40 bg-muted/60 text-muted-foreground'
  return (
    <div className="rounded-2xl border border-border/40 bg-background/85 supports-[backdrop-filter]:bg-background/70 backdrop-blur-2xl shadow-[0_8px_24px_-12px_rgba(0,0,0,0.12)] p-4">
      <div className="flex items-center gap-2 mb-1.5">
        <div className={cn('h-7 w-7 rounded-xl flex items-center justify-center ring-1', ring)}>
          {icon}
        </div>
        <p className="text-[10px] text-muted-foreground font-medium tracking-wider uppercase truncate">
          {eyebrow}
        </p>
      </div>
      <p className="text-xl sm:text-2xl font-semibold tracking-tight tabular-nums truncate">
        {value}
      </p>
      <div className="text-[11px] mt-0.5 truncate">{sub}</div>
    </div>
  )
}

function HighlightCard({
  eyebrow,
  tone,
  icon,
  stage,
}: {
  eyebrow: string
  tone: 'emerald' | 'red'
  icon: React.ReactNode
  stage: FunnelStageResult | null
}) {
  const ring =
    tone === 'red'
      ? 'ring-red-200/60 bg-red-50/70 text-red-700'
      : 'ring-emerald-200/60 bg-emerald-50/70 text-emerald-700'
  if (!stage) {
    return (
      <div className="rounded-2xl border border-border/40 bg-background/85 backdrop-blur-2xl p-4">
        <div className="flex items-center gap-2">
          <div className={cn('h-7 w-7 rounded-xl flex items-center justify-center ring-1', ring)}>
            {icon}
          </div>
          <p className="text-[10px] text-muted-foreground font-medium tracking-wider uppercase">{eyebrow}</p>
        </div>
        <p className="text-xs text-muted-foreground mt-2">Sem dados suficientes.</p>
      </div>
    )
  }
  return (
    <div className="rounded-2xl border border-border/40 bg-background/85 backdrop-blur-2xl shadow-[0_8px_24px_-12px_rgba(0,0,0,0.12)] p-4">
      <div className="flex items-center gap-2 mb-1.5">
        <div className={cn('h-7 w-7 rounded-xl flex items-center justify-center ring-1', ring)}>
          {icon}
        </div>
        <p className="text-[10px] text-muted-foreground font-medium tracking-wider uppercase">{eyebrow}</p>
      </div>
      <p className="text-base font-semibold tracking-tight">{stage.label}</p>
      <p className="text-[11px] text-muted-foreground mt-0.5">{stage.message}</p>
      <div className="mt-2 flex items-baseline gap-2">
        <span className="text-sm font-semibold tabular-nums">
          {stage.realized}
          <span className="text-muted-foreground font-normal">/{Math.round(stage.target)}</span>
        </span>
        <span
          className={cn(
            'text-[11px] font-medium tabular-nums',
            tone === 'red' ? 'text-red-600' : 'text-emerald-600',
          )}
        >
          {Math.round(stage.percent)}%
        </span>
      </div>
    </div>
  )
}
