'use client'

import { Suspense, useState } from 'react'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Settings2 } from 'lucide-react'
import { usePermissions } from '@/hooks/use-permissions'
import { useUser } from '@/hooks/use-user'
import { useGoals } from '@/hooks/use-goals'
import { FunnelObjetivosView } from '@/components/goals/funnel/funnel-objetivos-view'
import { GoalConfigSheet } from '@/components/goals/goal-config-sheet'

function ObjetivosPageInner() {
  const { hasPermission, loading } = usePermissions()
  const { user } = useUser()
  const currentYear = new Date().getFullYear()
  // Look up the user's goal for the current year so the sheet opens in edit
  // mode (pre-filled) instead of always showing a blank "create" form when a
  // goal already exists.
  const { goals, refetch } = useGoals({ year: currentYear, consultant_id: user?.id })
  const myGoalId = goals[0]?.id ?? null
  const [configOpen, setConfigOpen] = useState(false)
  // Bumped após cada criação/edição de objetivo para forçar o
  // <FunnelObjetivosView> (e seus hooks internos `useFunnel`) a re-montar e
  // re-fazer fetch — refetch local não os atinge.
  const [refreshTick, setRefreshTick] = useState(0)

  if (loading) {
    return (
      <div className="space-y-4">
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
      <FunnelObjetivosView
        key={refreshTick}
        onEditGoal={() => setConfigOpen(true)}
        hasGoal={!!myGoalId}
      />
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
