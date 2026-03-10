'use client'

import { useState, useEffect, useCallback } from 'react'
import { useDebounce } from '@/hooks/use-debounce'
import type { DocumentFolder, ProcessDocumentsResponse } from '@/types/process'

interface UseProcessDocumentsParams {
  processId: string
  search?: string
}

interface UseProcessDocumentsReturn {
  folders: DocumentFolder[]
  stats: ProcessDocumentsResponse['stats']
  isLoading: boolean
  error: string | null
  refetch: () => void
}

export function useProcessDocuments({
  processId,
  search = '',
}: UseProcessDocumentsParams): UseProcessDocumentsReturn {
  const [folders, setFolders] = useState<DocumentFolder[]>([])
  const [stats, setStats] = useState<ProcessDocumentsResponse['stats']>({
    total_documents: 0,
    total_size_bytes: 0,
    by_status: {},
  })
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const debouncedSearch = useDebounce(search, 300)

  const fetchDocuments = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (debouncedSearch) params.set('search', debouncedSearch)

      const res = await fetch(`/api/processes/${processId}/documents?${params.toString()}`)
      if (!res.ok) throw new Error('Erro ao carregar documentos')

      const data: ProcessDocumentsResponse = await res.json()
      setFolders(data.folders || [])
      setStats(data.stats || { total_documents: 0, total_size_bytes: 0, by_status: {} })
    } catch (err) {
      console.error('Erro ao carregar documentos:', err)
      setError(err instanceof Error ? err.message : 'Erro desconhecido')
      setFolders([])
    } finally {
      setIsLoading(false)
    }
  }, [processId, debouncedSearch])

  useEffect(() => {
    fetchDocuments()
  }, [fetchDocuments])

  return { folders, stats, isLoading, error, refetch: fetchDocuments }
}
