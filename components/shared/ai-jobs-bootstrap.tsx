'use client'

import { useEffect } from 'react'
import { useAiJobs } from '@/hooks/use-ai-jobs'

/**
 * Monta-se uma vez no layout do dashboard. Ao carregar a app, lê os jobs
 * em curso (pending/running) do utilizador e restaura o cartão flutuante
 * de progresso — para que se o utilizador fechou o tab e voltou a abrir
 * (ou navegou para outra rota), continue a ver o trabalho a decorrer e
 * receba o aviso quando terminar.
 */
export function AiJobsBootstrap() {
  const { trackExisting } = useAiJobs()
  useEffect(() => {
    void trackExisting()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return null
}
