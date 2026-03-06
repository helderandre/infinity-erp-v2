"use client"

import { useCallback, useEffect, useState } from "react"
import type { FlowDefinition } from "@/lib/types/automation-flow"

export interface AutoFlow {
  id: string
  name: string
  description: string | null
  draft_definition: FlowDefinition
  published_definition: FlowDefinition | null
  published_at: string | null
  published_triggers: unknown[] | null
  has_unpublished_changes: boolean
  is_active: boolean
  wpp_instance_id: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

interface AutoTrigger {
  id: string
  flow_id: string
  trigger_type: string
  config: Record<string, unknown>
  is_active: boolean
  created_at: string
}

interface UseFlowsOptions {
  search?: string
  autoFetch?: boolean
}

export function useFlows(options: UseFlowsOptions = {}) {
  const { search, autoFetch = true } = options
  const [flows, setFlows] = useState<AutoFlow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchFlows = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (search) params.set("search", search)

      const res = await fetch(`/api/automacao/fluxos?${params.toString()}`)
      const json = await res.json()

      if (!res.ok) throw new Error(json.error || "Erro ao listar fluxos")
      setFlows(json.flows || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro desconhecido")
    } finally {
      setLoading(false)
    }
  }, [search])

  const getFlow = useCallback(
    async (id: string): Promise<{ flow: AutoFlow; triggers: AutoTrigger[] } | null> => {
      try {
        const res = await fetch(`/api/automacao/fluxos/${id}`)
        const json = await res.json()
        if (!res.ok) throw new Error(json.error)
        return { flow: json.flow, triggers: json.triggers || [] }
      } catch (err) {
        console.error("[useFlows] getFlow error:", err)
        return null
      }
    },
    []
  )

  const createFlow = useCallback(
    async (name?: string): Promise<AutoFlow | null> => {
      try {
        const res = await fetch("/api/automacao/fluxos", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name }),
        })
        const json = await res.json()
        if (!res.ok) throw new Error(json.error)
        return json.flow
      } catch (err) {
        console.error("[useFlows] createFlow error:", err)
        return null
      }
    },
    []
  )

  const updateFlow = useCallback(
    async (
      id: string,
      data: {
        name?: string
        description?: string
        draft_definition?: FlowDefinition
        wpp_instance_id?: string | null
      }
    ): Promise<AutoFlow | null> => {
      try {
        const res = await fetch(`/api/automacao/fluxos/${id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        })
        const json = await res.json()
        if (!res.ok) throw new Error(json.error)
        return json.flow
      } catch (err) {
        console.error("[useFlows] updateFlow error:", err)
        throw err
      }
    },
    []
  )

  const deleteFlow = useCallback(async (id: string): Promise<boolean> => {
    try {
      const res = await fetch(`/api/automacao/fluxos/${id}`, {
        method: "DELETE",
      })
      if (!res.ok) {
        const json = await res.json()
        throw new Error(json.error)
      }
      return true
    } catch (err) {
      console.error("[useFlows] deleteFlow error:", err)
      return false
    }
  }, [])

  const publishFlow = useCallback(
    async (
      id: string
    ): Promise<{
      ok: boolean
      published_at?: string
      triggers_count?: number
      errors?: string[]
      error?: string
    } | null> => {
      try {
        const res = await fetch(`/api/automacao/fluxos/${id}/publish`, {
          method: "POST",
        })
        const json = await res.json()
        if (!res.ok) {
          return { ok: false, error: json.error, errors: json.errors }
        }
        return json
      } catch (err) {
        console.error("[useFlows] publishFlow error:", err)
        return null
      }
    },
    []
  )

  const activateFlow = useCallback(
    async (
      id: string,
      active: boolean
    ): Promise<{ ok: boolean; is_active?: boolean; error?: string } | null> => {
      try {
        const res = await fetch(`/api/automacao/fluxos/${id}/activate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ active }),
        })
        const json = await res.json()
        if (!res.ok) {
          return { ok: false, error: json.error }
        }
        return json
      } catch (err) {
        console.error("[useFlows] activateFlow error:", err)
        return null
      }
    },
    []
  )

  const testFlow = useCallback(
    async (
      id: string,
      data?: {
        entity_type?: string
        entity_id?: string
        test_variables?: Record<string, string>
      }
    ): Promise<{
        run_id: string
        first_step_id: string
        status?: string
        errors?: Array<{ node: string; message: string }>
        summary?: { whatsapp_sent?: number; emails_sent?: number }
      } | null> => {
      try {
        const res = await fetch(`/api/automacao/fluxos/${id}/test`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data || {}),
        })
        const json = await res.json()
        if (!res.ok) throw new Error(json.error)
        return json
      } catch (err) {
        console.error("[useFlows] testFlow error:", err)
        return null
      }
    },
    []
  )

  useEffect(() => {
    if (autoFetch) fetchFlows()
  }, [autoFetch, fetchFlows])

  return {
    flows,
    loading,
    error,
    fetchFlows,
    getFlow,
    createFlow,
    updateFlow,
    deleteFlow,
    publishFlow,
    activateFlow,
    testFlow,
  }
}
