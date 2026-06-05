'use client'

import { useCallback, useEffect, useState } from 'react'

export type MarketingMomentDueItem = {
  event_id: string
  event_type: 'cpcv' | 'escritura' | 'contrato_arrendamento' | 'entrega_chaves'
  scheduled_at: string
  occurred_at: string | null
  status: string
  deal_id: string
  deal_reference: string | null
  business_type: string | null
  property_address: string | null
  property_slug: string | null
  negocio_id: string | null
  lead_id: string | null
  lead_name: string | null
}

interface UseMarketingMomentsDueReturn {
  items: MarketingMomentDueItem[]
  isLoading: boolean
  error: string | null
  refetch: () => void
}

export function useMarketingMomentsDue(opts?: { all?: boolean; enabled?: boolean }): UseMarketingMomentsDueReturn {
  const enabled = opts?.enabled ?? true
  const [items, setItems] = useState<MarketingMomentDueItem[]>([])
  const [isLoading, setIsLoading] = useState(enabled)
  const [error, setError] = useState<string | null>(null)

  const fetchItems = useCallback(async () => {
    if (!enabled) {
      setItems([])
      setIsLoading(false)
      return
    }
    setIsLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (opts?.all) params.set('all', 'true')
      const res = await fetch(`/api/tasks/marketing-moments-due${params.toString() ? `?${params}` : ''}`)
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error ?? 'Erro a carregar momentos')
      }
      const { data } = await res.json()
      setItems(data ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido')
    } finally {
      setIsLoading(false)
    }
  }, [enabled, opts?.all])

  useEffect(() => {
    fetchItems()
  }, [fetchItems])

  return { items, isLoading, error, refetch: fetchItems }
}
