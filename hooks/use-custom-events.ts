'use client'

import { useState, useEffect, useCallback } from 'react'
import type { CustomEventWithCounts } from '@/types/custom-event'

interface UseCustomEventsParams {
  status?: string
  /**
   * Só tem efeito para roles broker/admin. O endpoint valida a role
   * e devolve 403 se um consultor normal passar um id diferente do seu.
   */
  consultantId?: string
}

export function useCustomEvents({ status, consultantId }: UseCustomEventsParams = {}) {
  const [events, setEvents] = useState<CustomEventWithCounts[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetch = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (status && status !== 'all') params.set('status', status)
      if (consultantId) params.set('consultant_id', consultantId)
      const res = await window.fetch(`/api/automacao/custom-events?${params}`)
      if (!res.ok) throw new Error('Erro ao carregar eventos')
      const data = await res.json()
      setEvents(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido')
    } finally {
      setIsLoading(false)
    }
  }, [status, consultantId])

  useEffect(() => { fetch() }, [fetch])

  return { events, isLoading, error, refetch: fetch }
}
