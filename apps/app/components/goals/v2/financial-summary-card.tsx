'use client'

import { useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { computeAgentGoalTargets } from '@/lib/goals/v2/compute-targets'
import { formatCurrency, cn } from '@/lib/utils'
import type { AgentGoalInput } from '@/types/agent-goal'
import type { FunnelAggregates } from '@/types/funnel-event'
import { TrendingUp, Tag, ShoppingCart, Pencil } from 'lucide-react'

interface FinancialSummaryCardProps {
  goal: AgentGoalInput
  aggregates: FunnelAggregates | null
  /** Optional: render an edit trigger inside the card header */
  onEdit?: () => void
}

// Top financial summary: target vs realized, total + per-side breakdown.
// Realized euros are derived from CPCV/Fecho events × half_commission_per_close
// (matches the cash-flow timing: 50% at CPCV signing + 50% at escritura).
export function FinancialSummaryCard({ goal, aggregates, onEdit }: FinancialSummaryCardProps) {
  const targets = useMemo(() => computeAgentGoalTargets(goal), [goal])

  // Half-commission per close, per side
  const vendHalfPerClose = (goal.vendedor_avg_sale_value_eur * (goal.vendedor_commission_pct / 100) * 0.5) / 2
  const compHalfPerClose = (goal.comp_avg_purchase_value_eur * (goal.comp_commission_pct / 100) * 0.5) / 2

  // Realized = CPCV count × half + Fecho count × half (cash collected so far)
  const vendCpcv = aggregates?.counts.vendedor.cpcv?.total ?? 0
  const vendFecho = aggregates?.counts.vendedor.fecho?.total ?? 0
  const compCpcv = aggregates?.counts.comprador.cpcv?.total ?? 0
  const compFecho = aggregates?.counts.comprador.fecho?.total ?? 0

  const vendRealizedEur = (vendCpcv + vendFecho) * vendHalfPerClose
  const compRealizedEur = (compCpcv + compFecho) * compHalfPerClose
  const totalRealizedEur = vendRealizedEur + compRealizedEur

  const totalTarget = targets.total_projected_revenue_eur
  const goalTarget = goal.annual_revenue_target_eur

  const totalPct = totalTarget > 0 ? Math.min(100, (totalRealizedEur / totalTarget) * 100) : 0
  const vendPct = targets.vend_projected_revenue_eur > 0
    ? Math.min(100, (vendRealizedEur / targets.vend_projected_revenue_eur) * 100)
    : 0
  const compPct = targets.comp_projected_revenue_eur > 0
    ? Math.min(100, (compRealizedEur / targets.comp_projected_revenue_eur) * 100)
    : 0

  return (
    <section className="rounded-2xl border border-border/40 bg-background/40 supports-[backdrop-filter]:bg-background/30 backdrop-blur-sm p-4 shadow-sm space-y-3">
      {/* Header row: title + edit button */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-medium leading-snug">Projeção financeira</h3>
        </div>
        {onEdit && (
          <Button
            variant="outline"
            size="sm"
            onClick={onEdit}
            className="rounded-full gap-1.5 h-7 text-xs"
          >
            <Pencil className="h-3 w-3" />
            Editar2
          </Button>
        )}
      </div>

      {/* Top: Total projected + Total feito side by side, no badge */}
      <div className="space-y-2 rounded-xl border border-border/40 bg-background/60 supports-[backdrop-filter]:bg-background/40 backdrop-blur-sm p-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Total projetado</div>
            <div className="mt-0.5 text-xl font-bold tabular-nums leading-none">
              {formatCurrency(totalTarget)}
            </div>
            <div className="mt-1 text-[10px] text-muted-foreground">
              Objetivo {formatCurrency(goalTarget)}
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Total feito</div>
            <div className="mt-0.5 text-xl font-bold tabular-nums leading-none">
              {formatCurrency(totalRealizedEur)}
            </div>
            <div className="mt-1 text-[10px] text-muted-foreground">
              {totalPct.toFixed(0)}% do total
            </div>
          </div>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted/40">
          <div className="h-full bg-emerald-500 transition-all" style={{ width: `${totalPct}%` }} />
        </div>
      </div>

      {/* Per-side breakdown — single row each */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <SideRow
          icon={Tag}
          label="Lado vendedor"
          target={targets.vend_projected_revenue_eur}
          realized={vendRealizedEur}
          pct={vendPct}
        />
        <SideRow
          icon={ShoppingCart}
          label="Lado comprador"
          target={targets.comp_projected_revenue_eur}
          realized={compRealizedEur}
          pct={compPct}
        />
      </div>
    </section>
  )
}

function SideRow({
  icon: Icon,
  label,
  target,
  realized,
  pct,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  target: number
  realized: number
  pct: number
}) {
  return (
    <div className="rounded-xl border border-border/40 bg-background/40 supports-[backdrop-filter]:bg-background/30 backdrop-blur-sm px-3 py-2 space-y-1">
      {/* One-row header: icon + label on left, value + % on right */}
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <Icon className="h-3.5 w-3.5" />
          {label}
        </span>
        <span className="flex items-baseline gap-1.5">
          <span className="text-sm font-bold tabular-nums">{formatCurrency(realized)}</span>
          <span className={cn('text-[10px] font-medium tabular-nums', pct >= 100 ? 'text-emerald-700' : 'text-muted-foreground')}>
            {pct.toFixed(0)}%
          </span>
        </span>
      </div>
      <div className="flex items-center gap-2">
        <div className="h-1 flex-1 overflow-hidden rounded-full bg-muted/30">
          <div className="h-full bg-emerald-400/70 transition-all" style={{ width: `${pct}%` }} />
        </div>
        <span className="text-[10px] text-muted-foreground tabular-nums shrink-0">
          de {formatCurrency(target)}
        </span>
      </div>
    </div>
  )
}
