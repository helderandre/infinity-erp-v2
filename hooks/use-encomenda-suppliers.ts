'use client'

import { useState, useEffect, useCallback } from 'react'
import type { Supplier } from '@/types/encomenda'

interface Filters {
  search?: string
  active?: 'true' | 'false' | ''
}

export function useEncomendaSuppliers() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState<Filters>({})

  const fetchSuppliers = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filters.search) params.set('search', filters.search)
      if (filters.active) params.set('active', filters.active)

      const res = await fetch(`/api/encomendas/suppliers?${params}`)
      const data = await res.json()
      setSuppliers(Array.isArray(data) ? data : [])
    } catch {
      setSuppliers([])
    } finally {
      setLoading(false)
    }
  }, [filters])

  useEffect(() => { fetchSuppliers() }, [fetchSuppliers])

  const createSupplier = async (data: Partial<Supplier>) => {
    const res = await fetch('/api/encomendas/suppliers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (!res.ok) throw new Error((await res.json()).error)
    await fetchSuppliers()
    return res.json()
  }

  const updateSupplier = async (id: string, data: Partial<Supplier>) => {
    const res = await fetch(`/api/encomendas/suppliers/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (!res.ok) throw new Error((await res.json()).error)
    await fetchSuppliers()
    return res.json()
  }

  const deleteSupplier = async (id: string) => {
    const res = await fetch(`/api/encomendas/suppliers/${id}`, { method: 'DELETE' })
    if (!res.ok) throw new Error((await res.json()).error)
    await fetchSuppliers()
  }

  return {
    suppliers, loading, filters, setFilters,
    createSupplier, updateSupplier, deleteSupplier,
    refetch: fetchSuppliers,
  }
}
