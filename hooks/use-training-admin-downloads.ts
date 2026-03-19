'use client'

import { useState, useEffect, useCallback } from 'react'
import type { MaterialDownloadStats, MaterialDownloadEvent } from '@/types/training'

interface UseAdminDownloadsParams {
  courseId?: string
  view?: 'stats' | 'events'
  page?: number
  limit?: number
}

export function useTrainingAdminDownloads(params: UseAdminDownloadsParams = {}) {
  const [data, setData] = useState<(MaterialDownloadStats | MaterialDownloadEvent)[]>([])
  const [total, setTotal] = useState(0)
  const [isLoading, setIsLoading] = useState(true)

  const fetchDownloads = useCallback(async () => {
    setIsLoading(true)
    try {
      const sp = new URLSearchParams()
      if (params.courseId) sp.set('course_id', params.courseId)
      sp.set('view', params.view || 'stats')
      sp.set('page', String(params.page || 1))
      sp.set('limit', String(params.limit || 20))

      const res = await fetch(`/api/training/admin/downloads?${sp}`)
      const json = await res.json()
      setData(json.data || [])
      setTotal(json.total || 0)
    } finally {
      setIsLoading(false)
    }
  }, [params.courseId, params.view, params.page, params.limit])

  useEffect(() => { fetchDownloads() }, [fetchDownloads])

  return { data, total, isLoading, refetch: fetchDownloads }
}
