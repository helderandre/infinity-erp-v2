'use client'

import { useCallback, useEffect, useState } from 'react'

import type { DocumentFolder } from '@/components/documents'

type ApiResponse = { folders: DocumentFolder[] }

type UseNegocioDocumentsResult = {
  folders: DocumentFolder[]
  isLoading: boolean
  error: Error | null
  refetch: () => Promise<void>
}

export function useNegocioDocuments(negocioId: string): UseNegocioDocumentsResult {
  const [folders, setFolders] = useState<DocumentFolder[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const refetch = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/negocios/${negocioId}/documents`)
      if (!res.ok) throw new Error(`${res.status}`)
      const data = (await res.json()) as ApiResponse
      setFolders(data.folders ?? [])
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Erro ao carregar documentos'))
    } finally {
      setIsLoading(false)
    }
  }, [negocioId])

  useEffect(() => {
    if (!negocioId) return
    void refetch()
  }, [negocioId, refetch])

  return { folders, isLoading, error, refetch }
}
