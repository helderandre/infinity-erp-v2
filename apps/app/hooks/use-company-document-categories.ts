'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

export interface CompanyDocumentCategory {
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

// Fallback used if the API fails — matches the seeded system categories.
const FALLBACK_CATEGORIES: CompanyDocumentCategory[] = [
  { id: 'fallback-angariacao',    slug: 'angariacao',    label: 'Angariação',     icon: null, color: null, sort_order: 10, is_system: true, is_active: true },
  { id: 'fallback-institucional', slug: 'institucional', label: 'Institucionais', icon: null, color: null, sort_order: 20, is_system: true, is_active: true },
  { id: 'fallback-cliente',       slug: 'cliente',       label: 'Cliente',        icon: null, color: null, sort_order: 30, is_system: true, is_active: true },
  { id: 'fallback-contratos',     slug: 'contratos',     label: 'Contratos',      icon: null, color: null, sort_order: 40, is_system: true, is_active: true },
  { id: 'fallback-kyc',           slug: 'kyc',           label: 'KYC',            icon: null, color: null, sort_order: 50, is_system: true, is_active: true },
  { id: 'fallback-fiscal',        slug: 'fiscal',        label: 'Fiscal',         icon: null, color: null, sort_order: 60, is_system: true, is_active: true },
  { id: 'fallback-marketing',     slug: 'marketing',     label: 'Marketing',      icon: null, color: null, sort_order: 70, is_system: true, is_active: true },
  { id: 'fallback-formacao',      slug: 'formacao',      label: 'Formação',       icon: null, color: null, sort_order: 80, is_system: true, is_active: true },
  { id: 'fallback-outro',         slug: 'outro',         label: 'Outros',         icon: null, color: null, sort_order: 90, is_system: true, is_active: true },
]

export function useCompanyDocumentCategories() {
  const [categories, setCategories] = useState<CompanyDocumentCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const usedFallback = useRef(false)

  const refetch = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/company-documents/categories')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = (await res.json()) as CompanyDocumentCategory[]
      setCategories(Array.isArray(data) ? data : [])
      usedFallback.current = false
    } catch (err) {
      console.error('Erro ao carregar categorias:', err)
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
    async (payload: CreateCategoryPayload): Promise<CompanyDocumentCategory> => {
      const res = await fetch('/api/company-documents/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const body = await res.json()
      if (!res.ok) {
        throw new Error(body.error || 'Erro ao criar categoria')
      }
      await refetch()
      return body as CompanyDocumentCategory
    },
    [refetch]
  )

  const update = useCallback(
    async (
      id: string,
      payload: UpdateCategoryPayload
    ): Promise<CompanyDocumentCategory> => {
      const res = await fetch(`/api/company-documents/categories/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const body = await res.json()
      if (!res.ok) {
        throw new Error(body.error || 'Erro ao actualizar categoria')
      }
      await refetch()
      return body as CompanyDocumentCategory
    },
    [refetch]
  )

  const remove = useCallback(
    async (id: string, options: RemoveCategoryOptions = {}): Promise<{ reassigned: number }> => {
      const hasReassign = !!options.reassignTo
      const res = await fetch(`/api/company-documents/categories/${id}`, {
        method: 'DELETE',
        headers: hasReassign ? { 'Content-Type': 'application/json' } : undefined,
        body: hasReassign ? JSON.stringify({ reassign_to: options.reassignTo }) : undefined,
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        const err = new Error(body.error || 'Erro ao eliminar categoria') as Error & {
          status?: number
          documentCount?: number
        }
        err.status = res.status
        if (typeof body.document_count === 'number') {
          err.documentCount = body.document_count
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
