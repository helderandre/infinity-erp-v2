'use client'

import { useCallback, useEffect, useState } from 'react'

import type { DocumentFolder } from '@/components/documents'

type RawFolder = {
  id: string
  docTypeId: string | null
  name: string
  category: string
  files: Array<{
    id: string
    name: string
    url: string
    mimeType: string
    size: number
    uploadedAt: string
    uploadedBy: null
    validUntil?: string | null
    notes?: string | null
  }>
  hasExpiry: boolean
  expiresAt: string | null
  isCustom: boolean
}

type ApiResponse = {
  folders: RawFolder[]
}

type UseLeadDocumentsResult = {
  folders: DocumentFolder[]
  isLoading: boolean
  error: Error | null
  refetch: () => Promise<void>
}

export function useLeadDocuments(leadId: string): UseLeadDocumentsResult {
  const [folders, setFolders] = useState<DocumentFolder[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const refetch = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/leads/${leadId}/attachments`)
      if (!res.ok) throw new Error(`${res.status}`)
      const data = (await res.json()) as ApiResponse
      setFolders(data.folders ?? [])
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Erro ao carregar anexos'))
    } finally {
      setIsLoading(false)
    }
  }, [leadId])

  useEffect(() => {
    if (!leadId) return
    void refetch()
  }, [leadId, refetch])

  return { folders, isLoading, error, refetch }
}
