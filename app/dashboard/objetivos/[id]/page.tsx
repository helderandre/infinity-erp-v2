'use client'

import { useState, use } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { Pencil, Plus } from 'lucide-react'
import { useGoalDashboard } from '@/hooks/use-goal-dashboard'
import { useGoalActivities } from '@/hooks/use-goal-activities'
import { GoalKpiHero } from '@/components/goals/goal-kpi-hero'
import { GoalFinancialCards } from '@/components/goals/goal-financial-cards'
import { GoalFunnelTable } from '@/components/goals/goal-funnel-table'
import { GoalDailyActions } from '@/components/goals/goal-daily-actions'
import { GoalWeeklyActivitySummary } from '@/components/goals/goal-weekly-activity-summary'
import { GoalRealityCheck } from '@/components/goals/goal-reality-check'
import { GoalActivityForm } from '@/components/goals/goal-activity-form'
import { GoalActivityTimeline } from '@/components/goals/goal-activity-timeline'
import { formatCurrency } from '@/lib/constants'

export default function ObjetivoDetalhePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { dashboard, progress, isLoading, refetch } = useGoalDashboard(id)
  const { activities, refetch: refetchActivities } = useGoalActivities({ goalId: id })
  const [activityDialogOpen, setActivityDialogOpen] = useState(false)

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-48 w-full" />
        <div className="grid grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      </div>
    )
  }

  if (!dashboard) {
    return (
      <div className="py-12 text-center text-sm text-muted-foreground">
        Objetivo não encontrado.
      </div>
    )
  }

  const { goal, financial, funnel_sellers, funnel_buyers, reality_check, today } = dashboard

  const sellerParams = [
    { label: 'Valor médio venda', value: goal.sellers_avg_sale_value ? formatCurrency(goal.sellers_avg_sale_value) : null },
    { label: 'Comissão média', value: goal.sellers_avg_commission_pct ? `${goal.sellers_avg_commission_pct}%` : null },
    { label: '% angariações vendidas', value: goal.sellers_pct_listings_sold ? `${goal.sellers_pct_listings_sold}%` : null },
    { label: '% visita → angariação', value: goal.sellers_pct_visit_to_listing ? `${goal.sellers_pct_visit_to_listing}%` : null },
    { label: '% lead → visita', value: goal.sellers_pct_lead_to_visit ? `${goal.sellers_pct_lead_to_visit}%` : null },
    { label: 'Chamadas por lead', value: goal.sellers_avg_calls_per_lead },
  ]

  const buyerParams = [
    { label: 'Valor médio compra', value: goal.buyers_avg_purchase_value ? formatCurrency(goal.buyers_avg_purchase_value) : null },
    { label: 'Comissão média', value: goal.buyers_avg_commission_pct ? `${goal.buyers_avg_commission_pct}%` : null },
    { label: 'Taxa de fecho', value: goal.buyers_close_rate ? `${goal.buyers_close_rate}%` : null },
    { label: '% lead → qualificado', value: goal.buyers_pct_lead_to_qualified ? `${goal.buyers_pct_lead_to_qualified}%` : null },
    { label: 'Chamadas por lead', value: goal.buyers_avg_calls_per_lead },
  ]

  return (
    <div className="space-y-6">
      {/* Actions bar */}
      <div className="flex items-center justify-end gap-2">
        <Dialog open={activityDialogOpen} onOpenChange={setActivityDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Registar Actividade
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Registar Actividade</DialogTitle>
            </DialogHeader>
            <GoalActivityForm
              goalId={id}
              onSuccess={() => {
                setActivityDialogOpen(false)
                refetch()
                refetchActivities()
              }}
              onCancel={() => setActivityDialogOpen(false)}
            />
          </DialogContent>
        </Dialog>
        <Button variant="outline" asChild>
          <Link href={`/dashboard/objetivos/${id}/editar`}>
            <Pencil className="mr-2 h-4 w-4" />
            Editar
          </Link>
        </Button>
      </div>

      {/* 1. Hero — Key numbers + projection + message */}
      <GoalKpiHero
        consultantName={goal.consultant?.commercial_name || 'Consultor'}
        year={goal.year}
        financial={financial}
        realityCheck={reality_check}
        progress={progress}
      />

      {/* 2. Financial breakdown — 4 periods */}
      <GoalFinancialCards financial={financial} progress={progress} />

      {/* 3. Today + This Week — side by side */}
      <div className="grid gap-4 lg:grid-cols-2">
        <GoalDailyActions targets={today} todayActivities={activities} />
        <GoalWeeklyActivitySummary
          activities={activities}
          sellerWeekly={funnel_sellers.weekly}
          buyerWeekly={funnel_buyers.weekly}
        />
      </div>

      {/* 4. Funnels + Reality Check */}
      <div className="grid gap-4 lg:grid-cols-2">
        <GoalFunnelTable
          title="Funil Vendedores"
          type="sellers"
          funnel={funnel_sellers}
          pct={goal.pct_sellers}
          params={sellerParams}
        />
        <GoalFunnelTable
          title="Funil Compradores"
          type="buyers"
          funnel={funnel_buyers}
          pct={goal.pct_buyers}
          params={buyerParams}
        />
      </div>

      {/* 5. Activity History */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Histórico de Actividades</CardTitle>
        </CardHeader>
        <CardContent>
          <GoalActivityTimeline activities={activities.slice(0, 20)} />
          {activities.length > 20 && (
            <p className="mt-4 text-center text-xs text-muted-foreground">
              A mostrar as 20 mais recentes de {activities.length} actividades
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
