'use client'

import { cn } from '@/lib/utils'
import { TrendingUp, AlertTriangle, Target, Users } from 'lucide-react'
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

export function TeamKpiStrip({ kpis, totalConsultants }: Props) {
  const isOver = kpis.achievement_pct >= 100

  return (
    <div
      className={cn(
        'rounded-2xl border border-border/40 bg-background/85 supports-[backdrop-filter]:bg-background/70 backdrop-blur-2xl',
        'shadow-[0_8px_24px_-12px_rgba(0,0,0,0.12)]',
        'px-5 py-4 grid gap-3 grid-cols-2 lg:grid-cols-4',
      )}
    >
      {/* Big KPI: realized vs target */}
      <KpiBlock
        icon={<Target className="h-4 w-4 text-foreground" />}
        eyebrow="Realizado equipa"
        value={eurFormatter.format(kpis.total_realized_eur)}
        sub={
          <span className="inline-flex items-center gap-1.5 tabular-nums">
            <span className="text-muted-foreground">{eurFormatter.format(kpis.total_target_eur)}</span>
            <span
              className={cn(
                'inline-flex items-center gap-0.5 font-semibold',
                isOver ? 'text-emerald-700' : 'text-foreground',
              )}
            >
              {isOver && <TrendingUp className="h-3 w-3" />}
              {Math.round(kpis.achievement_pct)}%
            </span>
          </span>
        }
        accent={isOver ? 'emerald' : kpis.achievement_pct >= 50 ? 'amber' : 'red'}
      />

      {/* Late count */}
      <KpiBlock
        icon={<AlertTriangle className="h-4 w-4 text-red-600" />}
        eyebrow="Atrasados"
        value={String(kpis.count_late)}
        sub={
          <span className="text-muted-foreground tabular-nums">
            de {totalConsultants}
          </span>
        }
        accent="red"
      />

      {/* Attention */}
      <KpiBlock
        icon={<span className="h-2 w-2 rounded-full bg-amber-500 ring-2 ring-amber-200/60" />}
        eyebrow="Atenção"
        value={String(kpis.count_attention)}
        sub={
          <span className="text-muted-foreground tabular-nums">
            de {totalConsultants}
          </span>
        }
        accent="amber"
      />

      {/* On track */}
      <KpiBlock
        icon={<Users className="h-4 w-4 text-emerald-700" />}
        eyebrow="Em linha"
        value={String(kpis.count_on_track)}
        sub={
          <span className="text-muted-foreground tabular-nums">
            de {totalConsultants}
          </span>
        }
        accent="emerald"
      />
    </div>
  )
}

function KpiBlock({
  icon,
  eyebrow,
  value,
  sub,
  accent,
}: {
  icon: React.ReactNode
  eyebrow: string
  value: string
  sub: React.ReactNode
  accent: 'emerald' | 'amber' | 'red'
}) {
  const ring =
    accent === 'emerald'
      ? 'ring-emerald-200/60 bg-emerald-50/70'
      : accent === 'amber'
        ? 'ring-amber-200/60 bg-amber-50/70'
        : 'ring-red-200/60 bg-red-50/70'
  return (
    <div className="rounded-xl bg-background/60 backdrop-blur-sm px-3 py-2.5 min-w-0">
      <div className="flex items-center gap-2 mb-1">
        <div className={cn('h-6 w-6 rounded-lg flex items-center justify-center ring-1', ring)}>
          {icon}
        </div>
        <p className="text-[10px] text-muted-foreground font-medium tracking-wider uppercase truncate">
          {eyebrow}
        </p>
      </div>
      <p className="text-base sm:text-lg font-semibold tracking-tight tabular-nums truncate">
        {value}
      </p>
      <p className="text-[11px] mt-0.5 truncate">{sub}</p>
    </div>
  )
}
