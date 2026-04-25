'use client'

import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { Skeleton } from '@/components/ui/skeleton'
import { usePermissions } from '@/hooks/use-permissions'
import { ConsultantObjetivosHome } from '@/components/goals/consultant-objetivos-home'
import { ManagerObjetivosView } from '@/components/goals/manager-objetivos-view'

function ObjetivosPageInner() {
  const searchParams = useSearchParams()
  const { isBroker, isTeamLeader, loading } = usePermissions()

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-12 w-64 rounded-xl" />
        <Skeleton className="h-44 w-full rounded-2xl" />
        <Skeleton className="h-[400px] w-full rounded-2xl" />
      </div>
    )
  }

  const isManager = isBroker() || isTeamLeader()
  const view = searchParams.get('view') as 'self' | 'equipa' | null

  // Resolve effective view:
  // - Explicit ?view=... wins.
  // - Default for managers: equipa. Default for consultores: self.
  const effectiveView: 'self' | 'equipa' =
    view === 'equipa' ? 'equipa'
    : view === 'self' ? 'self'
    : isManager ? 'equipa'
    : 'self'

  if (effectiveView === 'equipa' && isManager) {
    return <ManagerObjetivosView showRoleToggle={isManager} />
  }
  return <ConsultantObjetivosHome showRoleToggle={isManager} />
}

export default function ObjetivosPage() {
  return (
    <Suspense fallback={null}>
      <ObjetivosPageInner />
    </Suspense>
  )
}
