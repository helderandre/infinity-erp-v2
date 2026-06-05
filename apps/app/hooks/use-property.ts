'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import type { PropertyDetail } from '@/types/property'

interface UsePropertyReturn {
  property: PropertyDetail | null
  isLoading: boolean
  isRefreshing: boolean
  error: string | null
  refetch: () => Promise<void>
}

export function useProperty(id: string | undefined): UsePropertyReturn {
  const [property, setProperty] = useState<PropertyDetail | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const hasLoadedOnceRef = useRef(false)

  const fetchProperty = useCallback(async () => {
    if (!id) {
      setIsLoading(false)
      return
    }

    // Only show full loading state on the very first load.
    // Subsequent refetches update the data silently (no skeleton).
    if (!hasLoadedOnceRef.current) {
      setIsLoading(true)
    } else {
      setIsRefreshing(true)
    }
    setError(null)
    try {
      const res = await fetch(`/api/properties/${id}`)
      if (!res.ok) {
        if (res.status === 404) throw new Error('Imóvel não encontrado')
        throw new Error('Erro ao carregar imóvel')
      }

      const data = await res.json()
      setProperty(data)
      hasLoadedOnceRef.current = true
    } catch (err) {
      console.error('Erro ao carregar imóvel:', err)
      setError(err instanceof Error ? err.message : 'Erro desconhecido')
      // Don't wipe property on refetch errors — keep stale data visible
      if (!hasLoadedOnceRef.current) {
        setProperty(null)
      }
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }, [id])

  useEffect(() => {
    fetchProperty()
  }, [fetchProperty])

  return { property, isLoading, isRefreshing, error, refetch: fetchProperty }
}
