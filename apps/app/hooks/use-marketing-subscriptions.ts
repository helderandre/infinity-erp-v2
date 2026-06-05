'use client'

import { useState, useEffect, useCallback } from 'react'

interface Subscription {
  id: string
  agent_id: string
  order_item_id: string | null
  catalog_item_id: string
  status: string
  billing_cycle: string
  price_per_cycle: number
  current_period_start: string
  current_period_end: string
  next_billing_date: string | null
  cancel_at_period_end: boolean
  cancelled_at: string | null
  created_at: string
  updated_at: string
  catalog_item?: any
}

export function useMarketingSubscriptions() {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([])
  const [loading, setLoading] = useState(true)

  const fetchSubscriptions = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/marketing/subscriptions')
      if (!res.ok) throw new Error('Erro ao carregar subscrições')
      const json = await res.json()
      setSubscriptions(json.data || [])
    } catch (error) {
      console.error('Erro ao carregar subscrições:', error)
      setSubscriptions([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchSubscriptions()
  }, [fetchSubscriptions])

  const cancelSubscription = useCallback(async (id: string, immediate = false) => {
    const res = await fetch(`/api/marketing/subscriptions/${id}/cancel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ immediate }),
    })
    if (!res.ok) {
      const json = await res.json()
      throw new Error(json.error || 'Erro ao cancelar subscrição')
    }
    const updated = await res.json()
    setSubscriptions(prev =>
      prev.map(s => (s.id === id ? { ...s, ...updated } : s))
    )
    return updated
  }, [])

  const reactivateSubscription = useCallback(async (id: string) => {
    const res = await fetch(`/api/marketing/subscriptions/${id}/reactivate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    })
    if (!res.ok) {
      const json = await res.json()
      throw new Error(json.error || 'Erro ao reactivar subscrição')
    }
    const updated = await res.json()
    setSubscriptions(prev =>
      prev.map(s => (s.id === id ? { ...s, ...updated } : s))
    )
    return updated
  }, [])

  return {
    subscriptions,
    loading,
    cancelSubscription,
    reactivateSubscription,
    refetch: fetchSubscriptions,
  }
}
