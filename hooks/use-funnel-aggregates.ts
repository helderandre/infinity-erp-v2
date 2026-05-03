'use client'

import { useCallback, useEffect, useState } from 'react'
import type { FunnelAggregates } from '@/types/funnel-event'

interface UseFunnelAggregatesOptions {
  agentId?: string | null
  since?: string
  until?: string
  /** Bumping this re-fetches (e.g. after manual entry) */
  refetchKey?: number
}

interface UseFunnelAggregatesResult {
  data: FunnelAggregates | null
  isLoading: boolean
  error: string | null
  refetch: () => void
}

export function useFunnelAggregates({
  agentId,
  since,
  until,
  refetchKey = 0,
}: UseFunnelAggregatesOptions): UseFunnelAggregatesResult {
  const [data, setData] = useState<FunnelAggregates | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [internalKey, setInternalKey] = useState(0)

  useEffect(() => {
    if (!agentId) {
      setIsLoading(false)
      return
    }
    let cancelled = false
    setIsLoading(true)
    setError(null)

    const params = new URLSearchParams({ agent_id: agentId })
    if (since) params.set('since', since)
    if (until) params.set('until', until)

    fetch(`/api/agent-funnel-events/aggregates?${params.toString()}`)
      .then(async (res) => {
        const body = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(body?.error || `HTTP ${res.status}`)
        return body
      })
      .then((body) => {
        if (cancelled) return
        setData(body.data ?? null)
      })
      .catch((err) => {
        if (cancelled) return
        setError(err instanceof Error ? err.message : 'Erro desconhecido')
        setData(null)
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [agentId, since, until, refetchKey, internalKey])

  const refetch = useCallback(() => {
    setInternalKey((k) => k + 1)
  }, [])

  return { data, isLoading, error, refetch }
}
