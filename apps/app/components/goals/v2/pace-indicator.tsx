'use client'

import { useMemo } from 'react'
import { computeAgentGoalTargets } from '@/lib/goals/v2/compute-targets'
import { formatCurrency, cn } from '@/lib/utils'
import type { AgentGoalInput } from '@/types/agent-goal'
import type { FunnelAggregates } from '@/types/funnel-event'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'

interface PaceIndicatorProps {
  goal: AgentGoalInput
  aggregates: FunnelAggregates | null
}

// One-line pace summary. Compares realized YTD revenue vs the linear-pace
// expected at this point in the year, and projects year-end landing.
export function PaceIndicator({ goal, aggregates }: PaceIndicatorProps) {
  const targets = useMemo(() => computeAgentGoalTargets(goal), [goal])

  const vendHalfPerClose = (goal.vendedor_avg_sale_value_eur * (goal.vendedor_commission_pct / 100) * 0.5) / 2
  const compHalfPerClose = (goal.comp_avg_purchase_value_eur * (goal.comp_commission_pct / 100) * 0.5) / 2
  const vendCpcv = aggregates?.counts.vendedor.cpcv?.total ?? 0
  const vendFecho = aggregates?.counts.vendedor.fecho?.total ?? 0
  const compCpcv = aggregates?.counts.comprador.cpcv?.total ?? 0
  const compFecho = aggregates?.counts.comprador.fecho?.total ?? 0
  const realizedEur = (vendCpcv + vendFecho) * vendHalfPerClose + (compCpcv + compFecho) * compHalfPerClose

  const target = targets.total_projected_revenue_eur

  // Day of year (1..365/366)
  const now = new Date()
  const start = new Date(now.getFullYear(), 0, 1)
  const dayOfYear = Math.floor((now.getTime() - start.getTime()) / 86_400_000) + 1
  const isLeap = ((now.getFullYear() % 4 === 0 && now.getFullYear() % 100 !== 0) || now.getFullYear() % 400 === 0)
  const yearDays = isLeap ? 366 : 365

  const expectedSoFar = target > 0 ? (target * dayOfYear) / yearDays : 0
  const projectedYearEnd = dayOfYear > 0 ? (realizedEur * yearDays) / dayOfYear : 0
  const gapToTarget = projectedYearEnd - target
  const status: 'ahead' | 'on_track' | 'behind' =
    expectedSoFar === 0 ? 'on_track'
    : realizedEur >= expectedSoFar * 1.05 ? 'ahead'
    : realizedEur >= expectedSoFar * 0.95 ? 'on_track'
    : 'behind'

  const palette = {
    ahead:    { Icon: TrendingUp,   chip: 'border-emerald-500/40 bg-emerald-50/80 text-emerald-700', label: 'Acima do ritmo' },
    on_track: { Icon: Minus,        chip: 'border-sky-500/40 bg-sky-50/80 text-sky-700',             label: 'No ritmo' },
    behind:   { Icon: TrendingDown, chip: 'border-amber-500/40 bg-amber-50/80 text-amber-700',       label: 'Abaixo do ritmo' },
  }[status]
  const { Icon, chip, label } = palette

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border/40 bg-background/40 supports-[backdrop-filter]:bg-background/30 backdrop-blur-sm px-3 py-2 text-xs">
      <span className={cn('inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 backdrop-blur-sm font-medium', chip)}>
        <Icon className="h-3 w-3" />
        {label}
      </span>
      <span className="text-muted-foreground">
        Projetado para fim de ano:{' '}
        <strong className={cn('text-foreground tabular-nums',
          gapToTarget >= 0 ? 'text-emerald-700' : 'text-amber-700')}>
          {formatCurrency(projectedYearEnd)}
        </strong>
        {gapToTarget < 0 && (
          <span className="ml-1 text-amber-700">
            (faltam {formatCurrency(-gapToTarget)})
          </span>
        )}
        {gapToTarget >= 0 && target > 0 && (
          <span className="ml-1 text-emerald-700">
            (+{formatCurrency(gapToTarget)} vs alvo)
          </span>
        )}
      </span>
    </div>
  )
}
