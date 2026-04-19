'use client'

import { useState, useEffect, useCallback } from 'react'
import type { PropertyMedia } from '@/types/property'

interface ClassifyResult {
  id: string
  room_type: string
  confidence: number
  error?: string
}

interface BulkClassifyResult {
  classified: number
  total: number
  results: ClassifyResult[]
}

interface AiImageResult {
  url: string
  style?: string
}

interface UsePropertyMediaReturn {
  media: PropertyMedia[]
  isUploading: boolean
  isClassifying: boolean
  uploadImages: (files: File[]) => Promise<void>
  deleteImage: (mediaId: string) => Promise<void>
  setCover: (mediaId: string) => Promise<void>
  reorderImages: (items: PropertyMedia[]) => Promise<void>
  classifyImage: (mediaId: string) => Promise<ClassifyResult>
  classifyAll: (force?: boolean) => Promise<BulkClassifyResult>
  stageImage: (mediaId: string, style: string) => Promise<AiImageResult>
  clearStagedVersion: (mediaId: string) => Promise<void>
  clearAllStagedVersions: (mediaIds?: string[]) => Promise<void>
  stageImageWithPrompt: (mediaId: string, style: string, customPrompt: string) => Promise<AiImageResult>
  refineImage: (mediaId: string, instructions: string) => Promise<AiImageResult>
  refetch: () => void
}

export function usePropertyMedia(propertyId: string | undefined): UsePropertyMediaReturn {
  const [media, setMedia] = useState<PropertyMedia[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const [isClassifying, setIsClassifying] = useState(false)

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

      const updatedItems = items.map((item, index) => ({ ...item, order_index: index }))
      const touchedIds = new Set(updatedItems.map((i) => i.id))

      setMedia((prev) => {
        const untouched = prev.filter((m) => !touchedIds.has(m.id))
        return [...updatedItems, ...untouched]
      })

      const reorderData = updatedItems.map(({ id, order_index }) => ({
        id,
        order_index: order_index ?? 0,
      }))

      const res = await fetch(`/api/properties/${propertyId}/media/reorder`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: reorderData }),
      })

      if (!res.ok) {
        await fetchMedia()
        const err = await res.json()
        throw new Error(err.error || 'Erro ao reordenar imagens')
      }
    },
    [propertyId, fetchMedia]
  )

  const classifyImage = useCallback(
    async (mediaId: string): Promise<ClassifyResult> => {
      if (!propertyId) throw new Error('No property ID')
      const res = await fetch(`/api/properties/${propertyId}/media/${mediaId}/classify`, {
        method: 'POST',
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Erro ao classificar imagem')
      }
      const data = await res.json()
      await fetchMedia()
      return { id: mediaId, room_type: data.ai_room_label, confidence: data.ai_room_confidence }
    },
    [propertyId, fetchMedia]
  )

  const classifyAll = useCallback(
    async (force = false): Promise<BulkClassifyResult> => {
      if (!propertyId) throw new Error('No property ID')
      setIsClassifying(true)
      try {
        const res = await fetch(`/api/properties/${propertyId}/media/classify`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ force }),
        })
        if (!res.ok) {
          const err = await res.json()
          throw new Error(err.error || 'Erro ao classificar imagens')
        }
        const data = await res.json()
        await fetchMedia()
        return data
      } finally {
        setIsClassifying(false)
      }
    },
    [propertyId, fetchMedia]
  )

  const stageImage = useCallback(
    async (mediaId: string, style: string): Promise<AiImageResult> => {
      if (!propertyId) throw new Error('No property ID')
      const res = await fetch(`/api/properties/${propertyId}/media/${mediaId}/stage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ style }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Erro ao decorar imagem')
      }
      const data = await res.json()
      await fetchMedia()
      return { url: data.ai_staged_url, style: data.ai_staged_style }
    },
    [propertyId, fetchMedia]
  )

  const stageImageWithPrompt = useCallback(
    async (mediaId: string, style: string, customPrompt: string): Promise<AiImageResult> => {
      if (!propertyId) throw new Error('No property ID')
      const res = await fetch(`/api/properties/${propertyId}/media/${mediaId}/stage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ style, customPrompt }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Erro ao decorar imagem')
      }
      const data = await res.json()
      await fetchMedia()
      return { url: data.ai_staged_url, style: data.ai_staged_style }
    },
    [propertyId, fetchMedia]
  )

  const refineImage = useCallback(
    async (mediaId: string, instructions: string): Promise<AiImageResult> => {
      if (!propertyId) throw new Error('No property ID')
      const res = await fetch(`/api/properties/${propertyId}/media/${mediaId}/refine`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instructions }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Erro ao refinar imagem')
      }
      const data = await res.json()
      await fetchMedia()
      return { url: data.url }
    },
    [propertyId, fetchMedia]
  )

  const clearStagedVersion = useCallback(
    async (mediaId: string) => {
      if (!propertyId) throw new Error('No property ID')
      const res = await fetch(`/api/properties/${propertyId}/media/${mediaId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ai_staged_url: null, ai_staged_style: null }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Erro ao eliminar versão IA')
      }
      await fetchMedia()
    },
    [propertyId, fetchMedia]
  )

  const clearAllStagedVersions = useCallback(
    async (mediaIds?: string[]) => {
      if (!propertyId) throw new Error('No property ID')
      const res = await fetch(`/api/properties/${propertyId}/media/clear-ai`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mediaIds }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Erro ao eliminar versões IA')
      }
      await fetchMedia()
    },
    [propertyId, fetchMedia]
  )

  return {
    media,
    isUploading,
    isClassifying,
    uploadImages,
    deleteImage,
    setCover,
    reorderImages,
    classifyImage,
    classifyAll,
    stageImage,
    stageImageWithPrompt,
    refineImage,
    clearStagedVersion,
    clearAllStagedVersions,
    refetch: fetchMedia,
  }
}
