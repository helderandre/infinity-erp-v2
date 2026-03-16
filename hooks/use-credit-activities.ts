'use client'

import { useState, useEffect, useCallback } from 'react'
import type { CreditActivity } from '@/types/credit'

interface UseCreditActivitiesReturn {
  activities: CreditActivity[]
  isLoading: boolean
  error: string | null
  refetch: () => void
  addActivity: (data: { tipo: string; descricao: string; metadata?: Record<string, unknown> }) => Promise<void>
}

export function useCreditActivities(creditId: string | null): UseCreditActivitiesReturn {
  const [activities, setActivities] = useState<CreditActivity[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchActivities = useCallback(async () => {
    if (!creditId) return
    setIsLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/credit/${creditId}/activities`)
      if (!res.ok) throw new Error('Erro ao carregar actividades')
      const json = await res.json()
      setActivities(json.data || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido')
    } finally {
      setIsLoading(false)
    }
  }, [creditId])

  useEffect(() => { fetchActivities() }, [fetchActivities])

  const addActivity = useCallback(async (data: { tipo: string; descricao: string; metadata?: Record<string, unknown> }) => {
    if (!creditId) return
    const res = await fetch(`/api/credit/${creditId}/activities`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (!res.ok) {
      const json = await res.json()
      throw new Error(json.error || 'Erro ao registar actividade')
    }
    await fetchActivities()
  }, [creditId, fetchActivities])

  return { activities, isLoading, error, refetch: fetchActivities, addActivity }
}
