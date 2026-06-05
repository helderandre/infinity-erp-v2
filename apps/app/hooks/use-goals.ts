'use client'

import { useState, useEffect, useCallback } from 'react'
import type { ConsultantGoalWithConsultant } from '@/types/goal'

interface UseGoalsParams {
  year?: number
  consultant_id?: string
}

export function useGoals({ year, consultant_id }: UseGoalsParams = {}) {
  const [goals, setGoals] = useState<ConsultantGoalWithConsultant[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchGoals = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (year) params.set('year', String(year))
      if (consultant_id) params.set('consultant_id', consultant_id)

      const res = await fetch(`/api/goals?${params.toString()}`)
      if (!res.ok) throw new Error('Erro ao carregar objetivos')

      const json = await res.json()
      setGoals(json.data || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido')
      setGoals([])
    } finally {
      setIsLoading(false)
    }
  }, [year, consultant_id])

  useEffect(() => {
    fetchGoals()
  }, [fetchGoals])

  return { goals, isLoading, error, refetch: fetchGoals }
}
