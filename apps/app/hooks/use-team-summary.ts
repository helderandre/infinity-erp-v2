'use client'

import { useCallback, useEffect, useState } from 'react'
import type { TeamSummaryResponse } from '@/app/api/goals/team-summary/route'

export function useTeamSummary(year: number) {
  const [data, setData] = useState<TeamSummaryResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/goals/team-summary?year=${year}`)
      if (!res.ok) throw new Error('Erro ao carregar resumo de equipa')
      const json = (await res.json()) as TeamSummaryResponse
      setData(json)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido')
      setData(null)
    } finally {
      setIsLoading(false)
    }
  }, [year])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  return { data, isLoading, error, refetch: fetchData }
}
