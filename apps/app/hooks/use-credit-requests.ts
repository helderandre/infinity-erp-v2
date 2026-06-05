'use client'

import { useState, useEffect, useCallback } from 'react'
import { useDebounce } from '@/hooks/use-debounce'
import type { CreditRequestListItem } from '@/types/credit'

interface UseCreditRequestsParams {
  search?: string
  status?: string
  assignedTo?: string
  leadId?: string
  page?: number
  perPage?: number
}

interface UseCreditRequestsReturn {
  requests: CreditRequestListItem[]
  total: number
  isLoading: boolean
  error: string | null
  refetch: () => void
}

export function useCreditRequests({
  search = '',
  status,
  assignedTo,
  leadId,
  page = 1,
  perPage = 20,
}: UseCreditRequestsParams = {}): UseCreditRequestsReturn {
  const [requests, setRequests] = useState<CreditRequestListItem[]>([])
  const [total, setTotal] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const debouncedSearch = useDebounce(search, 300)

  const fetchRequests = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (debouncedSearch) params.set('search', debouncedSearch)
      if (status && status !== 'all') params.set('status', status)
      if (assignedTo && assignedTo !== 'all') params.set('assigned_to', assignedTo)
      if (leadId) params.set('lead_id', leadId)
      params.set('page', String(page))
      params.set('per_page', String(perPage))

      const res = await fetch(`/api/credit?${params.toString()}`)
      if (!res.ok) throw new Error('Erro ao carregar pedidos de crédito')

      const json = await res.json()
      setRequests(json.data || [])
      setTotal(json.total || 0)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido')
    } finally {
      setIsLoading(false)
    }
  }, [debouncedSearch, status, assignedTo, leadId, page, perPage])

  useEffect(() => {
    fetchRequests()
  }, [fetchRequests])

  return { requests, total, isLoading, error, refetch: fetchRequests }
}
