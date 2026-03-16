'use client'

import { useState, useEffect, useCallback } from 'react'
import type { CreditBank } from '@/types/credit'

interface UseCreditBanksReturn {
  banks: CreditBank[]
  isLoading: boolean
  error: string | null
  refetch: () => void
  addBank: (data: Record<string, unknown>) => Promise<void>
  updateBank: (bankId: string, data: Record<string, unknown>) => Promise<void>
  deleteBank: (bankId: string) => Promise<void>
}

export function useCreditBanks(): UseCreditBanksReturn {
  const [banks, setBanks] = useState<CreditBank[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchBanks = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/credit/banks')
      if (!res.ok) throw new Error('Erro ao carregar bancos')
      const json = await res.json()
      setBanks(json.data || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => { fetchBanks() }, [fetchBanks])

  const addBank = useCallback(async (data: Record<string, unknown>) => {
    const res = await fetch('/api/credit/banks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (!res.ok) {
      const json = await res.json()
      throw new Error(json.error || 'Erro ao criar banco')
    }
    await fetchBanks()
  }, [fetchBanks])

  const updateBank = useCallback(async (bankId: string, data: Record<string, unknown>) => {
    const res = await fetch(`/api/credit/banks/${bankId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (!res.ok) {
      const json = await res.json()
      throw new Error(json.error || 'Erro ao actualizar banco')
    }
    await fetchBanks()
  }, [fetchBanks])

  const deleteBank = useCallback(async (bankId: string) => {
    const res = await fetch(`/api/credit/banks/${bankId}`, { method: 'DELETE' })
    if (!res.ok) {
      const json = await res.json()
      throw new Error(json.error || 'Erro ao eliminar banco')
    }
    await fetchBanks()
  }, [fetchBanks])

  return { banks, isLoading, error, refetch: fetchBanks, addBank, updateBank, deleteBank }
}
