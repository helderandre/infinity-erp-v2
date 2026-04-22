'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

export interface MarketingDesignCategory {
  id: string
  slug: string
  label: string
  icon: string | null
  color: string | null
  sort_order: number
  is_system: boolean
  is_active: boolean
}

export interface CreateCategoryPayload {
  label: string
  icon?: string | null
  color?: string | null
  sort_order?: number
}

export interface UpdateCategoryPayload {
  label?: string
  icon?: string | null
  color?: string | null
  sort_order?: number
  is_active?: boolean
}

export interface RemoveCategoryOptions {
  reassignTo?: string
}

// Fallback matching the seeded system categories — used only if the API is
// unreachable so the UI keeps something to render.
const FALLBACK_CATEGORIES: MarketingDesignCategory[] = [
  { id: 'fallback-placas',        slug: 'placas',        label: 'Placas',             icon: null, color: null, sort_order: 10, is_system: true, is_active: true },
  { id: 'fallback-cartoes',       slug: 'cartoes',       label: 'Cartões',            icon: null, color: null, sort_order: 20, is_system: true, is_active: true },
  { id: 'fallback-badges',        slug: 'badges',        label: 'Badges',             icon: null, color: null, sort_order: 30, is_system: true, is_active: true },
  { id: 'fallback-assinaturas',   slug: 'assinaturas',   label: 'Assinaturas',        icon: null, color: null, sort_order: 40, is_system: true, is_active: true },
  { id: 'fallback-relatorios',    slug: 'relatorios',    label: 'Relatórios',         icon: null, color: null, sort_order: 50, is_system: true, is_active: true },
  { id: 'fallback-estudos',       slug: 'estudos',       label: 'Estudos de Mercado', icon: null, color: null, sort_order: 60, is_system: true, is_active: true },
  { id: 'fallback-redes_sociais', slug: 'redes_sociais', label: 'Redes Sociais',      icon: null, color: null, sort_order: 70, is_system: true, is_active: true },
  { id: 'fallback-outro',         slug: 'outro',         label: 'Outros',             icon: null, color: null, sort_order: 80, is_system: true, is_active: true },
]

export function useMarketingDesignCategories() {
  const [categories, setCategories] = useState<MarketingDesignCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const usedFallback = useRef(false)

  const refetch = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/marketing/design-categories')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = (await res.json()) as MarketingDesignCategory[]
      setCategories(Array.isArray(data) ? data : [])
      usedFallback.current = false
    } catch (err) {
      console.error('Erro ao carregar categorias de design:', err)
      setError(err instanceof Error ? err : new Error('Erro desconhecido'))
      if (!usedFallback.current) {
        setCategories(FALLBACK_CATEGORIES)
        usedFallback.current = true
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refetch()
  }, [refetch])

  const create = useCallback(
    async (payload: CreateCategoryPayload): Promise<MarketingDesignCategory> => {
      const res = await fetch('/api/marketing/design-categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const body = await res.json()
      if (!res.ok) {
        throw new Error(body.error || 'Erro ao criar categoria')
      }
      await refetch()
      return body as MarketingDesignCategory
    },
    [refetch]
  )

  const update = useCallback(
    async (id: string, payload: UpdateCategoryPayload): Promise<MarketingDesignCategory> => {
      const res = await fetch(`/api/marketing/design-categories/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const body = await res.json()
      if (!res.ok) {
        throw new Error(body.error || 'Erro ao actualizar categoria')
      }
      await refetch()
      return body as MarketingDesignCategory
    },
    [refetch]
  )

  const remove = useCallback(
    async (
      id: string,
      options: RemoveCategoryOptions = {}
    ): Promise<{ reassigned: number }> => {
      const hasReassign = !!options.reassignTo
      const res = await fetch(`/api/marketing/design-categories/${id}`, {
        method: 'DELETE',
        headers: hasReassign ? { 'Content-Type': 'application/json' } : undefined,
        body: hasReassign ? JSON.stringify({ reassign_to: options.reassignTo }) : undefined,
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        const err = new Error(body.error || 'Erro ao eliminar categoria') as Error & {
          status?: number
          designCount?: number
        }
        err.status = res.status
        if (typeof body.design_count === 'number') {
          err.designCount = body.design_count
        }
        throw err
      }
      await refetch()
      return { reassigned: body.reassigned ?? 0 }
    },
    [refetch]
  )

  return {
    categories,
    loading,
    error,
    refetch,
    create,
    update,
    remove,
  }
}
