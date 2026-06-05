'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { GOAL_PERIOD_LABELS, formatCurrency } from '@/lib/constants'
import { GoalStatusIndicator } from './goal-status-indicator'
import { getGoalStatus } from '@/lib/goals/calculations'
import type { GoalPeriod, FinancialTargets } from '@/types/goal'

interface GoalFinancialCardsProps {
  financial: Record<GoalPeriod, FinancialTargets>
  progress?: {
    annual: { realized: number; target: number }
    monthly: { realized: number; target: number }
    weekly: { realized: number; target: number }
  } | null
}

export function GoalFinancialCards({ financial, progress }: GoalFinancialCardsProps) {
  const periods: GoalPeriod[] = ['annual', 'monthly', 'weekly', 'daily']

  function getRealized(period: GoalPeriod): number | null {
    if (!progress) return null
    if (period === 'annual') return progress.annual.realized
    if (period === 'monthly') return progress.monthly.realized
    if (period === 'weekly') return progress.weekly.realized
    return null
  }

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {periods.map((period) => {
        const target = financial[period]
        const realized = getRealized(period)
        const status = realized !== null ? getGoalStatus(realized, target.total) : null

        return (
          <Card key={period}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {GOAL_PERIOD_LABELS[period]}
              </CardTitle>
              {status && <GoalStatusIndicator status={status} size="sm" />}
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(target.total)}</div>
              {realized !== null && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Realizado: <span className="font-medium text-foreground">{formatCurrency(realized)}</span>
                </p>
              )}
              <div className="mt-2 flex gap-3 text-xs text-muted-foreground">
                <span>Vend. {formatCurrency(target.sellers)}</span>
                <span>Comp. {formatCurrency(target.buyers)}</span>
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
