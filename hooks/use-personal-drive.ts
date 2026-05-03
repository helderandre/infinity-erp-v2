'use client'

import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { useImageCompress } from './use-image-compress'

export interface PersonalDriveItem {
  id: string
  parent_id: string | null
  is_folder: boolean
  name: string
  file_path: string | null
  file_url: string | null
  mime_type: string | null
  file_size: number | null
  scope: 'global' | 'personal'
  owner_id: string | null
  sort_order: number
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface DriveBreadcrumb {
  id: string
  name: string
}

export interface DriveUsage {
  used_bytes: number
  limit_bytes: number
  file_count: number
}

interface ListResponse {
  items: PersonalDriveItem[]
  breadcrumbs: DriveBreadcrumb[]
}

const DRIVE_SCOPE = 'personal' as const

export function usePersonalDrive(parentId: string | null) {
  const [items, setItems] = useState<PersonalDriveItem[]>([])
  const [breadcrumbs, setBreadcrumbs] = useState<DriveBreadcrumb[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [usage, setUsage] = useState<DriveUsage | null>(null)
  const { compressImage } = useImageCompress()

  const fetchItems = useCallback(async () => {
    setIsLoading(true)
    try {
      const url = new URL('/api/marketing/recursos', window.location.origin)
      url.searchParams.set('scope', DRIVE_SCOPE)
      if (parentId) url.searchParams.set('parent_id', parentId)
      const res = await fetch(url.toString(), { cache: 'no-store' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = (await res.json()) as ListResponse
      setItems(json.items)
      setBreadcrumbs(json.breadcrumbs)
    } catch {
      setItems([])
      setBreadcrumbs([])
    } finally {
      setIsLoading(false)
    }
  }, [parentId])

  const fetchUsage = useCallback(async () => {
    try {
      const res = await fetch('/api/marketing/recursos/usage', { cache: 'no-store' })
      if (!res.ok) return
      const json = (await res.json()) as DriveUsage
      setUsage(json)
    } catch {
      // best-effort
    }
  }, [])

  useEffect(() => {
    fetchItems()
  }, [fetchItems])

  useEffect(() => {
    fetchUsage()
  }, [fetchUsage])

  const createFolder = useCallback(
    async (name: string) => {
      const res = await fetch('/api/marketing/recursos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, parent_id: parentId, scope: DRIVE_SCOPE }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        toast.error(err.error || 'Erro ao criar pasta')
        return null
      }
      const created: PersonalDriveItem = await res.json()
      toast.success('Pasta criada')
      await fetchItems()
      return created
    },
    [parentId, fetchItems],
  )

  const uploadFiles = useCallback(
    async (files: File[]) => {
      let uploaded = 0
      let failed = 0
      const toastId = toast.loading(`A preparar ${files.length} ficheiro${files.length === 1 ? '' : 's'}...`)

      // Compress images upfront (parallel up to 2 at a time inside the hook).
      const prepared: File[] = []
      for (const f of files) {
        if (f.type.startsWith('image/')) {
          try {
            prepared.push(await compressImage(f))
          } catch {
            // If compression fails, fall back to the original file.
            prepared.push(f)
          }
        } else {
          prepared.push(f)
        }
      }

      for (const file of prepared) {
        const fd = new FormData()
        fd.append('file', file)
        fd.append('scope', DRIVE_SCOPE)
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
        toast.loading(`A carregar ${uploaded + failed} / ${files.length}...`, { id: toastId })
      }

      if (failed === 0) {
        toast.success(
          `${uploaded} ficheiro${uploaded === 1 ? '' : 's'} carregado${uploaded === 1 ? '' : 's'}`,
          { id: toastId },
        )
      } else {
        toast.warning(
          `${uploaded} carregado${uploaded === 1 ? '' : 's'}, ${failed} falhado${failed === 1 ? '' : 's'}`,
          { id: toastId },
        )
      }

      await Promise.all([fetchItems(), fetchUsage()])
    },
    [parentId, compressImage, fetchItems, fetchUsage],
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
      await fetchItems()
    },
    [fetchItems],
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
      await Promise.all([fetchItems(), fetchUsage()])
    },
    [fetchItems, fetchUsage],
  )

  return {
    items,
    breadcrumbs,
    isLoading,
    usage,
    refetch: fetchItems,
    refetchUsage: fetchUsage,
    createFolder,
    uploadFiles,
    renameItem,
    deleteItem,
  }
}
