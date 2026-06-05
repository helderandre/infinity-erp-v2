'use client'

import { useState, useEffect, useCallback } from 'react'

interface EmailTemplateDetail {
  id: string
  name: string
  subject: string
  description: string | null
  body_html: string
  editor_state: unknown | null
  created_at: string | null
  updated_at: string | null
}

export function useEmailTemplate(id: string | undefined) {
  const [template, setTemplate] = useState<EmailTemplateDetail | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchTemplate = useCallback(async () => {
    if (!id) {
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/libraries/emails/${id}`)
      if (!res.ok) {
        if (res.status === 404) throw new Error('Template não encontrado')
        throw new Error('Erro ao carregar template')
      }

      const data = await res.json()
      setTemplate(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido')
      setTemplate(null)
    } finally {
      setIsLoading(false)
    }
  }, [id])

  useEffect(() => {
    fetchTemplate()
  }, [fetchTemplate])

  return { template, isLoading, error, refetch: fetchTemplate }
}
