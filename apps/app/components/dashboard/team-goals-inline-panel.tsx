'use client'

/**
 * Painel inline com KPIs agregados de objectivos da equipa — substitui
 * "Os Meus Objectivos" no dashboard quando o utilizador é admin / Broker
 * / Office Manager. Quem precisa ver o detalhe abre o `<TeamGoalsSheet>`
 * via CTA "Ver todos os consultores".
 */

import { useEffect, useMemo, useState } from 'react'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Target, TrendingDown, TrendingUp, Users } from 'lucide-react'
import { cn } from '@/lib/utils'
import { TeamGoalsSheet } from '@/components/dashboard/team-goals-sheet'
import type { TeamSummaryResponse } from '@/app/api/goals/team-summary/route'

const fmt = new Intl.NumberFormat('pt-PT', {
  style: 'currency', currency: 'EUR', maximumFractionDigits: 0,
})
const fmtCompact = new Intl.NumberFormat('pt-PT', {
  style: 'currency', currency: 'EUR', notation: 'compact', maximumFractionDigits: 1,
})

export function TeamGoalsInlinePanel() {
  const [data, setData] = useState<TeamSummaryResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [sheetOpen, setSheetOpen] = useState(false)

  useEffect(() => {
    let cancelled = false
    const year = new Date().getFullYear()
    fetch(`/api/goals/team-summary?year=${year}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((json: TeamSummaryResponse | null) => {
        if (cancelled || !json) return
        setData(json)
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [])

  const monthlyAggregate = useMemo(() => {
    // Soma das projecções mensais ≈ projected_annual / 12. Usamos isto como
    // proxy do ritmo da equipa "este mês" sem precisar de outro endpoint.
    if (!data) return { actual: 0, target: 0, pct: 0 }
    const target = data.totals.annual_target / 12
    const actual = data.totals.realized / Math.max(new Date().getMonth() + 1, 1)
    const pct = target > 0 ? Math.min((actual / target) * 100, 999) : 0
    return { actual, target, pct }
  }, [data])

  if (loading) {
    return <Skeleton className="h-64 rounded-2xl" />
  }

  if (!data || data.consultants.length === 0) {
    return (
      <div className="rounded-2xl border border-neutral-200 dark:border-white/10 bg-white dark:bg-neutral-900 shadow-[0_1px_2px_rgba(0,0,0,0.04)] p-5 flex flex-col items-center justify-center text-center">
        <Target className="h-7 w-7 text-muted-foreground/50 mb-2" />
        <h3 className="text-sm font-semibold mb-1">Objectivos da equipa</h3>
        <p className="text-xs text-muted-foreground">
          Nenhum consultor com objectivo definido para {data?.year ?? new Date().getFullYear()}.
        </p>
      </div>
    )
  }

  const annualPct = data.totals.pct_achieved
  const projDelta = data.totals.projected_annual - data.totals.annual_target
  const projOnTrack = projDelta >= 0

  return (
    <>
      <TeamGoalsSheet open={sheetOpen} onOpenChange={setSheetOpen} />
      <div className="rounded-2xl border border-neutral-200 dark:border-white/10 bg-white dark:bg-neutral-900 shadow-[0_1px_2px_rgba(0,0,0,0.04)] p-5 flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5 text-muted-foreground" />
            Objectivos da equipa
          </h3>
          <span className="text-[10px] text-muted-foreground">
            {data.totals.consultants_count} consultor{data.totals.consultants_count === 1 ? '' : 'es'}
          </span>
        </div>

        <div className="space-y-5 flex-1">
          {/* Anual */}
          <ObjectiveRow
            label="Anual"
            actual={data.totals.realized}
            target={data.totals.annual_target}
            pct={annualPct}
          />
          {/* Mensal (média ritmo) */}
          <ObjectiveRow
            label="Mensal (média)"
            actual={monthlyAggregate.actual}
            target={monthlyAggregate.target}
            pct={monthlyAggregate.pct}
          />

          {/* Projecção */}
          <div className="pt-3 border-t flex items-center justify-between">
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Projecção anual</p>
              <p className="text-sm font-bold tabular-nums mt-0.5">{fmtCompact.format(data.totals.projected_annual)}</p>
            </div>
            <span className={cn(
              'inline-flex items-center gap-1 text-xs font-medium rounded-full px-2 py-0.5',
              projOnTrack ? 'bg-emerald-500/10 text-emerald-600' : 'bg-red-500/10 text-red-500',
            )}>
              {projOnTrack ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
              {projOnTrack ? '+' : ''}{fmtCompact.format(projDelta)}
            </span>
          </div>
        </div>

        <Button
          variant="outline"
          size="sm"
          className="rounded-full mt-4 self-start"
          onClick={() => setSheetOpen(true)}
        >
          Ver todos os consultores
        </Button>
      </div>
    </>
  )
}

function ObjectiveRow({
  label, actual, target, pct,
}: {
  label: string
  actual: number
  target: number
  pct: number
}) {
  return (
    <div>
      <div className="flex items-center justify-between text-sm mb-2">
        <span className="font-medium">{label}</span>
        <span className="text-xs text-muted-foreground tabular-nums">
          {fmtCompact.format(actual)} / {fmtCompact.format(target)}
        </span>
      </div>
      <div className="flex items-center gap-3">
        <div className="flex-1 h-3 rounded-full bg-muted/50 overflow-hidden">
          <div
            className={cn(
              'h-full rounded-full transition-all duration-500',
              pct >= 80 ? 'bg-gradient-to-r from-emerald-400 to-emerald-600'
                : pct >= 50 ? 'bg-gradient-to-r from-amber-400 to-amber-600'
                  : 'bg-gradient-to-r from-red-400 to-red-600',
            )}
            style={{ width: `${Math.min(pct, 100)}%` }}
          />
        </div>
        <span className={cn(
          'text-sm font-bold tabular-nums w-12 text-right',
          pct >= 80 ? 'text-emerald-600' : pct >= 50 ? 'text-amber-600' : 'text-red-600',
        )}>
          {Math.round(pct)}%
        </span>
      </div>
    </div>
  )
}
