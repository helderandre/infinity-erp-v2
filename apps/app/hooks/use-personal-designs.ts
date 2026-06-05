'use client'

import { useCallback, useEffect, useState } from 'react'

export interface PersonalDesign {
  id: string
  agent_id: string
  name: string
  description: string | null
  category_id: string | null
  file_path: string | null
  file_name: string | null
  file_size: number | null
  mime_type: string | null
  thumbnail_path: string | null
  canva_url: string | null
  sort_order: number
  created_at: string
  updated_at: string
  file_url: string | null
  thumbnail_url: string | null
  category?: {
    id: string
    slug: string
    label: string
    icon: string | null
    color: string | null
  } | null
}

export function usePersonalDesigns(agentId: string | null) {
  const [items, setItems] = useState<PersonalDesign[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const refetch = useCallback(async () => {
    if (!agentId) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/consultants/${agentId}/personal-designs`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = (await res.json()) as PersonalDesign[]
      setItems(Array.isArray(data) ? data : [])
    } catch (err) {
      console.error('Erro ao carregar designs pessoais:', err)
      setError(err instanceof Error ? err : new Error('Erro desconhecido'))
    } finally {
      setLoading(false)
    }
  }, [agentId])

  useEffect(() => {
    refetch()
  }, [refetch])

  const uploadDesign = useCallback(
    async (formData: FormData): Promise<PersonalDesign> => {
      if (!agentId) throw new Error('Sem utilizador')
      const res = await fetch(
        `/api/consultants/${agentId}/personal-designs/upload`,
        { method: 'POST', body: formData }
      )
      const body = await res.json()
      if (!res.ok) throw new Error(body.error || 'Erro ao carregar design')
      await refetch()
      return body as PersonalDesign
    },
    [agentId, refetch]
  )

  const createLinkDesign = useCallback(
    async (payload: {
      name: string
      category: string
      canva_url: string
      description?: string | null
      thumbnail_url?: string | null
    }): Promise<PersonalDesign> => {
      if (!agentId) throw new Error('Sem utilizador')
      const res = await fetch(`/api/consultants/${agentId}/personal-designs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error || 'Erro ao criar design')
      await refetch()
      return body as PersonalDesign
    },
    [agentId, refetch]
  )

  const updateDesign = useCallback(
    async (
      designId: string,
      payload: Partial<{
        name: string
        description: string | null
        category: string
        canva_url: string | null
        sort_order: number
      }>
    ): Promise<PersonalDesign> => {
      if (!agentId) throw new Error('Sem utilizador')
      const res = await fetch(
        `/api/consultants/${agentId}/personal-designs/${designId}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }
      )
      const body = await res.json()
      if (!res.ok) throw new Error(body.error || 'Erro ao actualizar design')
      await refetch()
      return body as PersonalDesign
    },
    [agentId, refetch]
  )

  const deleteDesign = useCallback(
    async (designId: string): Promise<void> => {
      if (!agentId) throw new Error('Sem utilizador')
      const res = await fetch(
        `/api/consultants/${agentId}/personal-designs/${designId}`,
        { method: 'DELETE' }
      )
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || 'Erro ao eliminar design')
      }
      await refetch()
    },
    [agentId, refetch]
  )

  return {
    items,
    loading,
    error,
    refetch,
    uploadDesign,
    createLinkDesign,
    updateDesign,
    deleteDesign,
  }
}
