'use client'

import { useCallback, useEffect, useState } from 'react'

export interface OwnerReportListItem {
  id: string
  version: number
  title: string | null
  status: 'generating' | 'ready' | 'error' | string
  pdf_url: string | null
  share_token: string
  config: any
  generated_by: string | null
  created_at: string
}

export function useOwnerReports(propertyId: string) {
  const [items, setItems] = useState<OwnerReportListItem[]>([])
  const [loading, setLoading] = useState(true)

  const refetch = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/properties/${propertyId}/owner-report`, {
        cache: 'no-store',
      })
      const json = await res.json()
      setItems(Array.isArray(json.items) ? json.items : [])
    } catch {
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [propertyId])

  useEffect(() => {
    refetch()
  }, [refetch])

  return { items, loading, refetch }
}
