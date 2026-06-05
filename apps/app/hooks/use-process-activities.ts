'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { TaskActivity } from '@/types/process'

export interface ProcessActivity extends TaskActivity {
  task_title: string
  stage_name: string
}

export function useProcessActivities(processId: string | null) {
  const [activities, setActivities] = useState<ProcessActivity[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const channelRef = useRef<ReturnType<ReturnType<typeof createClient>['channel']> | null>(null)

  const fetchActivities = useCallback(async () => {
    if (!processId) return
    setIsLoading(true)
    try {
      const res = await fetch(`/api/processes/${processId}/activities`)
      if (!res.ok) throw new Error('Erro ao carregar actividades')
      const data = await res.json()
      setActivities(data)
    } catch {
      // silently fail
    } finally {
      setIsLoading(false)
    }
  }, [processId])

  useEffect(() => {
    if (!processId) {
      setActivities([])
      return
    }

    fetchActivities()

    // Realtime subscription for any new activity in this process's tasks
    const supabase = createClient()
    const channel = supabase
      .channel(`process-activities-${processId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'proc_task_activities',
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
  }, [processId, fetchActivities])

  return { activities, isLoading, refetch: fetchActivities }
}
