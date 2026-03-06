"use client"

import { useCallback, useEffect, useState } from "react"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SA = any

export interface ExecutionRun {
  id: string
  flow_id: string
  status: "pending" | "running" | "completed" | "failed" | "cancelled"
  triggered_by: string
  entity_type: string | null
  entity_id: string | null
  context: SA
  total_steps: number
  completed_steps: number
  failed_steps: number
  started_at: string | null
  completed_at: string | null
  error_message: string | null
  created_at: string
  auto_flows: {
    name: string
    description: string | null
  }
}

export interface ExecutionStep {
  id: string
  run_id: string
  flow_id: string
  node_id: string
  node_type: string
  node_label: string | null
  status: "pending" | "running" | "completed" | "failed" | "cancelled"
  input_data: SA
  output_data: SA
  error_message: string | null
  duration_ms: number | null
  retry_count: number
  started_at: string | null
  completed_at: string | null
  scheduled_for: string | null
  created_at: string
}

export interface ExecutionDelivery {
  id: string
  run_id: string
  step_id: string | null
  channel: "whatsapp" | "email"
  recipient: string | null
  delivery_status: string
  message_preview: string | null
  provider_message_id: string | null
  error_detail: string | null
  created_at: string
}

export interface ExecutionDetail {
  run: ExecutionRun & { auto_flows: { name: string; draft_definition: SA; published_definition: SA | null } }
  steps: ExecutionStep[]
  deliveries: ExecutionDelivery[]
}

interface UseExecutionsOptions {
  flowId?: string
  status?: string
  limit?: number
  autoFetch?: boolean
}

export function useExecutions(options: UseExecutionsOptions = {}) {
  const { flowId, status, limit = 50, autoFetch = true } = options
  const [executions, setExecutions] = useState<ExecutionRun[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [offset, setOffset] = useState(0)

  const fetchExecutions = useCallback(async (pageOffset = 0) => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (flowId) params.set("flow_id", flowId)
      if (status) params.set("status", status)
      params.set("limit", String(limit))
      params.set("offset", String(pageOffset))

      const res = await fetch(`/api/automacao/execucoes?${params.toString()}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)

      setExecutions(json.executions || [])
      setTotal(json.total || 0)
      setOffset(pageOffset)
    } catch (err) {
      console.error("[useExecutions] fetch error:", err)
    } finally {
      setLoading(false)
    }
  }, [flowId, status, limit])

  const getDetail = useCallback(async (executionId: string): Promise<ExecutionDetail | null> => {
    try {
      const res = await fetch(`/api/automacao/execucoes/${executionId}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      return json
    } catch (err) {
      console.error("[useExecutions] getDetail error:", err)
      return null
    }
  }, [])

  const retryExecution = useCallback(async (executionId: string): Promise<boolean> => {
    try {
      const res = await fetch(`/api/automacao/execucoes/${executionId}`, {
        method: "POST",
      })
      if (!res.ok) {
        const json = await res.json()
        throw new Error(json.error)
      }
      return true
    } catch (err) {
      console.error("[useExecutions] retry error:", err)
      return false
    }
  }, [])

  const nextPage = useCallback(() => {
    const newOffset = offset + limit
    if (newOffset < total) fetchExecutions(newOffset)
  }, [offset, limit, total, fetchExecutions])

  const prevPage = useCallback(() => {
    const newOffset = Math.max(0, offset - limit)
    fetchExecutions(newOffset)
  }, [offset, limit, fetchExecutions])

  useEffect(() => {
    if (autoFetch) fetchExecutions(0)
  }, [autoFetch, fetchExecutions])

  return {
    executions,
    total,
    loading,
    offset,
    limit,
    page: Math.floor(offset / limit) + 1,
    totalPages: Math.ceil(total / limit),
    fetchExecutions,
    getDetail,
    retryExecution,
    nextPage,
    prevPage,
  }
}
