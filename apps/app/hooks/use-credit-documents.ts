'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import type { CreditDocument } from '@/types/credit'

interface UseCreditDocumentsReturn {
  documents: CreditDocument[]
  isLoading: boolean
  error: string | null
  progress: { total: number; completed: number; percentage: number }
  refetch: () => void
  addDocument: (data: Record<string, unknown>) => Promise<void>
  updateDocument: (docId: string, data: Record<string, unknown>) => Promise<void>
  deleteDocument: (docId: string) => Promise<void>
  populateFromBank: (bankId: string) => Promise<void>
}

export function useCreditDocuments(creditId: string | null): UseCreditDocumentsReturn {
  const [documents, setDocuments] = useState<CreditDocument[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchDocuments = useCallback(async () => {
    if (!creditId) return
    setIsLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/credit/${creditId}/documents`)
      if (!res.ok) throw new Error('Erro ao carregar documentos')
      const json = await res.json()
      setDocuments(json.data || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido')
    } finally {
      setIsLoading(false)
    }
  }, [creditId])

  useEffect(() => { fetchDocuments() }, [fetchDocuments])

  const progress = useMemo(() => {
    const total = documents.length
    const completed = documents.filter(d =>
      d.status === 'recebido' || d.status === 'validado'
    ).length
    return {
      total,
      completed,
      percentage: total > 0 ? Math.round((completed / total) * 100) : 0,
    }
  }, [documents])

  const addDocument = useCallback(async (data: Record<string, unknown>) => {
    if (!creditId) return
    const res = await fetch(`/api/credit/${creditId}/documents`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (!res.ok) {
      const json = await res.json()
      throw new Error(json.error || 'Erro ao adicionar documento')
    }
    await fetchDocuments()
  }, [creditId, fetchDocuments])

  const updateDocument = useCallback(async (docId: string, data: Record<string, unknown>) => {
    if (!creditId) return
    const res = await fetch(`/api/credit/${creditId}/documents/${docId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (!res.ok) {
      const json = await res.json()
      throw new Error(json.error || 'Erro ao actualizar documento')
    }
    await fetchDocuments()
  }, [creditId, fetchDocuments])

  const deleteDocument = useCallback(async (docId: string) => {
    if (!creditId) return
    const res = await fetch(`/api/credit/${creditId}/documents/${docId}`, { method: 'DELETE' })
    if (!res.ok) {
      const json = await res.json()
      throw new Error(json.error || 'Erro ao eliminar documento')
    }
    await fetchDocuments()
  }, [creditId, fetchDocuments])

  const populateFromBank = useCallback(async (bankId: string) => {
    if (!creditId) return
    const res = await fetch(`/api/credit/${creditId}/documents/populate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ banco_id: bankId }),
    })
    if (!res.ok) {
      const json = await res.json()
      throw new Error(json.error || 'Erro ao popular documentos')
    }
    await fetchDocuments()
  }, [creditId, fetchDocuments])

  return { documents, isLoading, error, progress, refetch: fetchDocuments, addDocument, updateDocument, deleteDocument, populateFromBank }
}
