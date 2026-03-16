'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { GoalStatusIndicator } from './goal-status-indicator'
import { formatCurrency } from '@/lib/constants'
import type { RealityCheck } from '@/types/goal'

interface GoalRealityCheckProps {
  realityCheck: RealityCheck
  annualTarget: number
}

export function GoalRealityCheck({ realityCheck, annualTarget }: GoalRealityCheckProps) {
  const progressValue = Math.min((realityCheck.total_realized / annualTarget) * 100, 100)

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">Controlo de Realidade</CardTitle>
        <GoalStatusIndicator status={realityCheck.status} size="md" showLabel />
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <div className="mb-2 flex justify-between text-sm">
            <span className="text-muted-foreground">Progresso Anual</span>
            <span className="font-medium">{realityCheck.pct_achieved.toFixed(1)}%</span>
          </div>
          <Progress value={progressValue} className="h-2" />
        </div>

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-muted-foreground">Realizado</p>
            <p className="text-lg font-bold">{formatCurrency(realityCheck.total_realized)}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Objetivo até hoje</p>
            <p className="text-lg font-bold">{formatCurrency(realityCheck.target_to_date)}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Projeção Anual</p>
            <p className="text-lg font-bold">{formatCurrency(realityCheck.projected_annual)}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Gap</p>
            <p className="text-lg font-bold">{formatCurrency(realityCheck.gap)}</p>
          </div>
        </div>

        <div className="rounded-lg border border-dashed p-3">
          <p className="text-sm text-muted-foreground">{realityCheck.message}</p>
        </div>
      </CardContent>
    </Card>
  )
}
