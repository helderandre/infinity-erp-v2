'use client'

import { useState, useCallback, useRef, useEffect } from 'react'

interface UseTrainingLessonParams {
  courseId: string
  lessonId: string
}

interface UseTrainingLessonReturn {
  updateProgress: (data: {
    status?: 'in_progress' | 'completed'
    video_watched_seconds?: number
    video_watch_percent?: number
    time_spent_seconds?: number
  }) => Promise<void>
  markCompleted: () => Promise<boolean>
  rateLesson: (rating: number) => Promise<boolean>
  reportIssue: (reason: string, comment?: string) => Promise<boolean>
  isSaving: boolean
}

export function useTrainingLesson({
  courseId,
  lessonId,
}: UseTrainingLessonParams): UseTrainingLessonReturn {
  const [isSaving, setIsSaving] = useState(false)
  const debounceTimer = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current)
    }
  }, [])

  const updateProgress = useCallback(async (data: {
    status?: 'in_progress' | 'completed'
    video_watched_seconds?: number
    video_watch_percent?: number
    time_spent_seconds?: number
  }) => {
    // Debounce progress updates (every 5 seconds max)
    if (debounceTimer.current) clearTimeout(debounceTimer.current)

    debounceTimer.current = setTimeout(async () => {
      try {
        await fetch(`/api/training/courses/${courseId}/lessons/${lessonId}/progress`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        })
      } catch (err) {
        console.error('Erro ao actualizar progresso:', err)
      }
    }, 5000)
  }, [courseId, lessonId])

  const markCompleted = useCallback(async (): Promise<boolean> => {
    setIsSaving(true)
    try {
      // Cancel any pending debounced update
      if (debounceTimer.current) clearTimeout(debounceTimer.current)

      const res = await fetch(`/api/training/courses/${courseId}/lessons/${lessonId}/progress`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'completed' }),
      })
      return res.ok
    } catch (err) {
      console.error('Erro ao marcar como concluído:', err)
      return false
    } finally {
      setIsSaving(false)
    }
  }, [courseId, lessonId])

  const rateLesson = useCallback(async (rating: number): Promise<boolean> => {
    try {
      const res = await fetch(`/api/training/lessons/${lessonId}/rate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating }),
      })
      return res.ok
    } catch (err) {
      console.error('Erro ao avaliar lição:', err)
      return false
    }
  }, [lessonId])

  const reportIssue = useCallback(async (reason: string, comment?: string): Promise<boolean> => {
    try {
      const res = await fetch(`/api/training/lessons/${lessonId}/report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason, comment }),
      })
      return res.ok
    } catch (err) {
      console.error('Erro ao reportar problema:', err)
      return false
    }
  }, [lessonId])

  return { updateProgress, markCompleted, rateLesson, reportIssue, isSaving }
}
