'use client'

import { useState, useEffect, useCallback } from 'react'
import type { MarketingPack } from '@/types/marketing'

export function useMarketingPacks() {
  const [packs, setPacks] = useState<MarketingPack[]>([])
  const [loading, setLoading] = useState(true)

  const fetchPacks = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/marketing/packs')
      const data = await res.json()
      setPacks(Array.isArray(data) ? data : [])
    } catch {
      setPacks([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchPacks() }, [fetchPacks])

  const createPack = async (data: { name: string; description: string; price: number; item_ids: string[]; is_active?: boolean }) => {
    const res = await fetch('/api/marketing/packs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (!res.ok) throw new Error((await res.json()).error)
    await fetchPacks()
    return res.json()
  }

  const updatePack = async (id: string, data: Record<string, unknown>) => {
    const res = await fetch(`/api/marketing/packs/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (!res.ok) throw new Error((await res.json()).error)
    await fetchPacks()
    return res.json()
  }

  const deletePack = async (id: string) => {
    const res = await fetch(`/api/marketing/packs/${id}`, { method: 'DELETE' })
    if (!res.ok) throw new Error((await res.json()).error)
    await fetchPacks()
  }

  return { packs, loading, createPack, updatePack, deletePack, refetch: fetchPacks }
}
