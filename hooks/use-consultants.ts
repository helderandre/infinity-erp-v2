'use client'

import { useState, useEffect, useCallback } from 'react'
import { useDebounce } from '@/hooks/use-debounce'
import type { ConsultantWithProfile } from '@/types/consultant'

interface UseConsultantsParams {
  search?: string
  role?: string
  status?: string
  page?: number
  perPage?: number
}

interface UseConsultantsReturn {
  consultants: ConsultantWithProfile[]
  total: number
  isLoading: boolean
  error: string | null
  refetch: () => void
}

export function useConsultants({
  search = '',
  role,
  status = 'all',
  page = 1,
  perPage = 50,
}: UseConsultantsParams = {}): UseConsultantsReturn {
  const [consultants, setConsultants] = useState<ConsultantWithProfile[]>([])
  const [total, setTotal] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const debouncedSearch = useDebounce(search, 300)

  const fetchConsultants = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (debouncedSearch) params.set('search', debouncedSearch)
      if (role && role !== 'all') params.set('role', role)
      if (status && status !== 'all') params.set('status', status)
      params.set('page', String(page))
      params.set('per_page', String(perPage))

      const res = await fetch(`/api/consultants?${params.toString()}`)
      if (!res.ok) throw new Error('Erro ao carregar consultores')

      const data = await res.json()
      setConsultants(data.data || [])
      setTotal(data.total || 0)
    } catch (err) {
      console.error('Erro ao carregar consultores:', err)
      setError(err instanceof Error ? err.message : 'Erro desconhecido')
      setConsultants([])
      setTotal(0)
    } finally {
      setIsLoading(false)
    }
  }, [debouncedSearch, role, status, page, perPage])

  useEffect(() => {
    fetchConsultants()
  }, [fetchConsultants])

  return { consultants, total, isLoading, error, refetch: fetchConsultants }
}
