'use client'

import { useState, useEffect, useCallback } from 'react'
import type { WeeklyReportWithConsultant } from '@/types/goal'

interface UseWeeklyReportsParams {
  consultant_id?: string
  week_start?: string
  status?: string
}

export function useWeeklyReports(params: UseWeeklyReportsParams = {}) {
  const [reports, setReports] = useState<WeeklyReportWithConsultant[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchReports = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const sp = new URLSearchParams()
      if (params.consultant_id) sp.set('consultant_id', params.consultant_id)
      if (params.week_start) sp.set('week_start', params.week_start)
      if (params.status) sp.set('status', params.status)

      const res = await fetch(`/api/goals/weekly-reports?${sp.toString()}`)
      if (!res.ok) throw new Error('Erro ao carregar relatórios')

      const json = await res.json()
      setReports(json.data || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido')
      setReports([])
    } finally {
      setIsLoading(false)
    }
  }, [params.consultant_id, params.week_start, params.status])

  useEffect(() => {
    fetchReports()
  }, [fetchReports])

  return { reports, isLoading, error, refetch: fetchReports }
}
