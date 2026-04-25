'use client'

import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'

export type ProposalStatus = 'pending' | 'accepted' | 'rejected' | 'withdrawn'
export type ProposalDirection = 'outbound' | 'inbound'

export interface NegocioProposal {
  id: string
  negocio_id: string
  negocio_property_id: string | null
  property_id: string | null
  amount: number | null
  currency: string
  status: ProposalStatus
  direction: ProposalDirection
  notes: string | null
  rejected_reason: string | null
  rejected_at: string | null
  withdrawn_at: string | null
  accepted_at: string | null
  deal_id: string | null
  created_by: string | null
  created_at: string
  updated_at: string
  property?: {
    id: string
    title: string | null
    slug: string | null
    listing_price: number | null
    external_ref: string | null
    city: string | null
    zone: string | null
  } | null
  deal?: { id: string } | null
  creator?: { id: string; commercial_name: string | null } | null
}

export interface CreateProposalInput {
  negocio_property_id?: string | null
  property_id?: string | null
  amount?: number | null
  notes?: string | null
  direction?: ProposalDirection
}

export interface UpdateProposalInput {
  amount?: number | null
  notes?: string | null
  status?: ProposalStatus
  rejected_reason?: string | null
  deal_id?: string | null
}

interface UseNegocioProposalsResult {
  proposals: NegocioProposal[]
  isLoading: boolean
  error: string | null
  refetch: () => Promise<void>
  create: (input: CreateProposalInput) => Promise<NegocioProposal | null>
  update: (proposalId: string, input: UpdateProposalInput) => Promise<NegocioProposal | null>
  remove: (proposalId: string) => Promise<boolean>
}

export function useNegocioProposals(
  negocioId: string | null | undefined,
): UseNegocioProposalsResult {
  const [proposals, setProposals] = useState<NegocioProposal[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(async () => {
    if (!negocioId) return
    setIsLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/negocios/${negocioId}/proposals`)
      if (!res.ok) throw new Error('Erro ao carregar propostas')
      const json = await res.json()
      setProposals(json.data || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro')
    } finally {
      setIsLoading(false)
    }
  }, [negocioId])

  useEffect(() => {
    void refetch()
  }, [refetch])

  const create = useCallback(
    async (input: CreateProposalInput) => {
      if (!negocioId) return null
      try {
        const res = await fetch(`/api/negocios/${negocioId}/proposals`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(input),
        })
        if (!res.ok) {
          const body = await res.json().catch(() => ({}))
          throw new Error(body.error || 'Erro ao criar proposta')
        }
        const { data } = await res.json()
        setProposals((prev) => [data, ...prev])
        toast.success('Proposta criada')
        return data as NegocioProposal
      } catch (err: any) {
        toast.error(err?.message || 'Erro ao criar proposta')
        return null
      }
    },
    [negocioId],
  )

  const update = useCallback(
    async (proposalId: string, input: UpdateProposalInput) => {
      if (!negocioId) return null
      try {
        const res = await fetch(
          `/api/negocios/${negocioId}/proposals/${proposalId}`,
          {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(input),
          },
        )
        if (!res.ok) {
          const body = await res.json().catch(() => ({}))
          throw new Error(body.error || 'Erro ao actualizar proposta')
        }
        const { data } = await res.json()
        setProposals((prev) => prev.map((p) => (p.id === proposalId ? data : p)))
        return data as NegocioProposal
      } catch (err: any) {
        toast.error(err?.message || 'Erro ao actualizar proposta')
        return null
      }
    },
    [negocioId],
  )

  const remove = useCallback(
    async (proposalId: string) => {
      if (!negocioId) return false
      try {
        const res = await fetch(
          `/api/negocios/${negocioId}/proposals/${proposalId}`,
          { method: 'DELETE' },
        )
        if (!res.ok) throw new Error('Erro ao eliminar proposta')
        setProposals((prev) => prev.filter((p) => p.id !== proposalId))
        toast.success('Proposta eliminada')
        return true
      } catch (err: any) {
        toast.error(err?.message || 'Erro ao eliminar proposta')
        return false
      }
    },
    [negocioId],
  )

  return { proposals, isLoading, error, refetch, create, update, remove }
}
