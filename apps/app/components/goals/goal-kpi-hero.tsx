'use client'

import { ReactNode } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { GoalStatusIndicator } from './goal-status-indicator'
import { formatCurrency } from '@/lib/constants'
import type { RealityCheck, FinancialTargets, GoalPeriod } from '@/types/goal'

interface GoalKpiHeroProps {
  consultantName: string
  year: number
  financial: Record<GoalPeriod, FinancialTargets>
  realityCheck: RealityCheck
  progress: {
    annual: { realized: number; target: number }
    monthly: { realized: number; target: number }
    weekly: { realized: number; target: number }
  } | null
  actions?: ReactNode
}

export function GoalKpiHero({ consultantName, year, financial, realityCheck, progress, actions }: GoalKpiHeroProps) {
  const progressPct = Math.min((realityCheck.total_realized / financial.annual.total) * 100, 100)

  return (
    <Card className="border-none bg-gradient-to-br from-primary/5 via-background to-primary/5 overflow-hidden relative">
      {/* Shining effect */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-1/2 -left-1/4 w-3/4 h-full bg-gradient-to-br from-primary/[0.07] via-transparent to-transparent rotate-12" />
        <div className="absolute top-0 left-1/3 w-1/3 h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent" />
      </div>

      <CardContent className="relative z-10 pt-6">
        {/* Top row: name + actions */}
        <div className="flex items-start justify-between mb-5">
          <div>
            <p className="text-sm font-medium text-muted-foreground">Objetivos {year}</p>
            <h2 className="text-2xl font-bold">{consultantName}</h2>
          </div>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>

        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          {/* Left: Annual Target + Progress */}
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div>
                <p className="text-xs text-muted-foreground">Objetivo Anual</p>
                <p className="text-3xl font-bold">{formatCurrency(financial.annual.total)}</p>
              </div>
              <GoalStatusIndicator status={realityCheck.status} size="lg" showLabel />
            </div>

            {/* Progress bar */}
            <div>
              <div className="mb-1 flex justify-between text-xs text-muted-foreground">
                <span>Progresso anual</span>
                <span>{realityCheck.pct_achieved.toFixed(1)}%</span>
              </div>
              <div className="h-2.5 w-full max-w-md rounded-full bg-muted">
                <div
                  className={`h-2.5 rounded-full transition-all ${
                    realityCheck.status === 'green' ? 'bg-emerald-500' :
                    realityCheck.status === 'orange' ? 'bg-amber-500' : 'bg-red-500'
                  }`}
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            </div>
          </div>

          {/* Right: Key numbers */}
          <div className="flex-1">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <KpiBox
                label="Realizado"
                value={formatCurrency(realityCheck.total_realized)}
                sub={`de ${formatCurrency(realityCheck.target_to_date)}`}
              />
              <KpiBox
                label="Projeção Anual"
                value={formatCurrency(realityCheck.projected_annual)}
                sub={realityCheck.projected_annual >= financial.annual.total ? 'no alvo' : `gap ${formatCurrency(realityCheck.gap)}`}
                highlight={realityCheck.projected_annual >= financial.annual.total}
              />
              <KpiBox
                label="Obj. Semanal"
                value={formatCurrency(financial.weekly.total)}
                sub={progress ? `Real. ${formatCurrency(progress.weekly.realized)}` : undefined}
              />
              <KpiBox
                label="Obj. Diário"
                value={formatCurrency(financial.daily.total)}
                sub={`V. ${formatCurrency(financial.daily.sellers)} + C. ${formatCurrency(financial.daily.buyers)}`}
              />
            </div>
          </div>
        </div>

        {/* Motivational message — full width below */}
        <div className="mt-4 rounded-xl border border-dashed px-4 py-2.5">
          <p className="text-sm text-muted-foreground">{realityCheck.message}</p>
        </div>
      </CardContent>
    </Card>
  )
}

function KpiBox({ label, value, sub, highlight }: { label: string; value: string; sub?: string; highlight?: boolean }) {
  return (
    <div className="rounded-xl bg-background/80 backdrop-blur-sm border p-3 shadow-sm">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-lg font-bold ${highlight ? 'text-emerald-600' : ''}`}>{value}</p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  )
}
