'use client'

import { useState, useEffect } from 'react'

export interface TemplateVariable {
  id: string
  key: string
  label: string
  category: string
  source_entity: string
  source_table: string | null
  source_column: string | null
  format_type: string
  format_config: Record<string, unknown> | null
  static_value: string | null
  is_system: boolean
  is_active: boolean
  order_index: number
}

// In-memory cache shared across all hook instances
let cachedVariables: TemplateVariable[] | null = null
let fetchPromise: Promise<TemplateVariable[]> | null = null

async function fetchVariables(): Promise<TemplateVariable[]> {
  const res = await fetch('/api/libraries/variables')
  if (!res.ok) throw new Error('Erro ao carregar variáveis')
  return res.json()
}

/**
 * Hook to fetch template variables from the database.
 * Caches the result in memory so all components share the same data.
 * Call `refetch()` to force a fresh load (e.g. after creating a new variable).
 */
export function useTemplateVariables() {
  const [variables, setVariables] = useState<TemplateVariable[]>(cachedVariables || [])
  const [isLoading, setIsLoading] = useState(!cachedVariables)

  useEffect(() => {
    if (cachedVariables) {
      setVariables(cachedVariables)
      setIsLoading(false)
      return
    }

    if (!fetchPromise) {
      fetchPromise = fetchVariables()
    }

    fetchPromise
      .then((data) => {
        cachedVariables = data
        setVariables(data)
      })
      .catch(() => {
        // ignore — variables will be empty
      })
      .finally(() => {
        fetchPromise = null
        setIsLoading(false)
      })
  }, [])

  const refetch = async () => {
    setIsLoading(true)
    try {
      const data = await fetchVariables()
      cachedVariables = data
      setVariables(data)
    } catch {
      // ignore
    } finally {
      setIsLoading(false)
    }
  }

  /** Invalidate the cache — next hook mount will re-fetch */
  const invalidate = () => {
    cachedVariables = null
  }

  return { variables, isLoading, refetch, invalidate }
}
