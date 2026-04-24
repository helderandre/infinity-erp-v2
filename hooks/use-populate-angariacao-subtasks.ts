'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'

interface PopulateResult {
  ok: boolean
  inserted: number
  skipped: number
  failed: number
}

interface PopulateErrorResult {
  ok: false
  error: string
  status: number
}

type RunResult = PopulateResult | PopulateErrorResult

interface UsePopulateAngariacaoSubtasksOptions {
  /** Mostrar toast em caso de sucesso. Default: true. */
  toastOnSuccess?: boolean
  /** Mostrar toast em caso de erro. Default: true. */
  toastOnError?: boolean
  /**
   * Activar `beforeunload` listener durante a chamada. Evita que o
   * utilizador feche o tab a meio. Default: true.
   */
  preventUnload?: boolean
}

/**
 * Hook que invoca `POST /api/processes/[id]/subtasks/populate-angariacao`,
 * gere estado de overlay e attach/detach de `beforeunload`.
 *
 * Retry do consultor: safe — o endpoint é idempotente via
 * `proc_subtasks_dedup`. Rascunhos com populate falhado parcialmente
 * ficam completos numa segunda chamada.
 */
export function usePopulateAngariacaoSubtasks(
  options: UsePopulateAngariacaoSubtasksOptions = {}
) {
  const {
    toastOnSuccess = true,
    toastOnError = true,
    preventUnload = true,
  } = options

  const [isRunning, setIsRunning] = useState(false)
  const [lastResult, setLastResult] = useState<RunResult | null>(null)
  const isMounted = useRef(true)

  useEffect(() => {
    return () => {
      isMounted.current = false
    }
  }, [])

  useEffect(() => {
    if (!preventUnload || !isRunning) return
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
      return ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [preventUnload, isRunning])

  const run = useCallback(
    async (processId: string): Promise<RunResult> => {
      if (!processId) {
        return { ok: false, error: 'processId vazio', status: 400 }
      }

      setIsRunning(true)
      try {
        const res = await fetch(
          `/api/processes/${processId}/subtasks/populate-angariacao`,
          { method: 'POST' }
        )
        const body = await res.json().catch(() => ({}))

        if (!res.ok) {
          const err: PopulateErrorResult = {
            ok: false,
            error: body?.error || 'Erro ao preparar subtarefas',
            status: res.status,
          }
          if (isMounted.current) setLastResult(err)
          if (toastOnError) {
            toast.error(
              'Erro ao preparar subtarefas. Angariação guardada como rascunho.'
            )
          }
          return err
        }

        const success: PopulateResult = {
          ok: true,
          inserted: Number(body?.inserted ?? 0),
          skipped: Number(body?.skipped ?? 0),
          failed: Number(body?.failed ?? 0),
        }
        if (isMounted.current) setLastResult(success)
        if (toastOnSuccess && success.inserted > 0) {
          toast.success(`Subtarefas preparadas (${success.inserted})`)
        }
        return success
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Erro de rede'
        const errResult: PopulateErrorResult = { ok: false, error: msg, status: 0 }
        if (isMounted.current) setLastResult(errResult)
        if (toastOnError) {
          toast.error('Erro ao preparar subtarefas. Angariação guardada como rascunho.')
        }
        return errResult
      } finally {
        if (isMounted.current) setIsRunning(false)
      }
    },
    [toastOnError, toastOnSuccess]
  )

  return {
    run,
    isRunning,
    lastResult,
  }
}
