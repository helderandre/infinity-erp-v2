'use client'

import { useState, useEffect, useCallback } from 'react'
import type { ContaCorrenteTransaction, AgentBalance } from '@/types/marketing'

export function useContaCorrente(agentId?: string) {
  const [transactions, setTransactions] = useState<ContaCorrenteTransaction[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [typeFilter, setTypeFilter] = useState<'DEBIT' | 'CREDIT' | ''>('')

  const fetchTransactions = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (agentId) params.set('agent_id', agentId)
      if (typeFilter) params.set('type', typeFilter)

      const res = await fetch(`/api/marketing/conta-corrente?${params}`)
      const data = await res.json()
      setTransactions(data.data || [])
      setTotal(data.total || 0)
    } catch {
      setTransactions([])
    } finally {
      setLoading(false)
    }
  }, [agentId, typeFilter])

  useEffect(() => { fetchTransactions() }, [fetchTransactions])

  return { transactions, total, loading, typeFilter, setTypeFilter, refetch: fetchTransactions }
}

export function useAgentBalances() {
  const [balances, setBalances] = useState<AgentBalance[]>([])
  const [loading, setLoading] = useState(true)

  const fetchBalances = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/marketing/conta-corrente?summary=true')
      const data = await res.json()
      setBalances(Array.isArray(data) ? data : [])
    } catch {
      setBalances([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchBalances() }, [fetchBalances])

  return { balances, loading, refetch: fetchBalances }
}
