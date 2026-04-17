'use client'

import { useState, useEffect, useCallback } from 'react'
import { useDebounce } from '@/hooks/use-debounce'

export interface EligibleLead {
  id: string
  name: string | null
  email: string | null
  telemovel: string | null
  status: string | null
  source: string | null
  created_at: string
  is_associated: boolean
}

interface UseEligibleLeadsParams {
  search?: string
  status?: string
  eventId?: string | null
  page?: number
  limit?: number
}

export function useEligibleLeads({
  search = '',
  status,
  eventId,
  page = 1,
  limit = 50,
}: UseEligibleLeadsParams = {}) {
  const [leads, setLeads] = useState<EligibleLead[]>([])
  const [total, setTotal] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const debouncedSearch = useDebounce(search, 300)

  const fetch = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (debouncedSearch) params.set('search', debouncedSearch)
      if (status && status !== 'all') params.set('status', status)
      if (eventId) params.set('event_id', eventId)
      params.set('page', String(page))
      params.set('limit', String(limit))

      const res = await window.fetch(`/api/automacao/custom-events/eligible-leads?${params}`)
      if (!res.ok) throw new Error('Erro ao carregar contactos')
      const data = await res.json()
      setLeads(data.leads)
      setTotal(data.total)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido')
    } finally {
      setIsLoading(false)
    }
  }, [debouncedSearch, status, eventId, page, limit])

  useEffect(() => { fetch() }, [fetch])

  return { leads, total, isLoading, error, refetch: fetch }
}
