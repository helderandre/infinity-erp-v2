'use client'

import { useState, useCallback } from 'react'

interface AgentCost {
  agent_id: string
  commercial_name: string
  total_amount: number
  total_requisitions: number
}

interface ProductCost {
  product_id: string
  product_name: string
  sku: string | null
  total_amount: number
  total_quantity: number
}

export function useEncomendaReports() {
  const [agentCosts, setAgentCosts] = useState<AgentCost[]>([])
  const [productCosts, setProductCosts] = useState<ProductCost[]>([])
  const [loading, setLoading] = useState(false)

  const fetchCostsByAgent = useCallback(async (dateFrom?: string, dateTo?: string) => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (dateFrom) params.set('date_from', dateFrom)
      if (dateTo) params.set('date_to', dateTo)

      const res = await fetch(`/api/encomendas/reports/costs-by-agent?${params}`)
      const data = await res.json()
      setAgentCosts(Array.isArray(data) ? data : [])
    } catch {
      setAgentCosts([])
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchCostsByProduct = useCallback(async (dateFrom?: string, dateTo?: string) => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (dateFrom) params.set('date_from', dateFrom)
      if (dateTo) params.set('date_to', dateTo)

      const res = await fetch(`/api/encomendas/reports/costs-by-product?${params}`)
      const data = await res.json()
      setProductCosts(Array.isArray(data) ? data : [])
    } catch {
      setProductCosts([])
    } finally {
      setLoading(false)
    }
  }, [])

  return {
    agentCosts, productCosts, loading,
    fetchCostsByAgent, fetchCostsByProduct,
  }
}
