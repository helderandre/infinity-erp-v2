'use client'

import { Suspense } from 'react'
import { Skeleton } from '@/components/ui/skeleton'
import { usePermissions } from '@/hooks/use-permissions'
import { AgentGoalPlanView } from '@/components/goals/v2/agent-goal-plan-view'

function ObjetivosPageInner() {
  const { hasPermission, loading } = usePermissions()

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

  return <AgentGoalPlanView />
}

export default function ObjetivosPage() {
  return (
    <Suspense fallback={null}>
      <ObjetivosPageInner />
    </Suspense>
  )
}
