'use client'

import { useState, useEffect, useCallback } from 'react'
import type { CourseCompletionStats, AdminOverviewStats } from '@/types/training'

interface CompletionByMonth {
  month: string
  count: number
}

export function useTrainingAdminStats() {
  const [courseStats, setCourseStats] = useState<CourseCompletionStats[]>([])
  const [overview, setOverview] = useState<AdminOverviewStats>({
    total_reports_open: 0,
    total_comments_unresolved: 0,
    avg_completion_rate: 0,
    total_downloads: 0,
  })
  const [completionByMonth, setCompletionByMonth] = useState<CompletionByMonth[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const fetchStats = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await fetch('/api/training/admin/stats')
      const json = await res.json()
      setCourseStats(json.course_stats || [])
      setOverview(json.overview || {
        total_reports_open: 0,
        total_comments_unresolved: 0,
        avg_completion_rate: 0,
        total_downloads: 0,
      })
      setCompletionByMonth(json.completion_by_month || [])
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => { fetchStats() }, [fetchStats])

  return { courseStats, overview, completionByMonth, isLoading, refetch: fetchStats }
}
