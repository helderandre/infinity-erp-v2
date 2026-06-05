'use client'

import { createContext, useContext, useMemo, type ReactNode } from 'react'

import { usePermissions } from '@/hooks/use-permissions'
import {
  useCompanyDocumentCategories,
  type CompanyDocumentCategory,
  type CreateCategoryPayload,
  type UpdateCategoryPayload,
  type RemoveCategoryOptions,
} from '@/hooks/use-company-document-categories'

interface CompanyCategoriesContextValue {
  categories: CompanyDocumentCategory[]
  activeCategories: CompanyDocumentCategory[]
  loading: boolean
  error: Error | null
  canManage: boolean
  getLabel: (slug: string | null | undefined) => string
  getCategory: (slug: string | null | undefined) => CompanyDocumentCategory | undefined
  refetch: () => Promise<void>
  create: (payload: CreateCategoryPayload) => Promise<CompanyDocumentCategory>
  update: (id: string, payload: UpdateCategoryPayload) => Promise<CompanyDocumentCategory>
  remove: (id: string, options?: RemoveCategoryOptions) => Promise<{ reassigned: number }>
}

const CompanyCategoriesContext = createContext<CompanyCategoriesContextValue | null>(null)

export function CompanyCategoriesProvider({ children }: { children: ReactNode }) {
  const { categories, loading, error, refetch, create, update, remove } =
    useCompanyDocumentCategories()
  const { hasPermission } = usePermissions()

  const canManage = hasPermission('settings')

  const activeCategories = useMemo(
    () => categories.filter((c) => c.is_active),
    [categories]
  )

  const byslug = useMemo(() => {
    const map = new Map<string, CompanyDocumentCategory>()
    categories.forEach((c) => map.set(c.slug, c))
    return map
  }, [categories])

  const getLabel = (slug: string | null | undefined) => {
    if (!slug) return 'Sem categoria'
    return byslug.get(slug)?.label ?? slug
  }

  const getCategory = (slug: string | null | undefined) => {
    if (!slug) return undefined
    return byslug.get(slug)
  }

  const value: CompanyCategoriesContextValue = {
    categories,
    activeCategories,
    loading,
    error,
    canManage,
    getLabel,
    getCategory,
    refetch,
    create,
    update,
    remove,
  }

  return (
    <CompanyCategoriesContext.Provider value={value}>
      {children}
    </CompanyCategoriesContext.Provider>
  )
}

export function useCompanyCategories() {
  const ctx = useContext(CompanyCategoriesContext)
  if (!ctx) {
    throw new Error(
      'useCompanyCategories must be used inside <CompanyCategoriesProvider>'
    )
  }
  return ctx
}
