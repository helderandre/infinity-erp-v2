'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useAiBatchStore } from '@/stores/ai-batch-store'
import type { AiJobType } from '@/lib/validations/ai-jobs'

export interface AiJobRow {
  id: string
  type: AiJobType
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'
  payload: Record<string, any>
  result: Record<string, any> | null
  progress_done: number
  progress_total: number
  error_message: string | null
  property_id: string | null
  created_at: string
  started_at: string | null
  completed_at: string | null
}

const POLL_INTERVAL_MS = 4000

/**
 * Hook que liga um `ai_jobs` server-side ao floating-card local. Usa o
 * mesmo `useAiBatchStore` existente como fonte de UI (evita duplicar
 * componentes), mas alimenta a partir de polling no servidor — o que
 * permite ao trabalho continuar mesmo se o utilizador fechar a app.
 *
 * Uso típico:
 *   const { enqueue } = useAiJobs()
 *   await enqueue({ type: 'image_stage', property_id, payload: { media_ids, style } })
 *
 * O hook cria automaticamente uma row no store local para mostrar o
 * card. Ao montar a app, o `<AiJobsBootstrap>` pesquisa jobs em curso e
 * restaura o card.
 */
export function useAiJobs() {
  const { startJob, updateJob, finishJob } = useAiBatchStore()
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const trackedRef = useRef<Set<string>>(new Set())

  const pollJob = useCallback(async (jobId: string) => {
    try {
      const res = await fetch(`/api/ai-jobs/${jobId}`)
      if (!res.ok) return
      const { job } = await res.json()
      if (!job) return
      const completedUrls: string[] = Array.isArray(job.result?.completedUrls) ? job.result.completedUrls : []
      updateJob({
        done: job.progress_done,
        succeeded: job.result?.succeeded ?? 0,
        failed: job.result?.failed ?? 0,
        completedUrls,
      })
      if (job.status === 'completed' || job.status === 'failed' || job.status === 'cancelled') {
        finishJob()
        trackedRef.current.delete(jobId)
        if (trackedRef.current.size === 0 && pollTimerRef.current) {
          clearInterval(pollTimerRef.current)
          pollTimerRef.current = null
        }
      }
    } catch {
      // soft-fail; tentamos no próximo tick
    }
  }, [updateJob, finishJob])

  const ensurePoller = useCallback(() => {
    if (pollTimerRef.current) return
    pollTimerRef.current = setInterval(() => {
      for (const id of trackedRef.current) {
        void pollJob(id)
      }
    }, POLL_INTERVAL_MS)
  }, [pollJob])

  useEffect(() => () => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current)
      pollTimerRef.current = null
    }
  }, [])

  /** Enfileira um job no servidor e começa a fazer polling. Retorna o
   *  id do job (útil para cancelamento). */
  const enqueue = useCallback(async (input: {
    type: AiJobType
    property_id: string
    payload: Record<string, any>
  }): Promise<string | null> => {
    try {
      const res = await fetch('/api/ai-jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Erro ao enfileirar trabalho')
      }
      const { job } = await res.json()
      if (!job?.id) return null

      // Espelhar no store local para o cartão flutuante mostrar de imediato.
      const total = job.progress_total ?? 1
      const storeType = mapToStoreType(input.type)
      startJob(input.property_id, storeType, total, input.payload?.style)

      trackedRef.current.add(job.id)
      ensurePoller()
      return job.id
    } catch (err) {
      console.error('[useAiJobs] enqueue erro:', err)
      return null
    }
  }, [startJob, ensurePoller])

  /** Restaura tracking de jobs em curso (chamado ao montar a app). */
  const trackExisting = useCallback(async () => {
    try {
      const res = await fetch('/api/ai-jobs?status=pending,running')
      if (!res.ok) return
      const { jobs } = (await res.json()) as { jobs: AiJobRow[] }
      if (!Array.isArray(jobs) || jobs.length === 0) return
      // Apenas o mais recente é representado no card (o store guarda 1 job
      // de cada vez); jobs adicionais ficam invisíveis até o primeiro
      // terminar — aceitável para v1.
      const latest = jobs[0]
      const total = latest.progress_total ?? 1
      const storeType = mapToStoreType(latest.type)
      startJob(latest.property_id ?? '', storeType, total, latest.payload?.style)
      updateJob({
        done: latest.progress_done ?? 0,
        succeeded: latest.result?.succeeded ?? 0,
        failed: latest.result?.failed ?? 0,
        completedUrls: Array.isArray(latest.result?.completedUrls) ? latest.result.completedUrls : [],
      })
      trackedRef.current.add(latest.id)
      ensurePoller()
    } catch {
      // silent
    }
  }, [startJob, updateJob, ensurePoller])

  return { enqueue, trackExisting }
}

/** Map AiJobType → tipo do store local (que tem união ligeiramente
 *  diferente). image_enhance e video_compress fazem fallback decente. */
function mapToStoreType(t: AiJobType): 'stage' | 'enhance' | 'lighting' | 'planta_3d' {
  if (t === 'image_stage') return 'stage'
  if (t === 'planta_3d') return 'planta_3d'
  if (t === 'image_enhance') return 'enhance'
  return 'enhance'
}
