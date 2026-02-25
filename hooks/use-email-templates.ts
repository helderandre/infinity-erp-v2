'use client'

import { useState, useEffect, useCallback } from 'react'
import { useDebounce } from '@/hooks/use-debounce'

interface EmailTemplate {
  id: string
  name: string
  subject: string
  description: string | null
  created_at: string | null
  updated_at: string | null
}

export function useEmailTemplates(search: string = '') {
  const [templates, setTemplates] = useState<EmailTemplate[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const debouncedSearch = useDebounce(search, 300)

  const fetchTemplates = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (debouncedSearch) params.set('search', debouncedSearch)

      const res = await fetch(`/api/libraries/emails?${params.toString()}`)
      if (!res.ok) throw new Error('Erro ao carregar templates')

      const data = await res.json()
      setTemplates(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido')
      setTemplates([])
    } finally {
      setIsLoading(false)
    }
  }, [debouncedSearch])

  useEffect(() => {
    fetchTemplates()
  }, [fetchTemplates])

  return { templates, isLoading, error, refetch: fetchTemplates }
}
