'use client'

import { useCallback, useEffect, useState } from 'react'
import type { AgentWeeklyReport, AiAdvice } from '@/types/agent-weekly-report'

interface Options {
  weekStart: string | null // YYYY-MM-DD (Monday)
  agentId?: string | null
}

interface SavePayload {
  notes_wins?: string | null
  notes_challenges?: string | null
  notes_next_week?: string | null
}

interface Result {
  report: AgentWeeklyReport | null
  isLoading: boolean
  error: string | null
  refetch: () => Promise<void>
  save: (p: SavePayload) => Promise<{ ok: boolean; error?: string }>
  isSaving: boolean
  generateAi: () => Promise<{ ok: boolean; error?: string; summary?: string; advice?: AiAdvice }>
  isGenerating: boolean
}

export function useAgentWeeklyReport({ weekStart, agentId }: Options): Result {
  const [report, setReport] = useState<AgentWeeklyReport | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchReport = useCallback(async () => {
    if (!weekStart) {
      setIsLoading(false)
      return
    }
    setIsLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ week_start: weekStart })
      if (agentId) params.set('agent_id', agentId)
      const res = await fetch(`/api/agent-weekly-reports?${params.toString()}`)
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body?.error || `HTTP ${res.status}`)
      setReport(body.data ?? null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido')
      setReport(null)
    } finally {
      setIsLoading(false)
    }
  }, [weekStart, agentId])

  useEffect(() => {
    void fetchReport()
  }, [fetchReport])

  const save = useCallback(async (payload: SavePayload) => {
    if (!weekStart) return { ok: false, error: 'Sem semana selecionada' }
    setIsSaving(true)
    try {
      const res = await fetch('/api/agent-weekly-reports', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ week_start: weekStart, ...payload }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) return { ok: false, error: body?.error || `HTTP ${res.status}` }
      setReport(body.data ?? null)
      return { ok: true }
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : 'Erro desconhecido' }
    } finally {
      setIsSaving(false)
    }
  }, [weekStart])

  const generateAi = useCallback(async () => {
    if (!weekStart) return { ok: false, error: 'Sem semana selecionada' }
    setIsGenerating(true)
    try {
      const res = await fetch('/api/agent-weekly-reports/ai-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ week_start: weekStart }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) return { ok: false, error: body?.error || `HTTP ${res.status}` }
      // Refetch the row to get the persisted ai_* fields
      await fetchReport()
      return {
        ok: true,
        summary: body.data?.ai_summary,
        advice: body.data?.ai_advice,
      }
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : 'Erro desconhecido' }
    } finally {
      setIsGenerating(false)
    }
  }, [weekStart, fetchReport])

  return { report, isLoading, error, refetch: fetchReport, save, isSaving, generateAi, isGenerating }
}
