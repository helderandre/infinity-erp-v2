'use client'

import { useState, useEffect, useCallback } from 'react'
import type { WeeklyReportWithActivities, AIAdvice } from '@/types/goal'

export function useWeeklyReport(reportId: string | null) {
  const [report, setReport] = useState<WeeklyReportWithActivities | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchReport = useCallback(async () => {
    if (!reportId) return
    setIsLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/goals/weekly-reports/${reportId}`)
      if (!res.ok) throw new Error('Erro ao carregar relatório')
      const json = await res.json()
      setReport(json)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido')
      setReport(null)
    } finally {
      setIsLoading(false)
    }
  }, [reportId])

  useEffect(() => {
    fetchReport()
  }, [fetchReport])

  const saveReport = useCallback(async (data: {
    notes_wins?: string | null
    notes_challenges?: string | null
    notes_next_week?: string | null
    submit?: boolean
  }) => {
    if (!reportId) return null
    const res = await fetch(`/api/goals/weekly-reports/${reportId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (!res.ok) throw new Error('Erro ao guardar relatório')
    const result = await res.json()
    await fetchReport()
    return result
  }, [reportId, fetchReport])

  const addManagerFeedback = useCallback(async (feedback: string) => {
    if (!reportId) return null
    const res = await fetch(`/api/goals/weekly-reports/${reportId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ manager_feedback: feedback }),
    })
    if (!res.ok) throw new Error('Erro ao guardar feedback')
    const result = await res.json()
    await fetchReport()
    return result
  }, [reportId, fetchReport])

  const generateAdvice = useCallback(async (type: 'weekly' | 'monthly' | 'manager_prep' = 'weekly'): Promise<AIAdvice | null> => {
    if (!reportId) return null
    const res = await fetch(`/api/goals/weekly-reports/${reportId}/ai-advice`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type }),
    })
    if (!res.ok) throw new Error('Erro ao gerar conselho IA')
    const advice = await res.json()
    await fetchReport()
    return advice
  }, [reportId, fetchReport])

  return { report, isLoading, error, refetch: fetchReport, saveReport, addManagerFeedback, generateAdvice }
}
