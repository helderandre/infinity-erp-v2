'use client'

import { Suspense, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { GitBranch, LayoutDashboard, FileText, Pencil } from 'lucide-react'
import { usePermissions } from '@/hooks/use-permissions'
import { useUser } from '@/hooks/use-user'
import { useGoals } from '@/hooks/use-goals'
import { FunnelObjetivosView } from '@/components/goals/funnel/funnel-objetivos-view'
import { GoalConfigSheet } from '@/components/goals/goal-config-sheet'
import { TrajectoryHero } from '@/components/goals/trajectory-hero'
import { CadenceHeatmap } from '@/components/goals/cadence-heatmap'
import { DiagnosticCards } from '@/components/goals/diagnostic-cards'
import { FunnelRadialChart } from '@/components/goals/funnel-radial-chart'

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
        <Skeleton className="h-10 w-full rounded-md" />
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
      <Tabs value={tab} onValueChange={handleTabChange} className="gap-4">
        {/* Tabs row + secondary actions on the right */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <TabsList className="inline-flex items-center gap-1 p-1 rounded-full bg-muted/50 border border-border/30 h-auto w-auto">
            <TabsTrigger
              value="funil"
              className="inline-flex items-center justify-center shrink-0 gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors duration-300 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm data-[state=inactive]:bg-transparent data-[state=inactive]:text-muted-foreground data-[state=inactive]:hover:text-foreground data-[state=inactive]:hover:bg-background/40"
            >
              <GitBranch className="h-3.5 w-3.5 shrink-0" />
              Funil
            </TabsTrigger>
            <TabsTrigger
              value="dashboard"
              className="inline-flex items-center justify-center shrink-0 gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors duration-300 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm data-[state=inactive]:bg-transparent data-[state=inactive]:text-muted-foreground data-[state=inactive]:hover:text-foreground data-[state=inactive]:hover:bg-background/40"
            >
              <LayoutDashboard className="h-3.5 w-3.5 shrink-0" />
              Dashboard
            </TabsTrigger>
          </TabsList>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <Button
              asChild
              variant="outline"
              size="sm"
              className="h-8 text-xs gap-1.5"
            >
              <Link href="/dashboard/objetivos/relatorio-semanal">
                <FileText className="h-3.5 w-3.5 text-blue-600" />
                Relatório semanal
              </Link>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setConfigOpen(true)}
              className="h-8 text-xs gap-1.5"
              title={myGoalId ? 'Editar objectivos anuais' : 'Configurar objectivos anuais'}
            >
              <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
              {myGoalId ? 'Editar' : 'Configurar'}
            </Button>
          </div>
        </div>

        <TabsContent value="funil" className="space-y-4">
          <FunnelObjetivosView key={refreshTick} />
        </TabsContent>

        <TabsContent value="dashboard" className="space-y-4">
          <TrajectoryHero
            key={`traj-${refreshTick}`}
            year={currentYear}
            consultantId={user?.id ?? null}
          />
          <DiagnosticCards key={`diag-${refreshTick}`} consultantId={user?.id ?? null} />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
            <FunnelRadialChart key={`radial-${refreshTick}`} consultantId={user?.id ?? null} />
            <CadenceHeatmap key={`cad-${refreshTick}`} consultantId={user?.id ?? null} weeks={12} />
          </div>
        </TabsContent>
      </Tabs>

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
