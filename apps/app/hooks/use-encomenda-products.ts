'use client'

import { useState, useEffect, useCallback } from 'react'
import type { Product, ProductCategory } from '@/types/encomenda'

interface Filters {
  category_id?: string
  active?: 'true' | 'false' | ''
  search?: string
}

export function useEncomendaProducts() {
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<ProductCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState<Filters>({})

  const fetchProducts = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filters.category_id) params.set('category_id', filters.category_id)
      if (filters.active) params.set('active', filters.active)
      if (filters.search) params.set('search', filters.search)

      const res = await fetch(`/api/encomendas/products?${params}`)
      const data = await res.json()
      setProducts(Array.isArray(data) ? data : [])
    } catch {
      setProducts([])
    } finally {
      setLoading(false)
    }
  }, [filters])

  const fetchCategories = useCallback(async () => {
    try {
      const res = await fetch('/api/encomendas/categories')
      const data = await res.json()
      setCategories(Array.isArray(data) ? data : [])
    } catch {
      setCategories([])
    }
  }, [])

  useEffect(() => { fetchProducts() }, [fetchProducts])
  useEffect(() => { fetchCategories() }, [fetchCategories])

  const createProduct = async (data: Partial<Product>) => {
    const res = await fetch('/api/encomendas/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (!res.ok) throw new Error((await res.json()).error)
    await fetchProducts()
    return res.json()
  }

  const updateProduct = async (id: string, data: Partial<Product>) => {
    const res = await fetch(`/api/encomendas/products/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (!res.ok) throw new Error((await res.json()).error)
    await fetchProducts()
    return res.json()
  }

  const deleteProduct = async (id: string) => {
    const res = await fetch(`/api/encomendas/products/${id}`, { method: 'DELETE' })
    if (!res.ok) throw new Error((await res.json()).error)
    await fetchProducts()
  }

  const createCategory = async (data: Partial<ProductCategory>) => {
    const res = await fetch('/api/encomendas/categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (!res.ok) throw new Error((await res.json()).error)
    await fetchCategories()
    return res.json()
  }

  return {
    products, categories, loading, filters, setFilters,
    createProduct, updateProduct, deleteProduct, createCategory,
    refetch: fetchProducts, refetchCategories: fetchCategories,
  }
}
