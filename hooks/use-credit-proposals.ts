'use client'

import { useState, useEffect, useCallback } from 'react'
import type { CreditProposal } from '@/types/credit'

interface UseCreditProposalsReturn {
  proposals: CreditProposal[]
  isLoading: boolean
  error: string | null
  refetch: () => void
  addProposal: (data: Record<string, unknown>) => Promise<void>
  updateProposal: (proposalId: string, data: Record<string, unknown>) => Promise<void>
  deleteProposal: (proposalId: string) => Promise<void>
  selectProposal: (proposalId: string) => Promise<void>
}

export function useCreditProposals(creditId: string | null): UseCreditProposalsReturn {
  const [proposals, setProposals] = useState<CreditProposal[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchProposals = useCallback(async () => {
    if (!creditId) return
    setIsLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/credit/${creditId}/proposals`)
      if (!res.ok) throw new Error('Erro ao carregar propostas')
      const json = await res.json()
      setProposals(json.data || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido')
    } finally {
      setIsLoading(false)
    }
  }, [creditId])

  useEffect(() => { fetchProposals() }, [fetchProposals])

  const addProposal = useCallback(async (data: Record<string, unknown>) => {
    if (!creditId) return
    const res = await fetch(`/api/credit/${creditId}/proposals`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (!res.ok) {
      const json = await res.json()
      throw new Error(json.error || 'Erro ao criar proposta')
    }
    await fetchProposals()
  }, [creditId, fetchProposals])

  const updateProposal = useCallback(async (proposalId: string, data: Record<string, unknown>) => {
    if (!creditId) return
    const res = await fetch(`/api/credit/${creditId}/proposals/${proposalId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (!res.ok) {
      const json = await res.json()
      throw new Error(json.error || 'Erro ao actualizar proposta')
    }
    await fetchProposals()
  }, [creditId, fetchProposals])

  const deleteProposal = useCallback(async (proposalId: string) => {
    if (!creditId) return
    const res = await fetch(`/api/credit/${creditId}/proposals/${proposalId}`, { method: 'DELETE' })
    if (!res.ok) {
      const json = await res.json()
      throw new Error(json.error || 'Erro ao eliminar proposta')
    }
    await fetchProposals()
  }, [creditId, fetchProposals])

  const selectProposal = useCallback(async (proposalId: string) => {
    if (!creditId) return
    const res = await fetch(`/api/credit/${creditId}/proposals/${proposalId}/select`, { method: 'POST' })
    if (!res.ok) {
      const json = await res.json()
      throw new Error(json.error || 'Erro ao seleccionar proposta')
    }
    await fetchProposals()
  }, [creditId, fetchProposals])

  return { proposals, isLoading, error, refetch: fetchProposals, addProposal, updateProposal, deleteProposal, selectProposal }
}
