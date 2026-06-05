'use client'

import { ActivityStrip } from './activity-strip'
import type { NegocioActivity } from '@/hooks/use-negocio-activities'

interface FullActivityListProps {
  activities: NegocioActivity[]
  isLoading?: boolean
}

/**
 * Renderiza a actividade completa (sem limite) reutilizando a mesma row
 * visual do strip. Em iter 1 é simplesmente o strip sem limite.
 */
export function FullActivityList({ activities, isLoading }: FullActivityListProps) {
  return (
    <div className="-mx-2">
      <ActivityStrip activities={activities} isLoading={!!isLoading} limit={activities.length} />
    </div>
  )
}
