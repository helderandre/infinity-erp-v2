'use client'

import { useState, useEffect, useCallback } from 'react'

interface TeamWeekReport {
  consultant_id: string
  commercial_name: string
  report: {
    id: string
    status: string
    notes_wins: string | null
    notes_challenges: string | null
    notes_next_week: string | null
    submitted_at: string | null
    manager_feedback: string | null
    ai_advice: string | null
  } | null
  activities: {
    total: number
    system: number
    declared: number
    by_type: Record<string, { done: number; target: number; system?: number; declared?: number }>
  }
  trust_ratio: number
  pipeline_value?: {
    compra: number
    venda: number
    arrendamento: number
    total: number
  }
  lead_sources?: { source: string; count: number }[]
}

interface TeamWeekData {
  week_start: string
  week_end: string
  reports: TeamWeekReport[]
}

export function useTeamWeek(weekStart?: string) {
  const [data, setData] = useState<TeamWeekData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [briefing, setBriefing] = useState<string | null>(null)
  const [isBriefingLoading, setIsBriefingLoading] = useState(false)

  const fetchTeamWeek = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const sp = new URLSearchParams()
      if (weekStart) sp.set('week_start', weekStart)

      const res = await fetch(`/api/goals/weekly-reports/team?${sp.toString()}`)
      if (!res.ok) throw new Error('Erro ao carregar dados da equipa')
      const json = await res.json()
      setData(json)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido')
      setData(null)
    } finally {
      setIsLoading(false)
    }
  }, [weekStart])

  useEffect(() => {
    fetchTeamWeek()
  }, [fetchTeamWeek])

  const generateBriefing = useCallback(async () => {
    if (!data?.week_start) return
    setIsBriefingLoading(true)
    try {
      const res = await fetch('/api/goals/weekly-reports/team/ai-briefing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ week_start: data.week_start }),
      })
      if (!res.ok) throw new Error('Erro ao gerar briefing')
      const json = await res.json()
      setBriefing(json.briefing)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido')
    } finally {
      setIsBriefingLoading(false)
    }
  }, [data?.week_start])

  return { data, isLoading, error, refetch: fetchTeamWeek, briefing, isBriefingLoading, generateBriefing }
}
