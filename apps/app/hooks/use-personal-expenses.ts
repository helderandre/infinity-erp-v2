'use client'

import { useCallback, useEffect, useState } from 'react'
import type { PersonalExpense, PersonalExpensesSummary } from '@/types/personal-expense'

interface UseListArgs {
  from?: string
  to?: string
  category?: string
  page?: number
  limit?: number
}

export function usePersonalExpenses(args: UseListArgs = {}) {
  const [data, setData] = useState<PersonalExpense[]>([])
  const [total, setTotal] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (args.from) params.set('from', args.from)
      if (args.to) params.set('to', args.to)
      if (args.category) params.set('category', args.category)
      if (args.page) params.set('page', String(args.page))
      if (args.limit) params.set('limit', String(args.limit))

      const res = await fetch(`/api/agent-personal-expenses?${params}`)
      if (!res.ok) {
        const j = await res.json().catch(() => null)
        throw new Error(j?.error ?? 'Erro ao carregar despesas')
      }
      const json = await res.json()
      setData(json.data ?? [])
      setTotal(json.total ?? 0)
      setHasMore(json.hasMore ?? false)
    } catch (e: any) {
      setError(e?.message ?? 'Erro desconhecido')
      setData([])
    } finally {
      setLoading(false)
    }
  }, [args.from, args.to, args.category, args.page, args.limit])

  useEffect(() => { refetch() }, [refetch])

  return { data, total, hasMore, loading, error, refetch }
}

export function usePersonalExpensesSummary(args: { from?: string; to?: string } = {}) {
  const [data, setData] = useState<(PersonalExpensesSummary & { month_amount: number; ytd_amount: number }) | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (args.from) params.set('from', args.from)
      if (args.to) params.set('to', args.to)
      const res = await fetch(`/api/agent-personal-expenses/summary?${params}`)
      if (!res.ok) throw new Error('Erro ao carregar resumo')
      const json = await res.json()
      setData(json)
    } catch (e: any) {
      setError(e?.message ?? 'Erro desconhecido')
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [args.from, args.to])

  useEffect(() => { refetch() }, [refetch])

  return { data, loading, error, refetch }
}
