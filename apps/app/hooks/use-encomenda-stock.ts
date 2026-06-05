'use client'

import { useState, useEffect, useCallback } from 'react'
import type { StockRecord, StockMovement } from '@/types/encomenda'

export function useEncomendaStock() {
  const [stock, setStock] = useState<StockRecord[]>([])
  const [movements, setMovements] = useState<StockMovement[]>([])
  const [loading, setLoading] = useState(true)
  const [alertsOnly, setAlertsOnly] = useState(false)

  const fetchStock = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (alertsOnly) params.set('alerts_only', 'true')

      const res = await fetch(`/api/encomendas/stock?${params}`)
      const data = await res.json()
      setStock(Array.isArray(data) ? data : [])
    } catch {
      setStock([])
    } finally {
      setLoading(false)
    }
  }, [alertsOnly])

  const fetchMovements = useCallback(async (stockId?: string) => {
    try {
      const params = new URLSearchParams()
      if (stockId) params.set('stock_id', stockId)

      const res = await fetch(`/api/encomendas/stock/movements?${params}`)
      const data = await res.json()
      setMovements(Array.isArray(data) ? data : [])
    } catch {
      setMovements([])
    }
  }, [])

  useEffect(() => { fetchStock() }, [fetchStock])

  const adjustStock = async (stockId: string, quantity: number, reason: string) => {
    const res = await fetch(`/api/encomendas/stock/${stockId}/adjust`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ quantity, reason }),
    })
    if (!res.ok) throw new Error((await res.json()).error)
    await fetchStock()
    return res.json()
  }

  return {
    stock, movements, loading, alertsOnly, setAlertsOnly,
    adjustStock, fetchMovements,
    refetch: fetchStock,
  }
}
