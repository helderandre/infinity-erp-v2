'use client'

import { useCallback, useEffect, useState } from 'react'
import type { AgentGoalInput, AgentGoalWithTargets } from '@/types/agent-goal'

interface UseAgentGoalOptions {
  year: number
  agentId?: string | null
}

interface UseAgentGoalResult {
  goal: AgentGoalWithTargets | null
  isLoading: boolean
  error: string | null
  refetch: () => Promise<void>
  save: (input: AgentGoalInput) => Promise<{ ok: boolean; error?: string; data?: AgentGoalWithTargets }>
  isSaving: boolean
}

export function useAgentGoal({ year, agentId }: UseAgentGoalOptions): UseAgentGoalResult {
  const [goal, setGoal] = useState<AgentGoalWithTargets | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchGoal = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ year: String(year) })
      if (agentId) params.set('agent_id', agentId)
      const res = await fetch(`/api/agent-goals?${params.toString()}`)
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body?.error || `HTTP ${res.status}`)
      }
      const body = await res.json()
      setGoal(body.data ?? null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido')
      setGoal(null)
    } finally {
      setIsLoading(false)
    }
  }, [year, agentId])

  useEffect(() => {
    void fetchGoal()
  }, [fetchGoal])

  const save = useCallback(async (input: AgentGoalInput) => {
    setIsSaving(true)
    try {
      const res = await fetch('/api/agent-goals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        return { ok: false, error: body?.error || `HTTP ${res.status}` }
      }
      setGoal(body.data ?? null)
      return { ok: true, data: body.data as AgentGoalWithTargets }
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : 'Erro desconhecido' }
    } finally {
      setIsSaving(false)
    }
  }, [])

  return { goal, isLoading, error, refetch: fetchGoal, save, isSaving }
}
