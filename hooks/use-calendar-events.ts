'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { toast } from 'sonner'
import type { CalendarEvent, CalendarCategory } from '@/types/calendar'

interface UseCalendarEventsParams {
  start: Date
  end: Date
  categories?: CalendarCategory[]
  userId?: string
}

interface UseCalendarEventsReturn {
  events: CalendarEvent[]
  isLoading: boolean
  error: string | null
  refetch: () => void
  createEvent: (data: any) => Promise<boolean>
  updateEvent: (id: string, data: any) => Promise<boolean>
  deleteEvent: (id: string) => Promise<boolean>
}

export function useCalendarEvents({
  start,
  end,
  categories,
  userId,
}: UseCalendarEventsParams): UseCalendarEventsReturn {
  const [events, setEvents] = useState<CalendarEvent[]>([])
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

      const res = await fetch(`/api/calendar/events?${params.toString()}`, {
        signal: controller.signal,
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || `Erro ${res.status}`)
      }

      const json = await res.json()
      const data: CalendarEvent[] = Array.isArray(json) ? json : (json.data ?? [])
      setEvents(data)
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

  return {
    events,
    isLoading,
    error,
    refetch: fetchEvents,
    createEvent,
    updateEvent,
    deleteEvent,
  }
}
