'use client'

import { useState, useEffect, useCallback } from 'react'
import type { CustomEventDetail } from '@/types/custom-event'

export function useCustomEvent(id: string | null) {
  const [event, setEvent] = useState<CustomEventDetail | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetch = useCallback(async () => {
    if (!id) return
    setIsLoading(true)
    setError(null)
    try {
      const res = await window.fetch(`/api/automacao/custom-events/${id}`)
      if (!res.ok) throw new Error('Erro ao carregar evento')
      const data = await res.json()
      setEvent(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido')
    } finally {
      setIsLoading(false)
    }
  }, [id])

  useEffect(() => { fetch() }, [fetch])

  return { event, isLoading, error, refetch: fetch }
}
