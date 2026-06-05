'use client'

import { useEffect, useState, useCallback } from 'react'
import type { ContaCorrenteTransaction } from '@/types/marketing'
import type { CompanyTransaction } from '@/types/financial'
import { mapAgentTransaction, mapCompanyTransaction } from '@/lib/financial/ledger-adapter'
import type { LedgerEntry, LedgerScope } from '@/lib/financial/ledger-types'

interface UseLedgerArgs {
  scope: LedgerScope
  /** ISO range; both inclusive on the source's date column. */
  range?: { from?: string; to?: string }
}

export function useLedger({ scope, range }: UseLedgerArgs) {
  const [entries, setEntries] = useState<LedgerEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      if (scope.kind === 'agent') {
        const params = new URLSearchParams()
        params.set('agent_id', scope.agentId)
        params.set('limit', '500')
        if (range?.from) params.set('from', range.from)
        if (range?.to) params.set('to', range.to)
        const res = await fetch(`/api/marketing/conta-corrente?${params}`)
        if (!res.ok) throw new Error('Erro ao carregar conta corrente')
        const json = await res.json()
        const rows = (json.data ?? []) as ContaCorrenteTransaction[]
        setEntries(rows.map(mapAgentTransaction))
      } else {
        const params = new URLSearchParams()
        if (range?.from) {
          const d = new Date(range.from)
          params.set('year', String(d.getFullYear()))
          params.set('month', String(d.getMonth() + 1))
        }
        params.set('page', '1')
        const res = await fetch(`/api/financial/company-transactions?${params}`)
        if (!res.ok) throw new Error('Erro ao carregar movimentos da empresa')
        const json = await res.json()
        const rows = (json.transactions ?? json.data ?? []) as CompanyTransaction[]
        setEntries(rows.map(mapCompanyTransaction))
      }
    } catch (e: any) {
      setError(e?.message ?? 'Erro desconhecido')
      setEntries([])
    } finally {
      setLoading(false)
    }
  }, [scope.kind, scope.kind === 'agent' ? scope.agentId : null, range?.from, range?.to])

  useEffect(() => { load() }, [load])

  return { entries, loading, error, refetch: load }
}
