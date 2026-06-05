'use client'

import { useState, useEffect, useCallback } from 'react'
import type { AdminReportWithDetails } from '@/types/training'

interface UseAdminReportsParams {
  status?: string
  courseId?: string
  reason?: string
  page?: number
  limit?: number
}

export function useTrainingAdminReports(params: UseAdminReportsParams = {}) {
  const [reports, setReports] = useState<AdminReportWithDetails[]>([])
  const [total, setTotal] = useState(0)
  const [isLoading, setIsLoading] = useState(true)

  const fetchReports = useCallback(async () => {
    setIsLoading(true)
    try {
      const sp = new URLSearchParams()
      if (params.status) sp.set('status', params.status)
      if (params.courseId) sp.set('course_id', params.courseId)
      if (params.reason) sp.set('reason', params.reason)
      sp.set('page', String(params.page || 1))
      sp.set('limit', String(params.limit || 20))

      const res = await fetch(`/api/training/admin/reports?${sp}`)
      const json = await res.json()
      setReports(json.data || [])
      setTotal(json.total || 0)
    } finally {
      setIsLoading(false)
    }
  }, [params.status, params.courseId, params.reason, params.page, params.limit])

  useEffect(() => { fetchReports() }, [fetchReports])

  const updateStatus = useCallback(async (
    reportId: string,
    status: string,
    resolutionNote?: string
  ) => {
    const res = await fetch(`/api/training/admin/reports/${reportId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, resolution_note: resolutionNote }),
    })
    if (!res.ok) throw new Error('Erro ao actualizar report')
    await fetchReports()
  }, [fetchReports])

  return { reports, total, isLoading, refetch: fetchReports, updateStatus }
}
