'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

import { createClient } from '@/lib/supabase/client'

export type MetaSyncKind = 'campaigns' | 'insights'

interface JobRow {
  id: string
  status: 'running' | 'done' | 'error'
}

// Safety: limpa o estado "a correr" se nenhum update chegar (job preso por
// restart do servidor a meio, etc.). O sino global ainda avisa se concluir.
const STUCK_TIMEOUT_MS = 8 * 60 * 1000

/**
 * Dispara um meta sync job (campanhas/anúncios ou insights) sem bloquear e
 * subscreve o job via Realtime: quando conclui, refresca a página (update ao
 * vivo). O aviso (toast + sino) vem da subscrição global de notificações —
 * aqui só mostramos o "iniciado" e gerimos o estado do botão.
 */
export function useMetaSyncJob() {
  const router = useRouter()
  const [pendingKind, setPendingKind] = useState<MetaSyncKind | null>(null)
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
    async (kind: MetaSyncKind) => {
      if (pendingKind) return // já há um a correr neste cliente
      try {
        const res = await fetch('/api/integrations/meta/sync-jobs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ kind }),
        })
        if (!res.ok) {
          const { error } = await res.json().catch(() => ({ error: 'erro' }))
          toast.error('Não foi possível iniciar a sincronização', {
            description: errorLabel(error),
          })
          return
        }
        const { job_id } = (await res.json()) as { job_id: string }
        setPendingKind(kind)
        toast.info(
          kind === 'campaigns'
            ? 'A actualizar campanhas e anúncios…'
            : 'A actualizar desempenho…',
          { description: 'Avisamos quando terminar — podes sair desta página.' },
        )

        // Subscreve o job: quando o status muda, fecha o estado + refresca.
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
                setPendingKind(null)
                cleanup()
                router.refresh() // dados frescos do mirror aparecem na página
              } else if (row.status === 'error') {
                setPendingKind(null)
                cleanup()
              }
            },
          )
          .subscribe()
        channelRef.current = channel

        timeoutRef.current = setTimeout(() => {
          setPendingKind(null)
          cleanup()
        }, STUCK_TIMEOUT_MS)
      } catch {
        toast.error('Não foi possível iniciar a sincronização')
      }
    },
    [pendingKind, router, cleanup],
  )

  return { trigger, pendingKind }
}

function errorLabel(code: string): string {
  switch (code) {
    case 'forbidden':
      return 'Sem permissão (requer settings).'
    case 'unauthenticated':
      return 'Sessão expirada.'
    case 'job_create_failed':
      return 'Falha a criar o pedido.'
    default:
      return typeof code === 'string' ? code : 'Erro'
  }
}
