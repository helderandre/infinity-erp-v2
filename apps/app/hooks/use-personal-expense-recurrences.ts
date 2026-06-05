'use client'

import { useCallback, useEffect, useState } from 'react'
import type { PersonalExpenseRecurrence } from '@/types/personal-expense'

export function usePersonalExpenseRecurrences(opts: { activeOnly?: boolean } = {}) {
  const [data, setData] = useState<PersonalExpenseRecurrence[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (opts.activeOnly === false) params.set('active', 'false')
      const res = await fetch(`/api/agent-personal-expense-recurrences?${params}`)
      if (!res.ok) throw new Error('Erro ao carregar recorrências')
      const json = await res.json()
      setData(json.data ?? [])
    } catch (e: any) {
      setError(e?.message ?? 'Erro desconhecido')
      setData([])
    } finally {
      setLoading(false)
    }
  }, [opts.activeOnly])

  useEffect(() => { refetch() }, [refetch])

  return { data, loading, error, refetch }
}
