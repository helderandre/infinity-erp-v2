'use client'

import { useState, useEffect, useCallback } from 'react'
import type { Return } from '@/types/encomenda'

export function useEncomendaReturns() {
  const [returns, setReturns] = useState<Return[]>([])
  const [loading, setLoading] = useState(true)

  const fetchReturns = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/encomendas/returns')
      const data = await res.json()
      setReturns(Array.isArray(data) ? data : [])
    } catch {
      setReturns([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchReturns() }, [fetchReturns])

  const createReturn = async (data: Record<string, unknown>) => {
    const res = await fetch('/api/encomendas/returns', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (!res.ok) throw new Error((await res.json()).error)
    await fetchReturns()
    return res.json()
  }

  const processReturn = async (id: string) => {
    const res = await fetch(`/api/encomendas/returns/${id}/process`, {
      method: 'POST',
    })
    if (!res.ok) throw new Error((await res.json()).error)
    await fetchReturns()
    return res.json()
  }

  return {
    returns, loading,
    createReturn, processReturn,
    refetch: fetchReturns,
  }
}
