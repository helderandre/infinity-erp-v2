'use client'

import { useState, useEffect, useCallback } from 'react'
import type { FunnelResponse, FunnelPeriod, FunnelScope } from '@/types/funnel'

interface UseFunnelArgs {
  consultantId?: string | null
  period: FunnelPeriod
  date?: string // YYYY-MM-DD; defaults to today
  scope?: FunnelScope // default 'consultant'
  enabled?: boolean
}

export function useFunnel({ consultantId, period, date, scope = 'consultant', enabled = true }: UseFunnelArgs) {
  const [data, setData] = useState<FunnelResponse | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    if (!enabled) return
    setIsLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      params.set('scope', scope)
      if (scope === 'consultant' && consultantId) params.set('consultant_id', consultantId)
      params.set('period', period)
      if (date) params.set('date', date)

      const res = await fetch(`/api/goals/funnel?${params.toString()}`)
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        throw new Error(json.error || 'Erro ao carregar funil')
      }
      const json: FunnelResponse = await res.json()
      setData(json)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido')
      setData(null)
    } finally {
      setIsLoading(false)
    }
  }, [consultantId, period, date, scope, enabled])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  return { data, isLoading, error, refetch: fetchData }
}
