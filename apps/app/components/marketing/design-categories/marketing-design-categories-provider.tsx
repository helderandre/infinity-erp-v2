'use client'

import { createContext, useContext, useMemo, type ReactNode } from 'react'

import { usePermissions } from '@/hooks/use-permissions'
import {
  useMarketingDesignCategories,
  type MarketingDesignCategory,
  type CreateCategoryPayload,
  type UpdateCategoryPayload,
  type RemoveCategoryOptions,
} from '@/hooks/use-marketing-design-categories'

interface MarketingDesignCategoriesContextValue {
  categories: MarketingDesignCategory[]
  activeCategories: MarketingDesignCategory[]
  loading: boolean
  error: Error | null
  canManage: boolean
  getLabel: (slug: string | null | undefined) => string
  getCategory: (slug: string | null | undefined) => MarketingDesignCategory | undefined
  getCategoryById: (id: string | null | undefined) => MarketingDesignCategory | undefined
  refetch: () => Promise<void>
  create: (payload: CreateCategoryPayload) => Promise<MarketingDesignCategory>
  update: (id: string, payload: UpdateCategoryPayload) => Promise<MarketingDesignCategory>
  remove: (id: string, options?: RemoveCategoryOptions) => Promise<{ reassigned: number }>
}

const MarketingDesignCategoriesContext =
  createContext<MarketingDesignCategoriesContextValue | null>(null)

export function MarketingDesignCategoriesProvider({ children }: { children: ReactNode }) {
  const { categories, loading, error, refetch, create, update, remove } =
    useMarketingDesignCategories()
  const { hasPermission } = usePermissions()

  const canManage = hasPermission('settings')

  const activeCategories = useMemo(
    () => categories.filter((c) => c.is_active),
    [categories]
  )

  const bySlug = useMemo(() => {
    const map = new Map<string, MarketingDesignCategory>()
    categories.forEach((c) => map.set(c.slug, c))
    return map
  }, [categories])

  const byId = useMemo(() => {
    const map = new Map<string, MarketingDesignCategory>()
    categories.forEach((c) => map.set(c.id, c))
    return map
  }, [categories])

  const getLabel = (slug: string | null | undefined) => {
    if (!slug) return 'Sem categoria'
    return bySlug.get(slug)?.label ?? slug
  }

  const getCategory = (slug: string | null | undefined) => {
    if (!slug) return undefined
    return bySlug.get(slug)
  }

  const getCategoryById = (id: string | null | undefined) => {
    if (!id) return undefined
    return byId.get(id)
  }

  const value: MarketingDesignCategoriesContextValue = {
    categories,
    activeCategories,
    loading,
    error,
    canManage,
    getLabel,
    getCategory,
    getCategoryById,
    refetch,
    create,
    update,
    remove,
  }

  return (
    <MarketingDesignCategoriesContext.Provider value={value}>
      {children}
    </MarketingDesignCategoriesContext.Provider>
  )
}

export function useMarketingDesignCategoriesContext() {
  const ctx = useContext(MarketingDesignCategoriesContext)
  if (!ctx) {
    throw new Error(
      'useMarketingDesignCategoriesContext must be used inside <MarketingDesignCategoriesProvider>'
    )
  }
  return ctx
}
