'use client'

import { useCallback, useEffect, useState } from 'react'
import type { TaskListWithMeta } from '@/types/task-list'

interface Response {
  owned: TaskListWithMeta[]
  shared: TaskListWithMeta[]
}

export function useTaskLists() {
  const [data, setData] = useState<Response>({ owned: [], shared: [] })
  const [isLoading, setIsLoading] = useState(true)

  const fetchLists = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await fetch('/api/task-lists')
      if (!res.ok) throw new Error('Erro ao carregar listas')
      const json = await res.json()
      setData({ owned: json.owned || [], shared: json.shared || [] })
    } catch {
      setData({ owned: [], shared: [] })
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchLists()
  }, [fetchLists])

  return {
    owned: data.owned,
    shared: data.shared,
    isLoading,
    refetch: fetchLists,
  }
}

export function useTaskList(id: string | null) {
  const [list, setList] = useState<(TaskListWithMeta & { members?: any[] }) | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const fetchList = useCallback(async () => {
    if (!id) {
      setList(null)
      return
    }
    setIsLoading(true)
    try {
      const res = await fetch(`/api/task-lists/${id}`)
      if (!res.ok) throw new Error()
      setList(await res.json())
    } catch {
      setList(null)
    } finally {
      setIsLoading(false)
    }
  }, [id])

  useEffect(() => {
    fetchList()
  }, [fetchList])

  return { list, isLoading, refetch: fetchList }
}

export function useTaskListMutations() {
  const create = async (data: { name: string; color?: string }) => {
    const res = await fetch('/api/task-lists', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (!res.ok) {
      const err = await res.json()
      throw new Error(err.error || 'Erro ao criar lista')
    }
    return res.json()
  }

  const update = async (id: string, data: { name?: string; color?: string }) => {
    const res = await fetch(`/api/task-lists/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (!res.ok) {
      const err = await res.json()
      throw new Error(err.error || 'Erro ao actualizar lista')
    }
    return res.json()
  }

  const remove = async (id: string) => {
    const res = await fetch(`/api/task-lists/${id}`, { method: 'DELETE' })
    if (!res.ok) {
      const err = await res.json()
      throw new Error(err.error || 'Erro ao eliminar lista')
    }
    return res.json()
  }

  const addMember = async (listId: string, userId: string) => {
    const res = await fetch(`/api/task-lists/${listId}/shares`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId }),
    })
    if (!res.ok) {
      const err = await res.json()
      throw new Error(err.error || 'Erro ao adicionar membro')
    }
    return res.json()
  }

  const removeMember = async (listId: string, userId: string) => {
    const res = await fetch(`/api/task-lists/${listId}/shares/${userId}`, {
      method: 'DELETE',
    })
    if (!res.ok) {
      const err = await res.json()
      throw new Error(err.error || 'Erro ao remover membro')
    }
    return res.json()
  }

  return { create, update, remove, addMember, removeMember }
}
