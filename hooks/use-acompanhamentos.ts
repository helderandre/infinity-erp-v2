'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { toast } from 'sonner'
import type { AcompanhamentoWithRelations, AcompanhamentoFilters } from '@/types/acompanhamento'

interface UseAcompanhamentosParams {
  filters?: AcompanhamentoFilters
  leadId?: string
  page?: number
  limit?: number
}

export function useAcompanhamentos({
  filters,
  leadId,
  page = 1,
  limit = 20,
}: UseAcompanhamentosParams = {}) {
  const [acompanhamentos, setAcompanhamentos] = useState<AcompanhamentoWithRelations[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(0)

  const abortRef = useRef<AbortController | null>(null)
  const filtersKey = JSON.stringify(filters || {})

  const fetchData = useCallback(async () => {
    if (abortRef.current) abortRef.current.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setIsLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) })
      const f = filters || {}
      if (f.status) params.set('status', f.status)
      if (f.consultant_id) params.set('consultant_id', f.consultant_id)
      if (f.search) params.set('search', f.search)
      if (leadId) params.set('lead_id', leadId)

      const res = await fetch(`/api/acompanhamentos?${params}`, { signal: controller.signal })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || `Erro ${res.status}`)
      }

      const json = await res.json()
      setAcompanhamentos(json.data || [])
      setTotal(json.total || 0)
      setTotalPages(json.totalPages || 0)
    } catch (err: any) {
      if (err?.name === 'AbortError') return
      setError(err?.message || 'Erro ao carregar acompanhamentos')
    } finally {
      if (!controller.signal.aborted) setIsLoading(false)
    }
  }, [page, limit, filtersKey, leadId])

  useEffect(() => {
    fetchData()
    return () => { abortRef.current?.abort() }
  }, [fetchData])

  const createAcompanhamento = useCallback(async (data: {
    negocio_id: string
    lead_id: string
    consultant_id: string
    notes?: string
    credit_intermediation?: boolean
    credit_entity?: string
    credit_notes?: string
    pre_approval_amount?: number
  }) => {
    try {
      const res = await fetch('/api/acompanhamentos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || 'Erro ao criar acompanhamento')
      }
      const json = await res.json()
      toast.success('Acompanhamento criado com sucesso')
      await fetchData()
      return json.data
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao criar acompanhamento')
      return null
    }
  }, [fetchData])

  const updateAcompanhamento = useCallback(async (id: string, data: any) => {
    try {
      const res = await fetch(`/api/acompanhamentos/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || 'Erro ao actualizar')
      }
      toast.success('Acompanhamento actualizado')
      await fetchData()
      return true
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao actualizar')
      return false
    }
  }, [fetchData])

  const deleteAcompanhamento = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/acompanhamentos/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || 'Erro ao eliminar')
      }
      toast.success('Acompanhamento eliminado')
      await fetchData()
      return true
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao eliminar')
      return false
    }
  }, [fetchData])

  return {
    acompanhamentos, isLoading, error, total, totalPages,
    refetch: fetchData, createAcompanhamento, updateAcompanhamento, deleteAcompanhamento,
  }
}
