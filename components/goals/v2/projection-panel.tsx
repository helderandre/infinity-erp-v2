'use client'

import { useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { computeAgentGoalTargets } from '@/lib/goals/v2/compute-targets'
import { formatCurrency } from '@/lib/utils'
import type { AgentGoalInput } from '@/types/agent-goal'
import { CheckCircle2, AlertTriangle, TrendingUp } from 'lucide-react'

interface ProjectionPanelProps {
  goal: AgentGoalInput
}

function fmtNum(n: number, digits = 1): string {
  if (!Number.isFinite(n)) return '—'
  return new Intl.NumberFormat('pt-PT', { maximumFractionDigits: digits }).format(n)
}

export function ProjectionPanel({ goal }: ProjectionPanelProps) {
  const targets = useMemo(() => computeAgentGoalTargets(goal), [goal])

  const gap = goal.annual_revenue_target_eur - targets.total_projected_revenue_eur
  const meetsGoal = gap <= 0.5 // tolerate floating noise
  const pct = goal.annual_revenue_target_eur > 0
    ? Math.min(100, (targets.total_projected_revenue_eur / goal.annual_revenue_target_eur) * 100)
    : 0

  return (
    <Card className="sticky top-4">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <TrendingUp className="h-4 w-4 text-primary" />
          Projeção do teu objetivo
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Vendedor side */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Lado vendedor</span>
            <span className="text-sm font-semibold tabular-nums">
              {formatCurrency(targets.vend_projected_revenue_eur)}
            </span>
          </div>
          <div className="text-xs text-muted-foreground">
            {fmtNum(targets.vend_target_escrituras)} escrituras · {fmtNum(targets.vend_target_angariacoes)} angariações
          </div>
          <div className="text-xs text-muted-foreground">
            Por semana: ~{fmtNum(targets.vend_contactos_per_week, 0)} contactos novos · ~{fmtNum(targets.vend_visitas_per_week, 0)} visitas
          </div>
        </div>

        <div className="border-t border-border/30" />

        {/* Comprador side */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Lado comprador</span>
            <span className="text-sm font-semibold tabular-nums">
              {formatCurrency(targets.comp_projected_revenue_eur)}
            </span>
          </div>
          <div className="text-xs text-muted-foreground">
            {fmtNum(targets.comp_target_escrituras)} escrituras
          </div>
          <div className="text-xs text-muted-foreground">
            Por semana: ~{fmtNum(targets.comp_contactos_per_week, 0)} contactos novos · ~{fmtNum(targets.comp_visitas_per_week, 0)} visitas
          </div>
        </div>

        <div className="border-t border-border/30" />

        {/* Total + status */}
        <div className="space-y-2 rounded-lg bg-muted/40 p-3">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase tracking-wide text-muted-foreground">Total projetado</span>
            <span className="text-base font-bold tabular-nums">
              {formatCurrency(targets.total_projected_revenue_eur)}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase tracking-wide text-muted-foreground">Objetivo anual</span>
            <span className="text-sm font-medium tabular-nums text-muted-foreground">
              {formatCurrency(goal.annual_revenue_target_eur)}
            </span>
          </div>

          {/* Progress bar */}
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-background">
            <div
              className={meetsGoal ? 'h-full bg-emerald-500 transition-all' : 'h-full bg-amber-500 transition-all'}
              style={{ width: `${pct}%` }}
            />
          </div>

          {meetsGoal ? (
            <Badge variant="outline" className="w-full justify-center gap-1.5 border-emerald-500/40 bg-emerald-50 text-emerald-700">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Cobre o objetivo
            </Badge>
          ) : (
            <Badge variant="outline" className="w-full justify-center gap-1.5 border-amber-500/40 bg-amber-50 text-amber-700">
              <AlertTriangle className="h-3.5 w-3.5" />
              Falta {formatCurrency(gap)}
            </Badge>
          )}
        </div>

        <p className="text-[11px] leading-relaxed text-muted-foreground">
          Atualiza em tempo real conforme editas os campos. CPCV→Escritura assume 95% (constante).
        </p>
      </CardContent>
    </Card>
  )
}
