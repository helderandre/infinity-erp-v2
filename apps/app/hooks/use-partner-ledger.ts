'use client'

import { useCallback, useEffect, useState } from 'react'

export interface PartnerLedgerEntry {
  id: string
  partner_id: string
  kind: 'commission' | 'payment' | 'adjustment'
  direction: 'credit' | 'debit'
  amount: number
  status: 'pending' | 'paid' | 'completed'
  negocio_id: string | null
  description: string | null
  entry_date: string
  created_at: string
  negocio?: { id: string; tipo: string | null; localizacao: string | null; lead?: { nome: string | null } | null } | null
  creator?: { commercial_name: string | null } | null
}

export interface PartnerLedgerSummary {
  saldo: number
  total_a_receber: number
  total_pago: number
  total_comissoes: number
  count: number
}

export interface PartnerOverview {
  partner_id: string
  commercial_name: string | null
  profile_photo_url: string | null
  saldo: number
  total_a_receber: number
}

export interface PendingCommission {
  negocio_id: string
  lead_name: string
  tipo: string | null
  localizacao: string | null
  won_date: string | null
  referral_pct: number | null
  amount: number
}

// ─── Overview list of partners (management) ─────────────────────────────────
export function usePartnersOverview(enabled = true) {
  const [partners, setPartners] = useState<PartnerOverview[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/partner-ledger/partners')
      if (!res.ok) throw new Error('Erro ao carregar parceiros')
      const json = await res.json()
      setPartners(json.data ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (enabled) refetch()
  }, [enabled, refetch])

  return { partners, loading, error, refetch }
}

// ─── One partner's ledger (entries + summary). partnerId optional → self. ────
export function usePartnerLedger(partnerId?: string | null, enabled = true) {
  const [entries, setEntries] = useState<PartnerLedgerEntry[]>([])
  const [summary, setSummary] = useState<PartnerLedgerSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const qs = partnerId ? `?partner_id=${partnerId}` : ''
      const res = await fetch(`/api/partner-ledger${qs}`)
      if (!res.ok) throw new Error('Erro ao carregar conta corrente')
      const json = await res.json()
      setEntries(json.data ?? [])
      setSummary(json.summary ?? null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro')
    } finally {
      setLoading(false)
    }
  }, [partnerId])

  useEffect(() => {
    if (enabled) refetch()
  }, [enabled, refetch])

  return { entries, summary, loading, error, refetch }
}

// ─── Pending commissions to confirm for a partner (management) ──────────────
export function usePendingCommissions(partnerId?: string | null, enabled = true) {
  const [pending, setPending] = useState<PendingCommission[]>([])
  const [loading, setLoading] = useState(true)

  const refetch = useCallback(async () => {
    if (!partnerId) {
      setPending([])
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const res = await fetch(`/api/partner-ledger/pending-commissions?partner_id=${partnerId}`)
      if (!res.ok) throw new Error()
      const json = await res.json()
      setPending(json.data ?? [])
    } catch {
      setPending([])
    } finally {
      setLoading(false)
    }
  }, [partnerId])

  useEffect(() => {
    if (enabled) refetch()
  }, [enabled, refetch])

  return { pending, loading, refetch }
}

// ─── Mutations ──────────────────────────────────────────────────────────────
export async function confirmCommission(negocio_id: string, amount?: number) {
  const res = await fetch('/api/partner-ledger/confirm-commission', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(amount != null ? { negocio_id, amount } : { negocio_id }),
  })
  if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? 'Erro ao confirmar comissão')
  return res.json()
}

export async function createMovement(payload: {
  partner_id: string
  kind: 'payment' | 'adjustment'
  direction: 'credit' | 'debit'
  amount: number
  description: string
  entry_date?: string
  negocio_id?: string | null
}) {
  const res = await fetch('/api/partner-ledger', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? 'Erro ao registar movimento')
  return res.json()
}

export async function deleteLedgerEntry(id: string) {
  const res = await fetch(`/api/partner-ledger/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? 'Erro ao eliminar')
  return res.json()
}

export const formatEUR = (value: number) =>
  new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0 }).format(value)
