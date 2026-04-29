'use client'

import { Suspense, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Settings2, GitBranch, LayoutDashboard, FileText } from 'lucide-react'
import { usePermissions } from '@/hooks/use-permissions'
import { useUser } from '@/hooks/use-user'
import { useGoals } from '@/hooks/use-goals'
import { FunnelObjetivosView } from '@/components/goals/funnel/funnel-objetivos-view'
import { GoalConfigSheet } from '@/components/goals/goal-config-sheet'
import { TrajectoryHero } from '@/components/goals/trajectory-hero'
import { CadenceHeatmap } from '@/components/goals/cadence-heatmap'
import { DiagnosticCards } from '@/components/goals/diagnostic-cards'

type ObjetivosTab = 'funil' | 'dashboard'

function isValidTab(v: string | null): v is ObjetivosTab {
  return v === 'funil' || v === 'dashboard'
}

function ObjetivosPageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { hasPermission, loading } = usePermissions()
  const { user } = useUser()
  const currentYear = new Date().getFullYear()
  const { goals, refetch } = useGoals({ year: currentYear, consultant_id: user?.id })
  const myGoalId = goals[0]?.id ?? null
  const [configOpen, setConfigOpen] = useState(false)
  const [refreshTick, setRefreshTick] = useState(0)

  const initialTab = searchParams.get('tab')
  const tab: ObjetivosTab = isValidTab(initialTab) ? initialTab : 'funil'

  function handleTabChange(value: string) {
    if (!isValidTab(value)) return
    const params = new URLSearchParams(searchParams.toString())
    params.set('tab', value)
    router.replace(`/dashboard/objetivos?${params.toString()}`, { scroll: false })
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full rounded-full" />
        <Skeleton className="h-28 w-full rounded-2xl" />
        <Skeleton className="h-[640px] w-full rounded-2xl" />
      </div>
    )
  }

  if (!hasPermission('goals')) {
    return (
      <div className="rounded-2xl border bg-white p-12 text-center text-sm text-muted-foreground">
        Sem permissão para ver objectivos.
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <Tabs value={tab} onValueChange={handleTabChange} className="space-y-4">
        {/* Tabs row + secondary actions on the right */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <TabsList className="rounded-full bg-muted/50 p-0.5 self-start">
            <TabsTrigger
              value="funil"
              className="rounded-full text-xs sm:text-sm gap-1.5 data-[state=active]:shadow-sm"
            >
              <GitBranch className="h-3.5 w-3.5" />
              Funil
            </TabsTrigger>
            <TabsTrigger
              value="dashboard"
              className="rounded-full text-xs sm:text-sm gap-1.5 data-[state=active]:shadow-sm"
            >
              <LayoutDashboard className="h-3.5 w-3.5" />
              Dashboard
            </TabsTrigger>
          </TabsList>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <Link
              href="/dashboard/objetivos/relatorio-semanal"
              className="inline-flex items-center gap-1.5 rounded-full border border-border/40 bg-card/60 backdrop-blur-sm px-3.5 py-1.5 text-xs font-medium text-foreground/80 hover:bg-accent hover:text-foreground transition-all"
            >
              <FileText className="h-3.5 w-3.5 text-blue-600" />
              Relatório semanal
            </Link>
          </div>
        </div>

        <TabsContent value="funil" className="mt-0 space-y-4">
          <FunnelObjetivosView
            key={refreshTick}
            onEditGoal={() => setConfigOpen(true)}
            hasGoal={!!myGoalId}
          />
        </TabsContent>

        <TabsContent value="dashboard" className="mt-0 space-y-4">
          <TrajectoryHero
            key={`traj-${refreshTick}`}
            year={currentYear}
            consultantId={user?.id ?? null}
          />
          <DiagnosticCards key={`diag-${refreshTick}`} consultantId={user?.id ?? null} />
          <CadenceHeatmap key={`cad-${refreshTick}`} consultantId={user?.id ?? null} weeks={12} />
        </TabsContent>
      </Tabs>

      {/* Botão inferior só em desktop — em mobile o gesto vive no header
          do funil (icon-button ao lado do Coach). */}
      <div className="hidden sm:flex justify-end">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setConfigOpen(true)}
          className="text-xs text-muted-foreground"
        >
          <Settings2 className="mr-1.5 h-3.5 w-3.5" />
          {myGoalId ? 'Editar objectivos anuais' : 'Configurar objectivos anuais'}
        </Button>
      </div>

      <GoalConfigSheet
        open={configOpen}
        onOpenChange={setConfigOpen}
        goalId={myGoalId}
        onSuccess={() => {
          refetch()
          setRefreshTick((n) => n + 1)
        }}
      />
    </div>
  )
}

export default function ObjetivosPage() {
  return (
    <Suspense fallback={null}>
      <ObjetivosPageInner />
    </Suspense>
  )
}
