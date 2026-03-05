'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { LogEmail } from '@/types/process'

export function useEmailStatus(taskId: string | null, subtaskId?: string | null) {
  const [emails, setEmails] = useState<LogEmail[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const channelRef = useRef<ReturnType<ReturnType<typeof createClient>['channel']> | null>(null)

  const fetchEmails = useCallback(async () => {
    if (!taskId) return
    setIsLoading(true)
    try {
      const params = new URLSearchParams({ task_id: taskId })
      if (subtaskId) params.set('subtask_id', subtaskId)
      const res = await fetch(`/api/emails?${params}`)
      if (res.ok) {
        const data = await res.json()
        setEmails(data)
      }
    } catch (err) {
      console.error('[useEmailStatus] Erro:', err)
    } finally {
      setIsLoading(false)
    }
  }, [taskId, subtaskId])

  useEffect(() => {
    if (!taskId) {
      setEmails([])
      return
    }

    fetchEmails()

    // Realtime subscription para updates de log_emails
    const supabase = createClient()
    const channel = supabase
      .channel(`email-status-${taskId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'log_emails',
          filter: `proc_task_id=eq.${taskId}`,
        },
        () => fetchEmails()
      )
      .subscribe()

    channelRef.current = channel

    return () => {
      supabase.removeChannel(channel)
      channelRef.current = null
    }
  }, [taskId, fetchEmails])

  return { emails, isLoading, refetch: fetchEmails }
}
