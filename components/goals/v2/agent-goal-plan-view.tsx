'use client'

import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useUser } from '@/hooks/use-user'
import { useAgentGoal } from '@/hooks/use-agent-goal'
import { useFunnelAggregates } from '@/hooks/use-funnel-aggregates'
import { useAvgCloseTime } from '@/hooks/use-avg-close-time'
import { useMonthlyRevenue } from '@/hooks/use-monthly-revenue'
import { AGENT_GOAL_DEFAULTS, type AgentGoalInput } from '@/types/agent-goal'
import { computeAgentGoalTargets } from '@/lib/goals/v2/compute-targets'
import { FinancialSummaryCard } from './financial-summary-card'
import { CompradorListCard, VendedorListCard, PeriodToggle, type Period } from './funnel-resumo-cards'
import { EditPlanSheet } from './edit-plan-sheet'
import { TrajectoryChart } from './trajectory-chart'
import { PaceIndicator } from './pace-indicator'
import { RelatorioSemanalView } from './relatorio-semanal-view'
import { Pencil, Target, Filter as FunnelIcon, FileText } from 'lucide-react'
import { cn } from '@/lib/utils'

type MainView = 'funil' | 'relatorio' | 'target'

function buildInitialState(year: number, agentId: string): AgentGoalInput {
  return {
    agent_id: agentId,
    period_year: year,
    annual_revenue_target_eur: 100_000,
    pct_vendedores: 50,
    pct_compradores: 50,
    ...AGENT_GOAL_DEFAULTS,
  }
}

export function AgentGoalPlanView() {
  const { user } = useUser()
  const year = new Date().getFullYear()
  const { goal, isLoading, refetch } = useAgentGoal({ year, agentId: user?.id ?? null })
  const { data: aggregates, refetch: refetchAggregates } = useFunnelAggregates({
    agentId: user?.id ?? null,
  })
  const { data: avgCloseTime } = useAvgCloseTime({ agentId: user?.id ?? null })
  const { data: monthlyRevenue, isLoading: monthlyLoading } = useMonthlyRevenue({
    agentId: user?.id ?? null,
    year,
  })

  const [view, setView] = useState<MainView>('funil')
  const [period, setPeriod] = useState<Period>('ano')
  const [editOpen, setEditOpen] = useState(false)

  const displayGoal: AgentGoalInput | null = useMemo(() => {
    if (!user?.id) return null
    if (goal) {
      const { id: _id, created_at: _ca, updated_at: _ua, targets: _t, ...rest } = goal
      return rest as AgentGoalInput
    }
    if (!isLoading) return buildInitialState(year, user.id)
    return null
  }, [user?.id, goal, isLoading, year])

  const targets = useMemo(() => (displayGoal ? computeAgentGoalTargets(displayGoal) : null), [displayGoal])

  if (!user?.id || isLoading || !displayGoal || !targets) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 w-full rounded-xl" />
        <Skeleton className="h-48 w-full rounded-2xl" />
        <Skeleton className="h-[480px] w-full rounded-2xl" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header row: centered view toggle + edit button on the right.
          Labels: always visible on desktop; on mobile only the active one. */}
      <div className="relative flex items-center justify-center">
        <div className="inline-flex items-center gap-1 p-1 rounded-full bg-muted/50 border border-border/30">
          {([
            { id: 'funil', Icon: FunnelIcon, label: 'Funil' },
            { id: 'relatorio', Icon: FileText, label: 'Relatório' },
            { id: 'target', Icon: Target, label: 'Financeira' },
          ] as const).map(({ id, Icon, label }) => {
            const active = view === id
            return (
              <button
                key={id}
                type="button"
                onClick={() => setView(id)}
                aria-label={label}
                className={cn(
                  'inline-flex items-center justify-center gap-1.5 h-8 px-3 rounded-full text-xs font-medium transition-colors',
                  active
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground hover:bg-background/40'
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className={cn(active ? 'inline' : 'hidden sm:inline')}>
                  {label}
                </span>
              </button>
            )
          })}
        </div>
        <div className="absolute right-0 top-1/2 -translate-y-1/2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setEditOpen(true)}
            className="rounded-full gap-1.5 h-8 text-xs"
          >
            <Pencil className="h-3.5 w-3.5" />
            Editar2
          </Button>
        </div>
      </div>

      {view === 'funil' && (
        <>
          <PeriodToggle period={period} setPeriod={setPeriod} />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
            <VendedorListCard
              goal={displayGoal}
              targets={targets}
              period={period}
              avgClose={avgCloseTime?.vendedor ?? null}
              windowMonths={avgCloseTime?.window_months ?? 12}
              realized={aggregates?.counts.vendedor ?? {}}
              onRefresh={refetchAggregates}
            />
            <CompradorListCard
              goal={displayGoal}
              targets={targets}
              period={period}
              avgClose={avgCloseTime?.comprador ?? null}
              windowMonths={avgCloseTime?.window_months ?? 12}
              realized={aggregates?.counts.comprador ?? {}}
              onRefresh={refetchAggregates}
            />
          </div>
        </>
      )}

      {view === 'relatorio' && (
        <RelatorioSemanalView />
      )}

      {view === 'target' && (
        <>
          <FinancialSummaryCard goal={displayGoal} aggregates={aggregates} />
          <PaceIndicator goal={displayGoal} aggregates={aggregates} />
          <TrajectoryChart data={monthlyRevenue} isLoading={monthlyLoading} />
        </>
      )}

      <EditPlanSheet
        open={editOpen}
        onOpenChange={setEditOpen}
        onSaved={() => {
          refetch()
          refetchAggregates()
        }}
      />
    </div>
  )
}
