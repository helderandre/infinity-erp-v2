'use client'

import { useEffect, useState } from 'react'

interface SideStats {
  avg_days: number | null
  count: number
}

export interface AvgCloseTimeData {
  window_months: number
  vendedor: SideStats
  comprador: SideStats
}

interface UseAvgCloseTimeOptions {
  agentId?: string | null
  windowMonths?: number
}

interface UseAvgCloseTimeResult {
  data: AvgCloseTimeData | null
  isLoading: boolean
  error: string | null
}

export function useAvgCloseTime({ agentId, windowMonths = 12 }: UseAvgCloseTimeOptions): UseAvgCloseTimeResult {
  const [data, setData] = useState<AvgCloseTimeData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!agentId) {
      setIsLoading(false)
      return
    }
    let cancelled = false
    setIsLoading(true)
    setError(null)

    const params = new URLSearchParams({
      agent_id: agentId,
      window_months: String(windowMonths),
    })

    fetch(`/api/agent-goals/avg-close-time?${params.toString()}`)
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
  }, [agentId, windowMonths])

  return { data, isLoading, error }
}
