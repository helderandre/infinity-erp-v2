'use client'

import { useEffect, useState, useCallback } from 'react'
import type { TrajectoryResponse, TrajectoryScope } from '@/types/trajectory'

interface Args {
  year?: number
  consultantId?: string | null
  scope?: TrajectoryScope
  enabled?: boolean
}

export function useTrajectory(args: Args = {}) {
  const { year, consultantId, scope = 'consultant', enabled = true } = args
  const [data, setData] = useState<TrajectoryResponse | null>(null)
  const [isLoading, setIsLoading] = useState<boolean>(enabled)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    if (!enabled) return
    setIsLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (year) params.set('year', String(year))
      if (scope) params.set('scope', scope)
      if (scope === 'consultant' && consultantId) params.set('consultant_id', consultantId)
      const res = await fetch(`/api/goals/trajectory?${params.toString()}`)
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error || `HTTP ${res.status}`)
      }
      const json = (await res.json()) as TrajectoryResponse
      setData(json)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro a carregar trajectória')
    } finally {
      setIsLoading(false)
    }
  }, [year, scope, consultantId, enabled])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  return { data, isLoading, error, refetch: fetchData }
}
