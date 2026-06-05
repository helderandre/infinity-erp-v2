'use client'

import { useState, useEffect, useCallback } from 'react'
import type { AdminCommentWithDetails } from '@/types/training'

interface UseAdminCommentsParams {
  isResolved?: string
  courseId?: string
  page?: number
  limit?: number
}

export function useTrainingAdminComments(params: UseAdminCommentsParams = {}) {
  const [comments, setComments] = useState<AdminCommentWithDetails[]>([])
  const [total, setTotal] = useState(0)
  const [isLoading, setIsLoading] = useState(true)

  const fetchComments = useCallback(async () => {
    setIsLoading(true)
    try {
      const sp = new URLSearchParams()
      if (params.isResolved) sp.set('is_resolved', params.isResolved)
      if (params.courseId) sp.set('course_id', params.courseId)
      sp.set('page', String(params.page || 1))
      sp.set('limit', String(params.limit || 20))

      const res = await fetch(`/api/training/admin/comments?${sp}`)
      const json = await res.json()
      setComments(json.data || [])
      setTotal(json.total || 0)
    } finally {
      setIsLoading(false)
    }
  }, [params.isResolved, params.courseId, params.page, params.limit])

  useEffect(() => { fetchComments() }, [fetchComments])

  const replyToComment = useCallback(async (
    commentId: string,
    content: string,
    courseId: string,
    lessonId: string
  ) => {
    const res = await fetch(`/api/training/courses/${courseId}/lessons/${lessonId}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content, parent_id: commentId }),
    })
    if (!res.ok) throw new Error('Erro ao responder comentário')
    await fetchComments()
  }, [fetchComments])

  const toggleResolved = useCallback(async (commentId: string) => {
    const res = await fetch(`/api/training/comments/${commentId}/resolve`, {
      method: 'PUT',
    })
    if (!res.ok) throw new Error('Erro ao resolver comentário')
    await fetchComments()
  }, [fetchComments])

  return { comments, total, isLoading, refetch: fetchComments, replyToComment, toggleResolved }
}
