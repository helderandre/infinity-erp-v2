'use client'

import { useState, useEffect, useCallback } from 'react'
import type { GoalActivity } from '@/types/goal'

interface UseGoalActivitiesParams {
  goalId: string | null
  dateFrom?: string
  dateTo?: string
  activityType?: string
  origin?: string
}

export function useGoalActivities({
  goalId,
  dateFrom,
  dateTo,
  activityType,
  origin,
}: UseGoalActivitiesParams) {
  const [activities, setActivities] = useState<GoalActivity[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchActivities = useCallback(async () => {
    if (!goalId) return
    setIsLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (dateFrom) params.set('date_from', dateFrom)
      if (dateTo) params.set('date_to', dateTo)
      if (activityType) params.set('activity_type', activityType)
      if (origin) params.set('origin', origin)

      const res = await fetch(`/api/goals/${goalId}/activities?${params.toString()}`)
      if (!res.ok) throw new Error('Erro ao carregar actividades')

      const json = await res.json()
      setActivities(json.data || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido')
      setActivities([])
    } finally {
      setIsLoading(false)
    }
  }, [goalId, dateFrom, dateTo, activityType, origin])

  useEffect(() => {
    fetchActivities()
  }, [fetchActivities])

  return { activities, isLoading, error, refetch: fetchActivities }
}
