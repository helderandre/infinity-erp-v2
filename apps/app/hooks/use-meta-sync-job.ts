'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

import { createClient } from '@/lib/supabase/client'

export type SyncResource =
  | 'forms'
  | 'campaigns'
  | 'ads'
  | 'creatives'
  | 'leads'
  | 'insights'

interface JobRow {
  id: string
  status: 'running' | 'done' | 'error'
}

// Safety: limpa o estado "a correr" se nenhum update chegar (job preso por
// restart do servidor, sync muito longo, etc.). O sino global ainda avisa.
const STUCK_TIMEOUT_MS = 15 * 60 * 1000

/**
 * Dispara um meta sync job (recursos + período escolhidos) sem bloquear e
 * subscreve o job via Realtime: quando conclui, refresca a página (update ao
 * vivo). O aviso (toast + sino) vem da subscrição global de notificações —
 * aqui só mostramos o "iniciado" e gerimos o estado de "a correr".
 */
export function useMetaSyncJob() {
  const router = useRouter()
  const [running, setRunning] = useState(false)
  const channelRef = useRef<ReturnType<ReturnType<typeof createClient>['channel']> | null>(null)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const cleanup = useCallback(() => {
    if (channelRef.current) {
      createClient().removeChannel(channelRef.current)
      channelRef.current = null
    }
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
  }, [])

  useEffect(() => cleanup, [cleanup])

  const trigger = useCallback(
    async (resources: SyncResource[], since: string | null) => {
      if (running) return
      if (resources.length === 0) {
        toast.error('Selecciona pelo menos um tipo de dados.')
        return
      }
      try {
        const res = await fetch('/api/integrations/meta/sync-jobs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ resources, since }),
        })
        if (!res.ok) {
          const { error } = await res.json().catch(() => ({ error: 'erro' }))
          toast.error('Não foi possível iniciar a sincronização', {
            description: errorLabel(error),
          })
          return
        }
        const { job_id } = (await res.json()) as { job_id: string }
        setRunning(true)
        toast.info('Sincronização iniciada…', {
          description: 'Avisamos quando terminar — podes sair desta página.',
        })

        const supabase = createClient()
        const channel = supabase
          .channel(`meta-sync-job-${job_id}`)
          .on(
            'postgres_changes',
            {
              event: 'UPDATE',
              schema: 'public',
              table: 'meta_sync_jobs',
              filter: `id=eq.${job_id}`,
            },
            (payload) => {
              const row = payload.new as JobRow
              if (row.status === 'done') {
                setRunning(false)
                cleanup()
                router.refresh() // dados frescos do mirror aparecem na página
              } else if (row.status === 'error') {
                setRunning(false)
                cleanup()
              }
            },
          )
          .subscribe()
        channelRef.current = channel

        timeoutRef.current = setTimeout(() => {
          setRunning(false)
          cleanup()
        }, STUCK_TIMEOUT_MS)
      } catch {
        toast.error('Não foi possível iniciar a sincronização')
      }
    },
    [running, router, cleanup],
  )

  return { trigger, running }
}

function errorLabel(code: string): string {
  switch (code) {
    case 'forbidden':
      return 'Sem permissão (requer settings).'
    case 'unauthenticated':
      return 'Sessão expirada.'
    case 'invalid_resources':
      return 'Selecção de dados inválida.'
    case 'invalid_since':
      return 'Data inválida.'
    case 'job_create_failed':
      return 'Falha a criar o pedido.'
    default:
      return typeof code === 'string' ? code : 'Erro'
  }
}
