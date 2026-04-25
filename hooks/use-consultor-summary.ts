'use client'

import { useEffect, useState, useCallback } from 'react'

export interface ConsultorSummaryKpis {
  comissoes_mes: number
  comissoes_ytd: number
  a_receber: number
  loja_mes: number
  saldo_cc: number
  credit_limit: number | null
  liquido_mes: number
}

export interface MonthlySeriesPoint {
  month: string
  comissoes: number
  despesas: number
  liquido: number
}

export interface LojaBreakdownItem {
  category: string
  amount: number
}

export interface ProximaEntrada {
  id: string
  deal_id: string
  amount: number
  payment_moment: string | null
  signed_date: string | null
  kind: 'own' | 'split'
}

export interface UltimaMovimentacao {
  id: string
  date: string
  type: 'CREDIT' | 'DEBIT'
  category: string
  amount: number
  description: string
  balance_after: number
}

export interface ConsultorSummary {
  agent: { id: string; commercial_name: string }
  kpis: ConsultorSummaryKpis
  monthly_series: MonthlySeriesPoint[]
  loja_breakdown: LojaBreakdownItem[]
  proximas_entradas: ProximaEntrada[]
  ultimas_movimentacoes: UltimaMovimentacao[]
}

export function useConsultorSummary(agentId?: string) {
  const [data, setData] = useState<ConsultorSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (agentId) params.set('agent_id', agentId)
      const res = await fetch(`/api/financial/consultor-summary?${params}`)
      if (!res.ok) {
        const json = await res.json().catch(() => null)
        throw new Error(json?.error ?? 'Erro ao carregar resumo')
      }
      const json = await res.json()
      setData(json as ConsultorSummary)
    } catch (e: any) {
      setError(e?.message ?? 'Erro desconhecido')
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [agentId])

  useEffect(() => {
    refetch()
  }, [refetch])

  return { data, loading, error, refetch }
}
