'use client'

import { useState, useEffect, useCallback } from 'react'
import type { ConsultantDetail } from '@/types/consultant'

interface UseConsultantReturn {
  consultant: ConsultantDetail | null
  isLoading: boolean
  error: string | null
  refetch: () => void
}

export function useConsultant(id: string): UseConsultantReturn {
  const [consultant, setConsultant] = useState<ConsultantDetail | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchConsultant = useCallback(async () => {
    if (!id) return
    setIsLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/consultants/${id}`)
      if (!res.ok) {
        if (res.status === 404) throw new Error('Consultor não encontrado')
        throw new Error('Erro ao carregar consultor')
      }
      const data = await res.json()
      setConsultant(data)
    } catch (err) {
      console.error('Erro ao carregar consultor:', err)
      setError(err instanceof Error ? err.message : 'Erro desconhecido')
      setConsultant(null)
    } finally {
      setIsLoading(false)
    }
  }, [id])

  useEffect(() => {
    fetchConsultant()
  }, [fetchConsultant])

  return { consultant, isLoading, error, refetch: fetchConsultant }
}
