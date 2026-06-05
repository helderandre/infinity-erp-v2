'use client'

import { cn } from '@/lib/utils'
import { TrendingUp, TrendingDown, AlertTriangle, Target, CheckCircle2, AlertCircle } from 'lucide-react'
import type { TeamOverviewKpis } from '@/types/funnel'

interface Props {
  kpis: TeamOverviewKpis
  totalConsultants: number
}

const eurFormatter = new Intl.NumberFormat('pt-PT', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 0,
})

type Accent = 'foreground' | 'emerald' | 'amber' | 'red'

const ACCENT_TOKENS: Record<Accent, { iconBg: string; iconRing: string; iconText: string; bar: string }> = {
  foreground: {
    iconBg: 'bg-foreground/5',
    iconRing: 'ring-foreground/15',
    iconText: 'text-foreground',
    bar: 'bg-foreground/70',
  },
  emerald: {
    iconBg: 'bg-emerald-50/80',
    iconRing: 'ring-emerald-200/70',
    iconText: 'text-emerald-700',
    bar: 'bg-emerald-500',
  },
  amber: {
    iconBg: 'bg-amber-50/80',
    iconRing: 'ring-amber-200/70',
    iconText: 'text-amber-700',
    bar: 'bg-amber-500',
  },
  red: {
    iconBg: 'bg-red-50/80',
    iconRing: 'ring-red-200/70',
    iconText: 'text-red-600',
    bar: 'bg-red-500',
  },
}

export function TeamKpiStrip({ kpis, totalConsultants }: Props) {
  const isOver = kpis.achievement_pct >= 100
  const realizedAccent: Accent = isOver ? 'emerald' : kpis.achievement_pct >= 50 ? 'amber' : 'red'

  const safeTotal = Math.max(totalConsultants, 1)

  return (
    <div className="rounded-2xl border border-border/40 bg-background/85 supports-[backdrop-filter]:bg-background/70 backdrop-blur-2xl shadow-[0_8px_24px_-12px_rgba(0,0,0,0.12)] px-3 py-3 sm:px-4 sm:py-4 grid gap-2 sm:gap-3 grid-cols-2 lg:grid-cols-4">
      {/* Master KPI — Realizado vs target */}
      <KpiBlock
        icon={<Target className="h-3.5 w-3.5" />}
        eyebrow="Realizado equipa"
        value={eurFormatter.format(kpis.total_realized_eur)}
        sub={
          <span className="inline-flex items-center gap-2 tabular-nums">
            <span className="text-muted-foreground">{eurFormatter.format(kpis.total_target_eur)}</span>
            <span
              className={cn(
                'inline-flex items-center gap-0.5 font-semibold rounded-full px-1.5 py-0.5 text-[10px]',
                isOver
                  ? 'text-emerald-700 bg-emerald-50/80'
                  : kpis.achievement_pct >= 50
                    ? 'text-amber-700 bg-amber-50/80'
                    : 'text-red-700 bg-red-50/80',
              )}
            >
              {isOver ? <TrendingUp className="h-2.5 w-2.5" /> : <TrendingDown className="h-2.5 w-2.5" />}
              {Math.round(kpis.achievement_pct)}%
            </span>
          </span>
        }
        accent={realizedAccent}
        progressPct={Math.min(kpis.achievement_pct, 100)}
      />

      {/* Late */}
      <KpiBlock
        icon={<AlertTriangle className="h-3.5 w-3.5" />}
        eyebrow="Atrasados"
        value={String(kpis.count_late)}
        sub={<CountSub count={kpis.count_late} total={totalConsultants} muted={kpis.count_late === 0} />}
        accent={kpis.count_late > 0 ? 'red' : 'foreground'}
        progressPct={(kpis.count_late / safeTotal) * 100}
        dim={kpis.count_late === 0}
      />

      {/* Attention */}
      <KpiBlock
        icon={<AlertCircle className="h-3.5 w-3.5" />}
        eyebrow="Atenção"
        value={String(kpis.count_attention)}
        sub={<CountSub count={kpis.count_attention} total={totalConsultants} muted={kpis.count_attention === 0} />}
        accent={kpis.count_attention > 0 ? 'amber' : 'foreground'}
        progressPct={(kpis.count_attention / safeTotal) * 100}
        dim={kpis.count_attention === 0}
      />

      {/* On track */}
      <KpiBlock
        icon={<CheckCircle2 className="h-3.5 w-3.5" />}
        eyebrow="Em linha"
        value={String(kpis.count_on_track)}
        sub={<CountSub count={kpis.count_on_track} total={totalConsultants} muted={kpis.count_on_track === 0} />}
        accent="emerald"
        progressPct={(kpis.count_on_track / safeTotal) * 100}
        dim={kpis.count_on_track === 0}
      />
    </div>
  )
}

function CountSub({ count, total, muted }: { count: number; total: number; muted?: boolean }) {
  const safeTotal = Math.max(total, 1)
  const pct = Math.round((count / safeTotal) * 100)
  return (
    <span className={cn('inline-flex items-center gap-1.5 tabular-nums', muted && 'text-muted-foreground/70')}>
      <span className="text-muted-foreground">de {total}</span>
      <span className="text-muted-foreground/40">·</span>
      <span className={cn('font-medium', muted ? 'text-muted-foreground/70' : 'text-foreground')}>{pct}%</span>
    </span>
  )
}

function KpiBlock({
  icon,
  eyebrow,
  value,
  sub,
  accent,
  progressPct,
  dim,
}: {
  icon: React.ReactNode
  eyebrow: string
  value: string
  sub: React.ReactNode
  accent: Accent
  progressPct: number
  dim?: boolean
}) {
  const tokens = ACCENT_TOKENS[accent]
  const clampedPct = Math.max(0, Math.min(100, progressPct))

  return (
    <div className="relative rounded-xl bg-background/70 backdrop-blur-sm ring-1 ring-border/30 px-3 sm:px-4 py-3 min-w-0 overflow-hidden">
      {/* Header row: eyebrow + icon */}
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <p className="text-[10px] text-muted-foreground font-medium tracking-wider uppercase truncate">
          {eyebrow}
        </p>
        <div
          className={cn(
            'h-6 w-6 rounded-lg flex items-center justify-center ring-1 shrink-0',
            tokens.iconBg,
            tokens.iconRing,
            tokens.iconText,
            dim && 'opacity-50',
          )}
        >
          {icon}
        </div>
      </div>

      {/* Value */}
      <p
        className={cn(
          'text-xl sm:text-2xl font-bold tracking-tight tabular-nums truncate',
          dim && 'text-muted-foreground/70',
        )}
      >
        {value}
      </p>

      {/* Sub */}
      <div className="text-[11px] mt-1 truncate">{sub}</div>

      {/* Bottom progress bar */}
      <div className="absolute inset-x-0 bottom-0 h-[3px] bg-muted/40">
        <div
          className={cn('h-full transition-all rounded-r-full', tokens.bar, dim && 'opacity-60')}
          style={{ width: `${clampedPct}%` }}
        />
      </div>
    </div>
  )
}
