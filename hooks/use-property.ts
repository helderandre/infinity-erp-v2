'use client'

import { useState, useEffect, useCallback } from 'react'
import type { PropertyDetail } from '@/types/property'

interface UsePropertyReturn {
  property: PropertyDetail | null
  isLoading: boolean
  error: string | null
  refetch: () => void
}

export function useProperty(id: string | undefined): UsePropertyReturn {
  const [property, setProperty] = useState<PropertyDetail | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchProperty = useCallback(async () => {
    if (!id) {
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/properties/${id}`)
      if (!res.ok) {
        if (res.status === 404) throw new Error('Imóvel não encontrado')
        throw new Error('Erro ao carregar imóvel')
      }

      const data = await res.json()
      setProperty(data)
    } catch (err) {
      console.error('Erro ao carregar imóvel:', err)
      setError(err instanceof Error ? err.message : 'Erro desconhecido')
      setProperty(null)
    } finally {
      setIsLoading(false)
    }
  }, [id])

  useEffect(() => {
    fetchProperty()
  }, [fetchProperty])

  return { property, isLoading, error, refetch: fetchProperty }
}
