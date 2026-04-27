'use client'

import { Suspense, useState } from 'react'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Settings2 } from 'lucide-react'
import { usePermissions } from '@/hooks/use-permissions'
import { FunnelObjetivosView } from '@/components/goals/funnel/funnel-objetivos-view'
import { GoalConfigSheet } from '@/components/goals/goal-config-sheet'

function ObjetivosPageInner() {
  const { hasPermission, loading } = usePermissions()
  const [configOpen, setConfigOpen] = useState(false)

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
      <FunnelObjetivosView />
      <div className="flex justify-end">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setConfigOpen(true)}
          className="text-xs text-muted-foreground"
        >
          <Settings2 className="mr-1.5 h-3.5 w-3.5" />
          Configurar objectivos anuais
        </Button>
      </div>
      <GoalConfigSheet open={configOpen} onOpenChange={setConfigOpen} />
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
