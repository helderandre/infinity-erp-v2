'use client'

import { useCallback, useEffect, useState } from 'react'

export interface NegocioActivity {
  id: string
  contact_id: string
  negocio_id: string | null
  activity_type: string
  direction: string | null
  subject: string | null
  description: string | null
  metadata: Record<string, unknown> | null
  created_by: string | null
  created_at: string
  created_by_user?: { id: string; commercial_name: string | null } | null
}

interface UseNegocioActivitiesResult {
  activities: NegocioActivity[]
  isLoading: boolean
  error: string | null
  refetch: () => Promise<void>
}

/**
 * Vai buscar as actividades do lead e filtra por negocio_id (client-side).
 * O endpoint /api/leads/[id]/activities devolve até 100 entradas.
 */
export function useNegocioActivities(
  leadId: string | null | undefined,
  negocioId: string | null | undefined,
): UseNegocioActivitiesResult {
  const [activities, setActivities] = useState<NegocioActivity[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(async () => {
    if (!leadId || !negocioId) return
    setIsLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/leads/${leadId}/activities`)
      if (!res.ok) throw new Error('Erro ao carregar actividades')
      const json = await res.json()
      const all: NegocioActivity[] = json.data || []
      setActivities(all.filter((a) => a.negocio_id === negocioId))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro')
    } finally {
      setIsLoading(false)
    }
  }, [leadId, negocioId])

  useEffect(() => {
    void refetch()
  }, [refetch])

  return { activities, isLoading, error, refetch }
}
