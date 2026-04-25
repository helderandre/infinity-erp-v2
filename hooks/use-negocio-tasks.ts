'use client'

import { useCallback, useEffect, useState } from 'react'

export interface NegocioTask {
  id: string
  title: string
  description: string | null
  due_date: string | null
  is_completed: boolean
  completed_at: string | null
  completed_by: string | null
  priority: number | null
  assigned_to: string | null
  created_at: string
  assignee?: { id: string; commercial_name: string | null } | null
  creator?: { id: string; commercial_name: string | null } | null
}

interface UseNegocioTasksResult {
  pending: NegocioTask[]
  completedRecent: NegocioTask[]
  isLoading: boolean
  error: string | null
  refetch: () => Promise<void>
  toggle: (taskId: string, nextCompleted: boolean) => Promise<void>
}

/**
 * Lista as tarefas (`tasks` table com entity_type='negocio') deste negócio,
 * separadas em pendentes e concluídas recentes.
 */
export function useNegocioTasks(
  negocioId: string | null | undefined,
): UseNegocioTasksResult {
  const [pending, setPending] = useState<NegocioTask[]>([])
  const [completedRecent, setCompletedRecent] = useState<NegocioTask[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(async () => {
    if (!negocioId) return
    setIsLoading(true)
    setError(null)
    try {
      const [pendingRes, doneRes] = await Promise.all([
        fetch(`/api/tasks?entity_type=negocio&entity_id=${negocioId}&is_completed=false&source_filter=personal&limit=20`),
        fetch(`/api/tasks?entity_type=negocio&entity_id=${negocioId}&is_completed=true&source_filter=personal&limit=20`),
      ])
      if (pendingRes.ok) {
        const json = await pendingRes.json()
        setPending(json.data || [])
      }
      if (doneRes.ok) {
        const json = await doneRes.json()
        setCompletedRecent(json.data || [])
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro')
    } finally {
      setIsLoading(false)
    }
  }, [negocioId])

  useEffect(() => {
    void refetch()
  }, [refetch])

  const toggle = useCallback(
    async (taskId: string, nextCompleted: boolean) => {
      // Optimistic move between buckets
      const moveTo = nextCompleted ? 'completed' : 'pending'
      const fromPending = pending.find((t) => t.id === taskId)
      const fromCompleted = completedRecent.find((t) => t.id === taskId)
      if (moveTo === 'completed' && fromPending) {
        const completedAt = new Date().toISOString()
        setPending((prev) => prev.filter((t) => t.id !== taskId))
        setCompletedRecent((prev) => [{ ...fromPending, is_completed: true, completed_at: completedAt }, ...prev])
      } else if (moveTo === 'pending' && fromCompleted) {
        setCompletedRecent((prev) => prev.filter((t) => t.id !== taskId))
        setPending((prev) => [{ ...fromCompleted, is_completed: false, completed_at: null }, ...prev])
      }

      try {
        const res = await fetch(`/api/tasks/${taskId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ is_completed: nextCompleted }),
        })
        if (!res.ok) throw new Error()
      } catch {
        // Revert
        await refetch()
      }
    },
    [pending, completedRecent, refetch],
  )

  return { pending, completedRecent, isLoading, error, refetch, toggle }
}
