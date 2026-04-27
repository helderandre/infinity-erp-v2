'use client'

import { useState, useEffect, useCallback } from 'react'
import type { TeamOverviewResponse, FunnelPeriod } from '@/types/funnel'

interface UseTeamOverviewArgs {
  period: FunnelPeriod
  date?: string
  enabled?: boolean
}

export function useTeamOverview({ period, date, enabled = true }: UseTeamOverviewArgs) {
  const [data, setData] = useState<TeamOverviewResponse | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    if (!enabled) return
    setIsLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      params.set('period', period)
      if (date) params.set('date', date)
      const res = await fetch(`/api/goals/funnel/team-overview?${params.toString()}`)
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        throw new Error(json.error || 'Erro ao carregar resumo da equipa')
      }
      const json: TeamOverviewResponse = await res.json()
      setData(json)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido')
      setData(null)
    } finally {
      setIsLoading(false)
    }
  }, [period, date, enabled])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  return { data, isLoading, error, refetch: fetchData }
}
