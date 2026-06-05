'use client'

import { useState, useEffect, useCallback } from 'react'
import type { MarketingCatalogItem, MarketingCategory } from '@/types/marketing'

interface Filters {
  category?: MarketingCategory | ''
  active?: 'true' | 'false' | ''
  search?: string
}

export function useMarketingCatalog() {
  const [items, setItems] = useState<MarketingCatalogItem[]>([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState<Filters>({})

  const fetchItems = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filters.category) params.set('category', filters.category)
      if (filters.active) params.set('active', filters.active)
      if (filters.search) params.set('search', filters.search)

      const res = await fetch(`/api/marketing/catalog?${params}`)
      const data = await res.json()
      setItems(Array.isArray(data) ? data : [])
    } catch {
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [filters])

  useEffect(() => { fetchItems() }, [fetchItems])

  const createItem = async (data: Partial<MarketingCatalogItem>) => {
    const res = await fetch('/api/marketing/catalog', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (!res.ok) throw new Error((await res.json()).error)
    await fetchItems()
    return res.json()
  }

  const updateItem = async (id: string, data: Partial<MarketingCatalogItem>) => {
    const res = await fetch(`/api/marketing/catalog/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (!res.ok) throw new Error((await res.json()).error)
    await fetchItems()
    return res.json()
  }

  const deleteItem = async (id: string) => {
    const res = await fetch(`/api/marketing/catalog/${id}`, { method: 'DELETE' })
    if (!res.ok) throw new Error((await res.json()).error)
    await fetchItems()
  }

  return { items, loading, filters, setFilters, createItem, updateItem, deleteItem, refetch: fetchItems }
}
