'use client'

import { useState, useEffect, useCallback } from 'react'
import type { CreditRequestWithRelations, CreditMetrics, CreditRequestStatus } from '@/types/credit'

interface UseCreditRequestReturn {
  request: CreditRequestWithRelations | null
  metrics: CreditMetrics | null
  isLoading: boolean
  error: string | null
  refetch: () => void
  updateRequest: (data: Record<string, unknown>) => Promise<void>
  changeStatus: (status: CreditRequestStatus, extra?: Record<string, unknown>) => Promise<void>
}

export function useCreditRequest(id: string | null): UseCreditRequestReturn {
  const [request, setRequest] = useState<CreditRequestWithRelations | null>(null)
  const [metrics, setMetrics] = useState<CreditMetrics | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchRequest = useCallback(async () => {
    if (!id) return
    setIsLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/credit/${id}`)
      if (!res.ok) throw new Error('Erro ao carregar pedido de crédito')

      const json = await res.json()
      setRequest(json.data)
      setMetrics(json.metrics || null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido')
    } finally {
      setIsLoading(false)
    }
  }, [id])

  useEffect(() => {
    fetchRequest()
  }, [fetchRequest])

  const updateRequest = useCallback(async (data: Record<string, unknown>) => {
    if (!id) return
    const res = await fetch(`/api/credit/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (!res.ok) {
      const json = await res.json()
      throw new Error(json.error || 'Erro ao actualizar pedido')
    }
    await fetchRequest()
  }, [id, fetchRequest])

  const changeStatus = useCallback(async (status: CreditRequestStatus, extra?: Record<string, unknown>) => {
    if (!id) return
    const endpoint = getStatusEndpoint(status, id)
    if (endpoint) {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(extra || {}),
      })
      if (!res.ok) {
        const json = await res.json()
        throw new Error(json.error || 'Erro ao alterar estado')
      }
    } else {
      await updateRequest({ status, ...extra })
    }
    await fetchRequest()
  }, [id, fetchRequest, updateRequest])

  return { request, metrics, isLoading, error, refetch: fetchRequest, updateRequest, changeStatus }
}

function getStatusEndpoint(status: CreditRequestStatus, id: string): string | null {
  switch (status) {
    case 'submetido_bancos': return `/api/credit/${id}/submit-banks`
    case 'aprovado': return `/api/credit/${id}/approve`
    case 'recusado': return `/api/credit/${id}/refuse`
    case 'desistencia': return `/api/credit/${id}/cancel`
    default: return null
  }
}
