'use client'

import { useState, useEffect, useCallback } from 'react'
import type { Requisition } from '@/types/encomenda'

interface Filters {
  status?: string
  agent_id?: string
  priority?: string
}

export function useEncomendaRequisitions(myOnly = false) {
  const [requisitions, setRequisitions] = useState<Requisition[]>([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState<Filters>({})

  const fetchRequisitions = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filters.status) params.set('status', filters.status)
      if (filters.agent_id) params.set('agent_id', filters.agent_id)
      if (filters.priority) params.set('priority', filters.priority)

      const endpoint = myOnly ? '/api/encomendas/my-requisitions' : '/api/encomendas/requisitions'
      const res = await fetch(`${endpoint}?${params}`)
      const data = await res.json()
      setRequisitions(Array.isArray(data) ? data : [])
    } catch {
      setRequisitions([])
    } finally {
      setLoading(false)
    }
  }, [filters, myOnly])

  useEffect(() => { fetchRequisitions() }, [fetchRequisitions])

  const createRequisition = async (data: Record<string, unknown>) => {
    const res = await fetch('/api/encomendas/requisitions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (!res.ok) throw new Error((await res.json()).error)
    await fetchRequisitions()
    return res.json()
  }

  const performAction = async (id: string, action: string, extra?: Record<string, unknown>) => {
    const res = await fetch(`/api/encomendas/requisitions/${id}/${action}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(extra || {}),
    })
    if (!res.ok) throw new Error((await res.json()).error)
    await fetchRequisitions()
    return res.json()
  }

  return {
    requisitions, loading, filters, setFilters,
    createRequisition, performAction,
    refetch: fetchRequisitions,
  }
}
