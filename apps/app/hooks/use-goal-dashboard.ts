'use client'

import { useState, useEffect, useCallback } from 'react'
import type { GoalDashboard } from '@/types/goal'

export function useGoalDashboard(goalId: string | null) {
  const [dashboard, setDashboard] = useState<GoalDashboard | null>(null)
  const [progress, setProgress] = useState<{
    annual: { realized: number; target: number }
    monthly: { realized: number; target: number }
    weekly: { realized: number; target: number }
  } | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchDashboard = useCallback(async () => {
    if (!goalId) return
    setIsLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/goals/${goalId}/dashboard`)
      if (!res.ok) throw new Error('Erro ao carregar dashboard')

      const json = await res.json()
      setDashboard(json)
      setProgress(json.progress || null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido')
      setDashboard(null)
    } finally {
      setIsLoading(false)
    }
  }, [goalId])

  useEffect(() => {
    fetchDashboard()
  }, [fetchDashboard])

  return { dashboard, progress, isLoading, error, refetch: fetchDashboard }
}
