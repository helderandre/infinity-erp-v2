'use client'

import { useCallback, useEffect, useState } from 'react'

export interface AgendaItem {
  id: string
  source: 'visit' | 'calendar'
  source_id: string
  title: string
  start_at: string
  duration_minutes: number | null
  status: string | null
  category: string | null
  notes: string | null
  property: { id: string; title: string | null; slug: string | null } | null
  href: string
}

interface UseNegocioAgendaResult {
  items: AgendaItem[]
  upcoming: AgendaItem[]
  past: AgendaItem[]
  isLoading: boolean
  error: string | null
  refetch: () => Promise<void>
}

export function useNegocioAgenda(negocioId: string | null | undefined): UseNegocioAgendaResult {
  const [items, setItems] = useState<AgendaItem[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(async () => {
    if (!negocioId) return
    setIsLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/negocios/${negocioId}/agenda`)
      if (!res.ok) throw new Error('Erro ao carregar agenda')
      const json = await res.json()
      setItems(json.data || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro')
    } finally {
      setIsLoading(false)
    }
  }, [negocioId])

  useEffect(() => {
    void refetch()
  }, [refetch])

  // upcoming: futuro (incluindo hoje); past: passado
  const now = Date.now()
  const upcoming = items.filter((i) => new Date(i.start_at).getTime() >= now)
  const past = items.filter((i) => new Date(i.start_at).getTime() < now)

  return { items, upcoming, past, isLoading, error, refetch }
}
