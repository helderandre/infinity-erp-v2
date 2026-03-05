'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { TaskActivity } from '@/types/process'

export function useTaskActivities(processId: string, taskId: string | null) {
  const [activities, setActivities] = useState<TaskActivity[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const channelRef = useRef<ReturnType<ReturnType<typeof createClient>['channel']> | null>(null)

  const fetchActivities = useCallback(async () => {
    if (!taskId) return
    setIsLoading(true)
    try {
      const res = await fetch(`/api/processes/${processId}/tasks/${taskId}/activities`)
      if (!res.ok) throw new Error('Erro ao carregar actividades')
      const data = await res.json()
      setActivities(data)
    } catch {
      // silently fail
    } finally {
      setIsLoading(false)
    }
  }, [processId, taskId])

  useEffect(() => {
    if (!taskId) {
      setActivities([])
      return
    }

    fetchActivities()

    // Realtime subscription
    const supabase = createClient()
    const channel = supabase
      .channel(`task-activities-${taskId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'proc_task_activities',
          filter: `proc_task_id=eq.${taskId}`,
        },
        () => {
          fetchActivities()
        }
      )
      .subscribe()

    channelRef.current = channel

    return () => {
      supabase.removeChannel(channel)
      channelRef.current = null
    }
  }, [taskId, fetchActivities])

  return { activities, isLoading, refetch: fetchActivities }
}
