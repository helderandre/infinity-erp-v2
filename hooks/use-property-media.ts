'use client'

import { useState, useEffect, useCallback } from 'react'
import type { PropertyMedia } from '@/types/property'

interface UsePropertyMediaReturn {
  media: PropertyMedia[]
  isUploading: boolean
  uploadImages: (files: File[]) => Promise<void>
  deleteImage: (mediaId: string) => Promise<void>
  setCover: (mediaId: string) => Promise<void>
  reorderImages: (items: PropertyMedia[]) => Promise<void>
  refetch: () => void
}

export function usePropertyMedia(propertyId: string | undefined): UsePropertyMediaReturn {
  const [media, setMedia] = useState<PropertyMedia[]>([])
  const [isUploading, setIsUploading] = useState(false)

  const fetchMedia = useCallback(async () => {
    if (!propertyId) return
    try {
      const res = await fetch(`/api/properties/${propertyId}/media`)
      if (res.ok) {
        const data = await res.json()
        setMedia(data || [])
      }
    } catch (err) {
      console.error('Erro ao carregar media:', err)
    }
  }, [propertyId])

  useEffect(() => {
    fetchMedia()
  }, [fetchMedia])

  const uploadImages = useCallback(
    async (files: File[]) => {
      if (!propertyId) return
      setIsUploading(true)
      try {
        for (const file of files) {
          const formData = new FormData()
          formData.append('file', file)

          const res = await fetch(`/api/properties/${propertyId}/media`, {
            method: 'POST',
            body: formData,
          })

          if (!res.ok) {
            const err = await res.json()
            throw new Error(err.error || 'Erro ao fazer upload')
          }
        }
        await fetchMedia()
      } finally {
        setIsUploading(false)
      }
    },
    [propertyId, fetchMedia]
  )

  const deleteImage = useCallback(
    async (mediaId: string) => {
      if (!propertyId) return
      const res = await fetch(`/api/properties/${propertyId}/media/${mediaId}`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Erro ao eliminar imagem')
      }
      await fetchMedia()
    },
    [propertyId, fetchMedia]
  )

  const setCover = useCallback(
    async (mediaId: string) => {
      if (!propertyId) return
      const res = await fetch(`/api/properties/${propertyId}/media/${mediaId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_cover: true }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Erro ao definir capa')
      }
      await fetchMedia()
    },
    [propertyId, fetchMedia]
  )

  const reorderImages = useCallback(
    async (items: PropertyMedia[]) => {
      if (!propertyId) return

      // Optimistic update
      setMedia(items)

      const reorderData = items.map((item, index) => ({
        id: item.id,
        order_index: index,
      }))

      const res = await fetch(`/api/properties/${propertyId}/media/reorder`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: reorderData }),
      })

      if (!res.ok) {
        // Revert on failure
        await fetchMedia()
        const err = await res.json()
        throw new Error(err.error || 'Erro ao reordenar imagens')
      }
    },
    [propertyId, fetchMedia]
  )

  return {
    media,
    isUploading,
    uploadImages,
    deleteImage,
    setCover,
    reorderImages,
    refetch: fetchMedia,
  }
}
