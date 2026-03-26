'use client'

import { useState, use } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { Pencil, Plus, Target, Filter, History } from 'lucide-react'
import { useGoalDashboard } from '@/hooks/use-goal-dashboard'
import { useGoalActivities } from '@/hooks/use-goal-activities'
import { GoalKpiHero } from '@/components/goals/goal-kpi-hero'
import { GoalFinancialCards } from '@/components/goals/goal-financial-cards'
import { GoalFunnelTable } from '@/components/goals/goal-funnel-table'
import { GoalDailyActions } from '@/components/goals/goal-daily-actions'
import { GoalWeeklyActivitySummary } from '@/components/goals/goal-weekly-activity-summary'
// GoalRealityCheck used in hero card
import { GoalActivityForm } from '@/components/goals/goal-activity-form'
import { GoalActivityTimeline } from '@/components/goals/goal-activity-timeline'
import { formatCurrency } from '@/lib/constants'

const TAB_CONFIG = [
  { value: 'objetivos', icon: Target, label: 'Objetivos' },
  { value: 'funil-vendedores', icon: Filter, label: 'Funil Vendedores' },
  { value: 'funil-compradores', icon: Filter, label: 'Funil Compradores' },
  { value: 'historico', icon: History, label: 'Histórico' },
] as const

export default function ObjetivoDetalhePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { dashboard, progress, isLoading, refetch } = useGoalDashboard(id)
  const { activities, refetch: refetchActivities } = useGoalActivities({ goalId: id })
  const [activityDialogOpen, setActivityDialogOpen] = useState(false)
  const [activeTab, setActiveTab] = useState('objetivos')

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-56 w-full rounded-2xl" />
        <Skeleton className="h-10 w-96 rounded-xl" />
        <Skeleton className="h-96 rounded-xl" />
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

  const heroActions = (
    <>
      <Dialog open={activityDialogOpen} onOpenChange={setActivityDialogOpen}>
        <DialogTrigger asChild>
          <Button size="sm" className="rounded-xl text-xs">
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Registar
          </Button>
        </DialogTrigger>
        <DialogContent className="rounded-2xl">
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
      <Button size="sm" variant="outline" asChild className="rounded-xl text-xs">
        <Link href={`/dashboard/objetivos/${id}/editar`}>
          <Pencil className="mr-1.5 h-3.5 w-3.5" />
          Editar
        </Link>
      </Button>
    </>
  )

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab}>
      <div className="space-y-5">
        {/* Hero card */}
        <GoalKpiHero
          consultantName={goal.consultant?.commercial_name || 'Consultor'}
          year={goal.year}
          financial={financial}
          realityCheck={reality_check}
          progress={progress}
          actions={heroActions}
        />

        {/* Tabs — pill style matching rest of app */}
        <TabsList className="flex items-center gap-1 rounded-full bg-muted/60 p-1 w-fit h-auto">
          {TAB_CONFIG.map(({ value, icon: Icon, label }) => (
            <TabsTrigger
              key={value}
              value={value}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all duration-300 data-[state=active]:bg-white data-[state=active]:text-neutral-900 data-[state=active]:shadow-sm data-[state=inactive]:text-muted-foreground data-[state=inactive]:hover:text-foreground border-0 bg-transparent"
            >
              <Icon className={`h-3.5 w-3.5 ${value === 'funil-compradores' ? 'rotate-180' : ''}`} />
              {label}
            </TabsTrigger>
          ))}
        </TabsList>

        {/* Tab contents */}
        <TabsContent value="objetivos" className="mt-0 space-y-5">
          <GoalFinancialCards financial={financial} progress={progress} />
          <div className="grid gap-5 lg:grid-cols-2">
            <GoalDailyActions targets={today} todayActivities={activities} />
            <GoalWeeklyActivitySummary
              activities={activities}
              sellerWeekly={funnel_sellers.weekly}
              buyerWeekly={funnel_buyers.weekly}
            />
          </div>
        </TabsContent>

        <TabsContent value="funil-vendedores" className="mt-0">
          <GoalFunnelTable
            title="Funil Vendedores"
            type="sellers"
            funnel={funnel_sellers}
            pct={goal.pct_sellers}
            params={sellerParams}
          />
        </TabsContent>

        <TabsContent value="funil-compradores" className="mt-0">
          <GoalFunnelTable
            title="Funil Compradores"
            type="buyers"
            funnel={funnel_buyers}
            pct={goal.pct_buyers}
            params={buyerParams}
          />
        </TabsContent>

        <TabsContent value="historico" className="mt-0">
          <div className="rounded-2xl border bg-card/80 backdrop-blur-sm shadow-sm p-5">
            <h3 className="text-sm font-semibold mb-4">Histórico de Actividades</h3>
            <GoalActivityTimeline activities={activities.slice(0, 50)} />
            {activities.length > 50 && (
              <p className="mt-4 text-center text-xs text-muted-foreground">
                A mostrar as 50 mais recentes de {activities.length} actividades
              </p>
            )}
          </div>
        </TabsContent>
      </div>
    </Tabs>
  )
}
