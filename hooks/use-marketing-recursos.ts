'use client'

import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'

export interface MarketingResource {
  id: string
  parent_id: string | null
  is_folder: boolean
  name: string
  file_path: string | null
  file_url: string | null
  mime_type: string | null
  file_size: number | null
  sort_order: number
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface RecursosBreadcrumb {
  id: string
  name: string
}

interface RecursosResponse {
  items: MarketingResource[]
  breadcrumbs: RecursosBreadcrumb[]
}

export function useMarketingRecursos(parentId: string | null) {
  const [items, setItems] = useState<MarketingResource[]>([])
  const [breadcrumbs, setBreadcrumbs] = useState<RecursosBreadcrumb[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const url = new URL('/api/marketing/recursos', window.location.origin)
      if (parentId) url.searchParams.set('parent_id', parentId)
      const res = await fetch(url.toString(), { cache: 'no-store' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = (await res.json()) as RecursosResponse
      setItems(json.items)
      setBreadcrumbs(json.breadcrumbs)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar')
    } finally {
      setIsLoading(false)
    }
  }, [parentId])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const createFolder = useCallback(
    async (name: string) => {
      const res = await fetch('/api/marketing/recursos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, parent_id: parentId }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        toast.error(err.error || 'Erro ao criar pasta')
        return null
      }
      const created: MarketingResource = await res.json()
      toast.success('Pasta criada')
      await fetchData()
      return created
    },
    [parentId, fetchData],
  )

  const uploadFiles = useCallback(
    async (files: File[]) => {
      let uploaded = 0
      let failed = 0
      const toastId = toast.loading(`A carregar 0 / ${files.length}…`)
      for (const file of files) {
        const fd = new FormData()
        fd.append('file', file)
        if (parentId) fd.append('parent_id', parentId)
        try {
          const res = await fetch('/api/marketing/recursos/upload', {
            method: 'POST',
            body: fd,
          })
          if (!res.ok) {
            const err = await res.json().catch(() => ({}))
            failed++
            toast.error(`${file.name}: ${err.error || res.status}`)
          } else {
            uploaded++
          }
        } catch {
          failed++
        }
        toast.loading(`A carregar ${uploaded + failed} / ${files.length}…`, { id: toastId })
      }
      if (failed === 0) {
        toast.success(`${uploaded} ficheiro${uploaded === 1 ? '' : 's'} carregado${uploaded === 1 ? '' : 's'}`, { id: toastId })
      } else {
        toast.warning(`${uploaded} carregado${uploaded === 1 ? '' : 's'}, ${failed} falhado${failed === 1 ? '' : 's'}`, { id: toastId })
      }
      await fetchData()
    },
    [parentId, fetchData],
  )

  const renameItem = useCallback(
    async (id: string, name: string) => {
      const res = await fetch(`/api/marketing/recursos/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        toast.error(err.error || 'Erro ao renomear')
        return
      }
      toast.success('Renomeado')
      await fetchData()
    },
    [fetchData],
  )

  const deleteItem = useCallback(
    async (id: string) => {
      const res = await fetch(`/api/marketing/recursos/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        toast.error(err.error || 'Erro ao eliminar')
        return
      }
      toast.success('Eliminado')
      await fetchData()
    },
    [fetchData],
  )

  return {
    items,
    breadcrumbs,
    isLoading,
    error,
    refetch: fetchData,
    createFolder,
    uploadFiles,
    renameItem,
    deleteItem,
  }
}
