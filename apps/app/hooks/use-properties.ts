'use client'

import { useState, useEffect, useCallback } from 'react'
import { useDebounce } from '@/hooks/use-debounce'
import type { PropertyWithRelations } from '@/types/property'

interface UsePropertiesParams {
  search?: string
  status?: string
  propertyType?: string
  businessType?: string
  city?: string
  consultantId?: string
  priceMin?: number
  priceMax?: number
  page?: number
  perPage?: number
}

interface UsePropertiesReturn {
  properties: PropertyWithRelations[]
  total: number
  isLoading: boolean
  error: string | null
  refetch: () => void
}

export function useProperties({
  search = '',
  status,
  propertyType,
  businessType,
  city,
  consultantId,
  priceMin,
  priceMax,
  page = 1,
  perPage = 20,
}: UsePropertiesParams = {}): UsePropertiesReturn {
  const [properties, setProperties] = useState<PropertyWithRelations[]>([])
  const [total, setTotal] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const debouncedSearch = useDebounce(search, 300)

  const fetchProperties = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (debouncedSearch) params.set('search', debouncedSearch)
      if (status && status !== 'all') params.set('status', status)
      if (propertyType && propertyType !== 'all') params.set('property_type', propertyType)
      if (businessType && businessType !== 'all') params.set('business_type', businessType)
      if (city) params.set('city', city)
      if (consultantId && consultantId !== 'all') params.set('consultant_id', consultantId)
      if (priceMin) params.set('price_min', String(priceMin))
      if (priceMax) params.set('price_max', String(priceMax))
      params.set('page', String(page))
      params.set('per_page', String(perPage))

      const res = await fetch(`/api/properties?${params.toString()}`)
      if (!res.ok) throw new Error('Erro ao carregar imóveis')

      const data = await res.json()
      setProperties(data.data || [])
      setTotal(data.total || 0)
    } catch (err) {
      console.error('Erro ao carregar imóveis:', err)
      setError(err instanceof Error ? err.message : 'Erro desconhecido')
      setProperties([])
      setTotal(0)
    } finally {
      setIsLoading(false)
    }
  }, [debouncedSearch, status, propertyType, businessType, city, consultantId, priceMin, priceMax, page, perPage])

  useEffect(() => {
    fetchProperties()
  }, [fetchProperties])

  return { properties, total, isLoading, error, refetch: fetchProperties }
}
