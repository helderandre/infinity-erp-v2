'use client'

import { useCallback, useEffect, useState } from 'react'
import type { TaskWithRelations } from '@/types/task'
import { useDebounce } from '@/hooks/use-debounce'

interface TaskFilters {
  assigned_to?: string
  created_by?: string
  priority?: number
  is_completed?: 'true' | 'false'
  overdue?: 'true' | 'false'
  entity_type?: string
  entity_id?: string
  search?: string
  source_filter?: 'personal' | 'process'
  task_list_id?: string
}

interface UseTasksReturn {
  tasks: TaskWithRelations[]
  total: number
  isLoading: boolean
  error: string | null
  filters: TaskFilters
  setFilters: (filters: TaskFilters) => void
  refetch: () => void
  page: number
  setPage: (page: number) => void
  pageSize: number
  patchTaskLocal: (
    id: string,
    patch: Partial<TaskWithRelations>,
    opts?: { removeIfFiltered?: boolean },
  ) => void
  upsertTaskLocal: (task: TaskWithRelations) => void
}

interface UseTasksOptions {
  enabled?: boolean
  pageSize?: number
}

export function useTasks(initialFilters?: TaskFilters, options: UseTasksOptions | number = {}): UseTasksReturn {
  // Back-compat: legacy second arg was a number (pageSize)
  const opts: UseTasksOptions = typeof options === 'number' ? { pageSize: options } : options
  const enabled = opts.enabled ?? true
  const pageSize = opts.pageSize ?? 50

  const [tasks, setTasks] = useState<TaskWithRelations[]>([])
  const [total, setTotal] = useState(0)
  const [isLoading, setIsLoading] = useState(enabled)
  const [error, setError] = useState<string | null>(null)
  const [filters, setFilters] = useState<TaskFilters>(initialFilters || {})
  const [page, setPage] = useState(1)

  // Sync filters when the caller's initialFilters change content (e.g.,
  // navigating between task lists changes task_list_id). useState's
  // initial-value semantics would otherwise pin the first-render filters
  // forever, so refetch() and fetchTasks would query the stale list.
  // String-key dependency dedupes — the effect only re-runs when content
  // actually changes, not on every parent re-render.
  const initialFiltersKey = JSON.stringify(initialFilters ?? {})
  useEffect(() => {
    setFilters(JSON.parse(initialFiltersKey))
    setPage(1)
  }, [initialFiltersKey])

  const debouncedSearch = useDebounce(filters.search || '', 300)

  // `silent=true` pula o flag `isLoading`, evitando o flash de skeletons
  // quando o caller só quer reconciliar dados em background (ex.: após
  // marcar uma tarefa como concluída). O initial-load e mudanças de filtro
  // continuam a passar por aqui via useEffect com silent=false.
  const fetchTasks = useCallback(async (silent = false) => {
    if (!enabled) {
      setTasks([])
      setTotal(0)
      setIsLoading(false)
      return
    }
    if (!silent) setIsLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams()
      if (filters.assigned_to) params.set('assigned_to', filters.assigned_to)
      if (filters.created_by) params.set('created_by', filters.created_by)
      if (filters.priority) params.set('priority', String(filters.priority))
      if (filters.is_completed) params.set('is_completed', filters.is_completed)
      if (filters.overdue) params.set('overdue', filters.overdue)
      if (filters.entity_type) params.set('entity_type', filters.entity_type)
      if (filters.entity_id) params.set('entity_id', filters.entity_id)
      if (filters.source_filter) params.set('source_filter', filters.source_filter)
      if (filters.task_list_id) params.set('task_list_id', filters.task_list_id)
      if (debouncedSearch) params.set('search', debouncedSearch)
      params.set('limit', String(pageSize))
      params.set('offset', String((page - 1) * pageSize))

      const res = await fetch(`/api/tasks?${params}`)
      if (!res.ok) throw new Error('Erro ao carregar tarefas')

      const json = await res.json()
      setTasks(json.data || [])
      setTotal(json.total || 0)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido')
    } finally {
      if (!silent) setIsLoading(false)
    }
  }, [enabled, filters.assigned_to, filters.created_by, filters.priority, filters.is_completed, filters.overdue, filters.entity_type, filters.entity_id, filters.source_filter, filters.task_list_id, debouncedSearch, page, pageSize])

  useEffect(() => {
    fetchTasks()
  }, [fetchTasks])

  // `refetch` exposto é sempre silencioso — chamado após acções do utilizador
  // (toggle, save, delete) onde já temos o dado anterior em ecrã e queremos
  // reconciliar sem flash. Para forçar non-silent (raro), use fetchTasks
  // directamente via refetch indirecto.
  const refetch = useCallback(() => fetchTasks(true), [fetchTasks])

  // Mutador local optimístico — permite ao caller actualizar uma row sem
  // esperar pelo round-trip ao servidor. Útil para ticks de checkbox onde
  // queremos feedback imediato. Os campos em `patch` são merged sobre o
  // objecto existente; `removeIfFiltered` faz drop da row quando ela deixa
  // de bater no filtro do hook (ex.: marcaste completed e o filtro é
  // is_completed='false').
  const patchTaskLocal = useCallback(
    (
      id: string,
      patch: Partial<TaskWithRelations>,
      opts: { removeIfFiltered?: boolean } = {},
    ) => {
      setTasks((prev) => {
        const idx = prev.findIndex((t) => t.id === id)
        if (idx < 0) return prev
        const merged = { ...prev[idx], ...patch }
        // Se o filtro é por completion e a tarefa deixa de bater, remove.
        if (opts.removeIfFiltered && filters.is_completed) {
          const wantCompleted = filters.is_completed === 'true'
          if (!!merged.is_completed !== wantCompleted) {
            const next = [...prev]
            next.splice(idx, 1)
            return next
          }
        }
        const next = [...prev]
        next[idx] = merged
        return next
      })
    },
    [filters.is_completed],
  )

  // Insert local optimístico — usado para mover uma tarefa de um hook para
  // outro (ex.: lista activa → completedTab) sem refetch.
  const upsertTaskLocal = useCallback((task: TaskWithRelations) => {
    setTasks((prev) => {
      const idx = prev.findIndex((t) => t.id === task.id)
      if (idx >= 0) {
        const next = [...prev]
        next[idx] = task
        return next
      }
      return [task, ...prev]
    })
  }, [])

  return {
    tasks,
    total,
    isLoading,
    error,
    filters,
    setFilters,
    refetch,
    page,
    setPage,
    pageSize,
    patchTaskLocal,
    upsertTaskLocal,
  }
}

// ─── Task Stats Hook ─────────────────────────────────────────

interface TaskStats {
  pending: number
  overdue: number
  completed_today: number
  urgent: number
  upcoming: Array<{
    id: string
    title: string
    priority: number
    due_date: string
    entity_type: string | null
    entity_id: string | null
    assignee: { id: string; commercial_name: string } | null
  }>
}

export function useTaskStats(userId?: string | null) {
  const [stats, setStats] = useState<TaskStats | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const fetchStats = useCallback(async (silent = false) => {
    if (!silent) setIsLoading(true)
    try {
      const params = userId ? `?user_id=${userId}` : ''
      const res = await fetch(`/api/tasks/stats${params}`)
      if (!res.ok) throw new Error('Erro ao carregar stats')
      const json = await res.json()
      setStats(json)
    } catch {
      setStats(null)
    } finally {
      if (!silent) setIsLoading(false)
    }
  }, [userId])

  useEffect(() => {
    fetchStats()
  }, [fetchStats])

  // Refetch silencioso — chamado depois de acções do utilizador para evitar
  // que o card de stats pisque skeletons só para reconciliar.
  const refetch = useCallback(() => fetchStats(true), [fetchStats])

  return { stats, isLoading, refetch }
}

// ─── Single Task Mutations ───────────────────────────────────

export function useTaskMutations() {
  const createTask = async (data: Record<string, unknown>) => {
    const res = await fetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (!res.ok) {
      const err = await res.json()
      throw new Error(err.error || 'Erro ao criar tarefa')
    }
    return res.json()
  }

  const updateTask = async (id: string, data: Record<string, unknown>) => {
    const res = await fetch(`/api/tasks/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (!res.ok) {
      const err = await res.json()
      throw new Error(err.error || 'Erro ao actualizar tarefa')
    }
    return res.json()
  }

  const deleteTask = async (id: string) => {
    const res = await fetch(`/api/tasks/${id}`, { method: 'DELETE' })
    if (!res.ok) {
      const err = await res.json()
      throw new Error(err.error || 'Erro ao eliminar tarefa')
    }
    return res.json()
  }

  const toggleComplete = async (id: string, isCompleted: boolean) => {
    return updateTask(id, { is_completed: !isCompleted })
  }

  return { createTask, updateTask, deleteTask, toggleComplete }
}
