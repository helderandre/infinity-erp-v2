'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { toast } from 'sonner'
import type { CalendarEvent, CalendarCategory } from '@/types/calendar'
import type { TaskWithRelations } from '@/types/task'

interface UseCalendarEventsParams {
  start: Date
  end: Date
  categories?: CalendarCategory[]
  userId?: string
}

interface UseCalendarEventsReturn {
  events: CalendarEvent[]
  tasks: TaskWithRelations[]
  isLoading: boolean
  error: string | null
  refetch: () => void
  createEvent: (data: any) => Promise<boolean>
  updateEvent: (id: string, data: any) => Promise<boolean>
  deleteEvent: (id: string) => Promise<boolean>
  toggleTaskComplete: (taskId: string, isCompleted: boolean) => Promise<void>
}

export function useCalendarEvents({
  start,
  end,
  categories,
  userId,
}: UseCalendarEventsParams): UseCalendarEventsReturn {
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [tasks, setTasks] = useState<TaskWithRelations[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Stabilize dependencies — convert to primitives
  const startISO = start.toISOString()
  const endISO = end.toISOString()
  const categoriesKey = categories?.sort().join(',') ?? ''

  const abortControllerRef = useRef<AbortController | null>(null)

  const fetchEvents = useCallback(async () => {
    // Cancel any in-flight request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }

    const controller = new AbortController()
    abortControllerRef.current = controller

    setIsLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams({ start: startISO, end: endISO })

      if (categoriesKey) {
        params.set('categories', categoriesKey)
      }

      if (userId) {
        params.set('user_id', userId)
      }

      // Fetch events + tasks in parallel. Tasks come from the dedicated
      // /api/tasks feed (personal tasks + proc_task/proc_subtask + visit_proposal).
      // Scope to the visible range + hide completed so a large process backlog
      // never pages out today's tasks. We apply the user filter client-side so
      // unassigned tasks the user created still show up under "Apenas os meus".
      const taskParams = new URLSearchParams({
        limit: '500',
        is_completed: 'false',
        due_from: startISO,
        due_to: endISO,
      })

      const [eventsRes, tasksRes] = await Promise.all([
        fetch(`/api/calendar/events?${params.toString()}`, { signal: controller.signal }),
        fetch(`/api/tasks?${taskParams.toString()}`, { signal: controller.signal }),
      ])

      if (!eventsRes.ok) {
        const body = await eventsRes.json().catch(() => ({}))
        throw new Error(body.error || `Erro ${eventsRes.status}`)
      }

      const json = await eventsRes.json()
      const data: CalendarEvent[] = Array.isArray(json) ? json : (json.data ?? [])
      // Tasks from /api/tasks now render in the calendar's task channel.
      // Hide the event-flavoured process_task/process_subtask duplicates so
      // process tasks only show up once (through the tasks pipe).
      setEvents(data.filter((e) => e.category !== 'process_task' && e.category !== 'process_subtask'))

      if (tasksRes.ok) {
        const tJson = await tasksRes.json()
        let tData: TaskWithRelations[] = tJson.data ?? []
        // Apply the user filter client-side: include tasks the user owns
        // (assigned_to === userId) OR created (created_by === userId).
        if (userId) {
          tData = tData.filter(
            (t) => t.assigned_to === userId || t.created_by === userId,
          )
        }
        setTasks(tData)
      } else {
        setTasks([])
      }
    } catch (err: any) {
      if (err?.name === 'AbortError') return
      const message = err?.message || 'Erro ao carregar eventos'
      setError(message)
      console.error('useCalendarEvents fetch error:', err)
    } finally {
      if (!controller.signal.aborted) {
        setIsLoading(false)
      }
    }
  }, [startISO, endISO, categoriesKey, userId])

  useEffect(() => {
    fetchEvents()

    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [fetchEvents])

  const createEvent = useCallback(
    async (data: any): Promise<boolean> => {
      try {
        const res = await fetch('/api/calendar/events', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        })

        if (!res.ok) {
          const body = await res.json().catch(() => ({}))
          throw new Error(body.error || 'Erro ao criar evento')
        }

        toast.success('Evento criado com sucesso')
        await fetchEvents()
        return true
      } catch (err: any) {
        toast.error(err?.message || 'Erro ao criar evento')
        return false
      }
    },
    [fetchEvents]
  )

  const updateEvent = useCallback(
    async (id: string, data: any): Promise<boolean> => {
      try {
        const res = await fetch(`/api/calendar/events/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        })

        if (!res.ok) {
          const body = await res.json().catch(() => ({}))
          throw new Error(body.error || 'Erro ao actualizar evento')
        }

        toast.success('Evento actualizado com sucesso')
        await fetchEvents()
        return true
      } catch (err: any) {
        toast.error(err?.message || 'Erro ao actualizar evento')
        return false
      }
    },
    [fetchEvents]
  )

  const deleteEvent = useCallback(
    async (id: string): Promise<boolean> => {
      try {
        const res = await fetch(`/api/calendar/events/${id}`, {
          method: 'DELETE',
        })

        if (!res.ok) {
          const body = await res.json().catch(() => ({}))
          throw new Error(body.error || 'Erro ao eliminar evento')
        }

        toast.success('Evento eliminado com sucesso')
        await fetchEvents()
        return true
      } catch (err: any) {
        toast.error(err?.message || 'Erro ao eliminar evento')
        return false
      }
    },
    [fetchEvents]
  )

  const toggleTaskComplete = useCallback(
    async (taskId: string, isCompleted: boolean) => {
      // Optimistic flip.
      setTasks((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, is_completed: !isCompleted } : t)),
      )
      try {
        const res = await fetch(`/api/tasks/${taskId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ is_completed: !isCompleted }),
        })
        if (!res.ok) throw new Error()
      } catch {
        // Revert on failure.
        setTasks((prev) =>
          prev.map((t) => (t.id === taskId ? { ...t, is_completed: isCompleted } : t)),
        )
        toast.error('Não foi possível actualizar a tarefa')
      }
    },
    [],
  )

  return {
    events,
    tasks,
    isLoading,
    error,
    refetch: fetchEvents,
    createEvent,
    updateEvent,
    deleteEvent,
    toggleTaskComplete,
  }
}
