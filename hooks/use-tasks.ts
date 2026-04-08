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
}

export function useTasks(initialFilters?: TaskFilters, pageSize = 50): UseTasksReturn {
  const [tasks, setTasks] = useState<TaskWithRelations[]>([])
  const [total, setTotal] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filters, setFilters] = useState<TaskFilters>(initialFilters || {})
  const [page, setPage] = useState(1)

  const debouncedSearch = useDebounce(filters.search || '', 300)

  const fetchTasks = useCallback(async () => {
    setIsLoading(true)
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
      setIsLoading(false)
    }
  }, [filters.assigned_to, filters.created_by, filters.priority, filters.is_completed, filters.overdue, filters.entity_type, filters.entity_id, filters.source_filter, debouncedSearch, page, pageSize])

  useEffect(() => {
    fetchTasks()
  }, [fetchTasks])

  return {
    tasks,
    total,
    isLoading,
    error,
    filters,
    setFilters,
    refetch: fetchTasks,
    page,
    setPage,
    pageSize,
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

  const fetchStats = useCallback(async () => {
    setIsLoading(true)
    try {
      const params = userId ? `?user_id=${userId}` : ''
      const res = await fetch(`/api/tasks/stats${params}`)
      if (!res.ok) throw new Error('Erro ao carregar stats')
      const json = await res.json()
      setStats(json)
    } catch {
      setStats(null)
    } finally {
      setIsLoading(false)
    }
  }, [userId])

  useEffect(() => {
    fetchStats()
  }, [fetchStats])

  return { stats, isLoading, refetch: fetchStats }
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
