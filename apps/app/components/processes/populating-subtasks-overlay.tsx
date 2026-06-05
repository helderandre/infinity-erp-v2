'use client'

import { Loader2 } from 'lucide-react'

interface PopulatingSubtasksOverlayProps {
  open: boolean
  message?: string
}

/**
 * Overlay bloqueante enquanto o endpoint `populate-angariacao` corre.
 *
 * Consumido pelo `usePopulateAngariacaoSubtasks()` hook. O caller controla
 * `open`; o hook expõe-o para o consumidor renderizar no sítio certo da
 * árvore (ex.: a seguir ao `<AcquisitionForm>` ou no `<ProcessDetail>`).
 *
 * Complementar ao overlay: o hook adiciona `beforeunload` ao window
 * para alertar contra navegação acidental.
 */
export function PopulatingSubtasksOverlay({
  open,
  message = 'A preparar subtarefas...',
}: PopulatingSubtasksOverlayProps) {
  if (!open) return null

  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className="fixed inset-0 z-[999] flex items-center justify-center bg-background/85 backdrop-blur-xl animate-in fade-in duration-200"
    >
      <div className="flex flex-col items-center gap-4 rounded-2xl border bg-card px-10 py-8 shadow-xl">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <div className="text-center">
          <p className="text-base font-medium">{message}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Não feche nem actualize esta janela.
          </p>
        </div>
      </div>
    </div>
  )
}
