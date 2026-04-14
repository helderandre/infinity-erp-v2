'use client'

import { useCallback, useEffect, useState } from 'react'

import type { DocumentFolder } from '@/components/documents'
import {
  mapPropertyDocumentsToFolders,
  type PropertyDocumentsResponse,
} from '@/lib/documents/adapters/property'

type UsePropertyDocumentsResult = {
  folders: DocumentFolder[]
  raw: PropertyDocumentsResponse | null
  isLoading: boolean
  error: Error | null
  refetch: () => Promise<void>
}

export function usePropertyDocuments(propertyId: string): UsePropertyDocumentsResult {
  const [raw, setRaw] = useState<PropertyDocumentsResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const fetchDocs = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/properties/${propertyId}/documents`)
      if (!res.ok) throw new Error(`${res.status}`)
      const data = (await res.json()) as PropertyDocumentsResponse
      setRaw(data)
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Erro ao carregar documentos'))
    } finally {
      setIsLoading(false)
    }
  }, [propertyId])

  useEffect(() => {
    if (!propertyId) return
    void fetchDocs()
  }, [propertyId, fetchDocs])

  const folders = raw ? mapPropertyDocumentsToFolders(raw) : []

  return { folders, raw, isLoading, error, refetch: fetchDocs }
}
