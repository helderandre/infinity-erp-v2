'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { toast } from 'sonner'
import type { VisitWithRelations, VisitFilters } from '@/types/visit'
import type { CreateVisitInput } from '@/lib/validations/visit'

interface UseVisitsParams {
  filters?: VisitFilters
  page?: number
  limit?: number
  upcoming?: boolean
}

interface UseVisitsReturn {
  visits: VisitWithRelations[]
  isLoading: boolean
  error: string | null
  total: number
  totalPages: number
  page: number
  refetch: () => void
  createVisit: (data: CreateVisitInput) => Promise<VisitWithRelations | null>
  updateVisit: (id: string, data: any) => Promise<boolean>
  deleteVisit: (id: string) => Promise<boolean>
  cancelVisit: (id: string, reason: string) => Promise<boolean>
  submitFeedback: (id: string, feedback: any) => Promise<boolean>
}

export function useVisits({
  filters,
  page = 1,
  limit = 20,
  upcoming = false,
}: UseVisitsParams = {}): UseVisitsReturn {
  const [visits, setVisits] = useState<VisitWithRelations[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(0)

  const abortControllerRef = useRef<AbortController | null>(null)

  const filtersKey = JSON.stringify(filters || {})

  const fetchVisits = useCallback(async () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }

    const controller = new AbortController()
    abortControllerRef.current = controller

    setIsLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
      })

      if (upcoming) params.set('upcoming', 'true')

      const f = filters || {}
      if (f.status) params.set('status', f.status)
      if (f.consultant_id) params.set('consultant_id', f.consultant_id)
      if (f.property_id) params.set('property_id', f.property_id)
      if (f.lead_id) params.set('lead_id', f.lead_id)
      if (f.date_from) params.set('date_from', f.date_from)
      if (f.date_to) params.set('date_to', f.date_to)
      if (f.search) params.set('search', f.search)

      const res = await fetch(`/api/visits?${params.toString()}`, {
        signal: controller.signal,
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || `Erro ${res.status}`)
      }

      const json = await res.json()
      setVisits(json.data || [])
      setTotal(json.total || 0)
      setTotalPages(json.totalPages || 0)
    } catch (err: any) {
      if (err?.name === 'AbortError') return
      const message = err?.message || 'Erro ao carregar visitas'
      setError(message)
      console.error('useVisits fetch error:', err)
    } finally {
      if (!controller.signal.aborted) {
        setIsLoading(false)
      }
    }
  }, [page, limit, upcoming, filtersKey])

  useEffect(() => {
    fetchVisits()
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [fetchVisits])

  const createVisit = useCallback(async (data: CreateVisitInput): Promise<VisitWithRelations | null> => {
    try {
      const res = await fetch('/api/visits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || 'Erro ao criar visita')
      }

      const json = await res.json()
      toast.success('Visita agendada com sucesso')
      await fetchVisits()
      return json.data
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao criar visita')
      return null
    }
  }, [fetchVisits])

  const updateVisit = useCallback(async (id: string, data: any): Promise<boolean> => {
    try {
      const res = await fetch(`/api/visits/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || 'Erro ao actualizar visita')
      }

      toast.success('Visita actualizada com sucesso')
      await fetchVisits()
      return true
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao actualizar visita')
      return false
    }
  }, [fetchVisits])

  const deleteVisit = useCallback(async (id: string): Promise<boolean> => {
    try {
      const res = await fetch(`/api/visits/${id}`, { method: 'DELETE' })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || 'Erro ao eliminar visita')
      }

      toast.success('Visita eliminada com sucesso')
      await fetchVisits()
      return true
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao eliminar visita')
      return false
    }
  }, [fetchVisits])

  const cancelVisit = useCallback(async (id: string, reason: string): Promise<boolean> => {
    try {
      const res = await fetch(`/api/visits/${id}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cancelled_reason: reason }),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || 'Erro ao cancelar visita')
      }

      toast.success('Visita cancelada')
      await fetchVisits()
      return true
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao cancelar visita')
      return false
    }
  }, [fetchVisits])

  const submitFeedback = useCallback(async (id: string, feedback: any): Promise<boolean> => {
    try {
      const res = await fetch(`/api/visits/${id}/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(feedback),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || 'Erro ao submeter feedback')
      }

      toast.success('Feedback registado com sucesso')
      await fetchVisits()
      return true
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao submeter feedback')
      return false
    }
  }, [fetchVisits])

  return {
    visits,
    isLoading,
    error,
    total,
    totalPages,
    page,
    refetch: fetchVisits,
    createVisit,
    updateVisit,
    deleteVisit,
    cancelVisit,
    submitFeedback,
  }
}
