'use client'

import { useState, useEffect, useCallback } from 'react'
import type { MarketingOrder } from '@/types/marketing'

interface OrderFilters {
  status?: string
  agent_id?: string
}

export function useMarketingOrders() {
  const [orders, setOrders] = useState<MarketingOrder[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState<OrderFilters>({})

  const fetchOrders = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filters.status) params.set('status', filters.status)
      if (filters.agent_id) params.set('agent_id', filters.agent_id)

      const res = await fetch(`/api/marketing/orders?${params}`)
      const data = await res.json()
      setOrders(data.data || [])
      setTotal(data.total || 0)
    } catch {
      setOrders([])
    } finally {
      setLoading(false)
    }
  }, [filters])

  useEffect(() => { fetchOrders() }, [fetchOrders])

  const updateOrder = async (id: string, action: string, extra?: Record<string, unknown>) => {
    const res = await fetch(`/api/marketing/orders/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, ...extra }),
    })
    if (!res.ok) throw new Error((await res.json()).error)
    await fetchOrders()
    return res.json()
  }

  return { orders, total, loading, filters, setFilters, updateOrder, refetch: fetchOrders }
}
