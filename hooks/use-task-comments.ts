'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { TaskComment, TaskCommentMention } from '@/types/process'

export function useTaskComments(processId: string, taskId: string | null) {
  const [comments, setComments] = useState<TaskComment[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const channelRef = useRef<ReturnType<ReturnType<typeof createClient>['channel']> | null>(null)

  const fetchComments = useCallback(async () => {
    if (!taskId) return
    setIsLoading(true)
    try {
      const res = await fetch(`/api/processes/${processId}/tasks/${taskId}/comments`)
      if (!res.ok) throw new Error('Erro ao carregar comentários')
      const data = await res.json()
      setComments(data)
    } catch {
      // silently fail — empty array
    } finally {
      setIsLoading(false)
    }
  }, [processId, taskId])

  // Fetch initial + subscribe to realtime
  useEffect(() => {
    if (!taskId) {
      setComments([])
      return
    }

    fetchComments()

    // Realtime subscription
    const supabase = createClient()
    const channel = supabase
      .channel(`task-comments-${taskId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'proc_task_comments',
          filter: `proc_task_id=eq.${taskId}`,
        },
        () => {
          // Re-fetch to get the comment with user data joined
          fetchComments()
        }
      )
      .subscribe()

    channelRef.current = channel

    return () => {
      supabase.removeChannel(channel)
      channelRef.current = null
    }
  }, [taskId, fetchComments])

  const addComment = useCallback(
    async (content: string, mentions: TaskCommentMention[]) => {
      if (!taskId) return
      const res = await fetch(`/api/processes/${processId}/tasks/${taskId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, mentions }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Erro ao adicionar comentário')
      }
      const comment = await res.json()
      // Optimistic: add immediately (realtime will also fire but fetchComments deduplicates)
      setComments((prev) => {
        if (prev.find((c) => c.id === comment.id)) return prev
        return [...prev, comment]
      })
    },
    [processId, taskId]
  )

  return { comments, isLoading, addComment, refetch: fetchComments }
}
