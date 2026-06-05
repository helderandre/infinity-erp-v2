'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { toast } from 'sonner'

interface UseTrainingLessonParams {
  courseId: string
  lessonId: string
}

interface HeartbeatPayload {
  delta_seconds: number
  position_seconds: number
  percent: number
}

interface MarkCompletedResult {
  ok: boolean
  error?: string
  currentPercent?: number
  requiredPercent?: number
}

interface UseTrainingLessonReturn {
  updateProgress: (data: {
    status?: 'in_progress' | 'completed'
    video_watched_seconds?: number
    video_watch_percent?: number
    time_spent_seconds?: number
  }) => Promise<void>
  sendHeartbeat: (data: HeartbeatPayload) => Promise<void>
  markCompleted: () => Promise<MarkCompletedResult>
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

  const sendHeartbeat = useCallback(async (data: HeartbeatPayload) => {
    try {
      await fetch(`/api/training/courses/${courseId}/lessons/${lessonId}/heartbeat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
    } catch (err) {
      // Heartbeat failures are non-fatal — just log
      console.debug('Heartbeat falhou (não crítico):', err)
    }
  }, [courseId, lessonId])

  const markCompleted = useCallback(async (): Promise<MarkCompletedResult> => {
    setIsSaving(true)
    try {
      // Cancel any pending debounced update
      if (debounceTimer.current) clearTimeout(debounceTimer.current)

      const res = await fetch(`/api/training/courses/${courseId}/lessons/${lessonId}/progress`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'completed' }),
      })
      if (res.ok) return { ok: true }

      const err = await res.json().catch(() => ({}))
      if (res.status === 403 && typeof err?.current_percent === 'number') {
        toast.error(
          err.error || 'Assista a pelo menos 90% do vídeo para concluir',
        )
        return {
          ok: false,
          error: err.error,
          currentPercent: err.current_percent,
          requiredPercent: err.required_percent,
        }
      }
      toast.error(err?.error || 'Erro ao marcar como concluída')
      return { ok: false, error: err?.error }
    } catch (err) {
      console.error('Erro ao marcar como concluído:', err)
      toast.error('Erro ao marcar como concluída')
      return { ok: false }
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

  return { updateProgress, sendHeartbeat, markCompleted, rateLesson, reportIssue, isSaving }
}
