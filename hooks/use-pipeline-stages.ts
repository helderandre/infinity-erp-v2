'use client'

import { useEffect, useState } from 'react'

export interface PipelineStage {
  id: string
  name: string
  color: string | null
  order_index: number
  is_terminal: boolean
  terminal_type: 'won' | 'lost' | null
  pipeline_type: 'comprador' | 'vendedor' | 'arrendatario' | 'arrendador'
}

// Module-level cache — the list is small (~40 rows) and stable within a session.
let cached: PipelineStage[] | null = null
let inflight: Promise<PipelineStage[]> | null = null

async function fetchStages(): Promise<PipelineStage[]> {
  if (cached) return cached
  if (inflight) return inflight
  inflight = (async () => {
    const res = await fetch('/api/crm/pipeline-stages')
    if (!res.ok) {
      inflight = null
      throw new Error('Erro ao carregar fases do pipeline')
    }
    const data: PipelineStage[] = await res.json()
    cached = data
    inflight = null
    return data
  })()
  return inflight
}

export function usePipelineStages() {
  const [stages, setStages] = useState<PipelineStage[]>(cached ?? [])
  const [isLoading, setIsLoading] = useState(!cached)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (cached) return
    let mounted = true
    fetchStages()
      .then((data) => {
        if (mounted) {
          setStages(data)
          setIsLoading(false)
        }
      })
      .catch((err) => {
        if (mounted) {
          setError(err instanceof Error ? err.message : 'Erro desconhecido')
          setIsLoading(false)
        }
      })
    return () => { mounted = false }
  }, [])

  return { stages, isLoading, error }
}
