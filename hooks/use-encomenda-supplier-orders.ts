'use client'

import { useState, useEffect, useCallback } from 'react'
import type { SupplierOrder } from '@/types/encomenda'

interface Filters {
  status?: string
  supplier_id?: string
}

export function useEncomendaSupplierOrders() {
  const [orders, setOrders] = useState<SupplierOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState<Filters>({})

  const fetchOrders = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filters.status) params.set('status', filters.status)
      if (filters.supplier_id) params.set('supplier_id', filters.supplier_id)

      const res = await fetch(`/api/encomendas/supplier-orders?${params}`)
      const data = await res.json()
      setOrders(Array.isArray(data) ? data : [])
    } catch {
      setOrders([])
    } finally {
      setLoading(false)
    }
  }, [filters])

  useEffect(() => { fetchOrders() }, [fetchOrders])

  const createOrder = async (data: Record<string, unknown>) => {
    const res = await fetch('/api/encomendas/supplier-orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (!res.ok) throw new Error((await res.json()).error)
    await fetchOrders()
    return res.json()
  }

  const updateStatus = async (id: string, status: string) => {
    const res = await fetch(`/api/encomendas/supplier-orders/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    if (!res.ok) throw new Error((await res.json()).error)
    await fetchOrders()
    return res.json()
  }

  const receiveOrder = async (id: string, items: { item_id: string; quantity_received: number }[]) => {
    const res = await fetch(`/api/encomendas/supplier-orders/${id}/receive`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items }),
    })
    if (!res.ok) throw new Error((await res.json()).error)
    await fetchOrders()
    return res.json()
  }

  return {
    orders, loading, filters, setFilters,
    createOrder, updateStatus, receiveOrder,
    refetch: fetchOrders,
  }
}
