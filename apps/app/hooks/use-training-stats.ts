'use client'

import { useState, useEffect, useCallback } from 'react'
import type { TrainingOverviewStats, UserTrainingStats } from '@/types/training'

interface UseTrainingStatsReturn {
  stats: TrainingOverviewStats | null
  isLoading: boolean
  error: string | null
  refetch: () => void
}

export function useTrainingStats(): UseTrainingStatsReturn {
  const [stats, setStats] = useState<TrainingOverviewStats | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchStats = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/training/stats/overview')
      if (!res.ok) throw new Error('Erro ao carregar estatísticas')
      const data = await res.json()
      setStats(data)
    } catch (err) {
      console.error('Erro ao carregar estatísticas:', err)
      setError(err instanceof Error ? err.message : 'Erro desconhecido')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchStats()
  }, [fetchStats])

  return { stats, isLoading, error, refetch: fetchStats }
}

interface UseUserTrainingStatsReturn {
  stats: UserTrainingStats | null
  isLoading: boolean
  error: string | null
  refetch: () => void
}

export function useUserTrainingStats(userId: string | null): UseUserTrainingStatsReturn {
  const [stats, setStats] = useState<UserTrainingStats | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchStats = useCallback(async () => {
    if (!userId) {
      setStats(null)
      setIsLoading(false)
      return
    }
    setIsLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/training/stats/users/${userId}`)
      if (!res.ok) throw new Error('Erro ao carregar estatísticas do utilizador')
      const data = await res.json()
      setStats(data)
    } catch (err) {
      console.error('Erro ao carregar estatísticas:', err)
      setError(err instanceof Error ? err.message : 'Erro desconhecido')
    } finally {
      setIsLoading(false)
    }
  }, [userId])

  useEffect(() => {
    fetchStats()
  }, [fetchStats])

  return { stats, isLoading, error, refetch: fetchStats }
}
