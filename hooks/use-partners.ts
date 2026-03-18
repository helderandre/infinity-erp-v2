'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { toast } from 'sonner'
import type { Partner, PartnerFilters } from '@/types/partner'
import type { CreatePartnerInput } from '@/lib/validations/partner'

interface UsePartnersParams {
  filters?: PartnerFilters
  page?: number
  limit?: number
}

interface UsePartnersReturn {
  partners: Partner[]
  isLoading: boolean
  error: string | null
  total: number
  totalPages: number
  canSeePrivate: boolean
  refetch: () => void
  createPartner: (data: CreatePartnerInput) => Promise<Partner | null>
  updatePartner: (id: string, data: any) => Promise<boolean>
  deletePartner: (id: string) => Promise<boolean>
  ratePartner: (id: string, rating: number, comment?: string) => Promise<boolean>
}

export function usePartners({
  filters,
  page = 1,
  limit = 50,
}: UsePartnersParams = {}): UsePartnersReturn {
  const [partners, setPartners] = useState<Partner[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [canSeePrivate, setCanSeePrivate] = useState(false)

  const abortRef = useRef<AbortController | null>(null)
  const filtersKey = JSON.stringify(filters || {})

  const fetchPartners = useCallback(async () => {
    if (abortRef.current) abortRef.current.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setIsLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) })
      const f = filters || {}
      if (f.category) params.set('category', f.category)
      if (f.visibility) params.set('visibility', f.visibility)
      if (f.is_active !== undefined) params.set('is_active', String(f.is_active))
      if (f.is_recommended) params.set('is_recommended', 'true')
      if (f.search) params.set('search', f.search)

      const res = await fetch(`/api/partners?${params}`, { signal: controller.signal })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || `Erro ${res.status}`)
      }

      const json = await res.json()
      setPartners(json.data || [])
      setTotal(json.total || 0)
      setTotalPages(json.totalPages || 0)
      setCanSeePrivate(json.canSeePrivate || false)
    } catch (err: any) {
      if (err?.name === 'AbortError') return
      setError(err?.message || 'Erro ao carregar parceiros')
    } finally {
      if (!controller.signal.aborted) setIsLoading(false)
    }
  }, [page, limit, filtersKey])

  useEffect(() => {
    fetchPartners()
    return () => { abortRef.current?.abort() }
  }, [fetchPartners])

  const createPartner = useCallback(async (data: CreatePartnerInput): Promise<Partner | null> => {
    try {
      const res = await fetch('/api/partners', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || 'Erro ao criar parceiro')
      }
      const json = await res.json()
      toast.success('Parceiro criado com sucesso')
      await fetchPartners()
      return json.data
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao criar parceiro')
      return null
    }
  }, [fetchPartners])

  const updatePartner = useCallback(async (id: string, data: any): Promise<boolean> => {
    try {
      const res = await fetch(`/api/partners/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || 'Erro ao actualizar parceiro')
      }
      toast.success('Parceiro actualizado com sucesso')
      await fetchPartners()
      return true
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao actualizar parceiro')
      return false
    }
  }, [fetchPartners])

  const deletePartner = useCallback(async (id: string): Promise<boolean> => {
    try {
      const res = await fetch(`/api/partners/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || 'Erro ao eliminar parceiro')
      }
      toast.success('Parceiro eliminado com sucesso')
      await fetchPartners()
      return true
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao eliminar parceiro')
      return false
    }
  }, [fetchPartners])

  const ratePartner = useCallback(async (id: string, rating: number, comment?: string): Promise<boolean> => {
    try {
      const res = await fetch(`/api/partners/${id}/rate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating, comment }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || 'Erro ao avaliar parceiro')
      }
      toast.success('Avaliação registada')
      await fetchPartners()
      return true
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao avaliar parceiro')
      return false
    }
  }, [fetchPartners])

  return {
    partners, isLoading, error, total, totalPages, canSeePrivate,
    refetch: fetchPartners, createPartner, updatePartner, deletePartner, ratePartner,
  }
}
