'use client'

import { useEffect, useState } from 'react'

export interface MonthlyBucket {
  month: number
  vendedor_eur: number
  comprador_eur: number
}

export interface MonthlyRevenueData {
  year: number
  annual_target_eur: number
  months: MonthlyBucket[]
}

interface Options {
  agentId?: string | null
  year?: number
  refetchKey?: number
}

interface Result {
  data: MonthlyRevenueData | null
  isLoading: boolean
  error: string | null
}

export function useMonthlyRevenue({ agentId, year, refetchKey = 0 }: Options): Result {
  const [data, setData] = useState<MonthlyRevenueData | null>(null)
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

    const params = new URLSearchParams({ agent_id: agentId })
    if (year) params.set('year', String(year))

    fetch(`/api/agent-funnel-events/monthly-revenue?${params.toString()}`)
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

    return () => { cancelled = true }
  }, [agentId, year, refetchKey])

  return { data, isLoading, error }
}
