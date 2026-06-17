'use client'

/**
 * PREVIEW (descartável) do novo modelo plano de angariação — UM card com a
 * linha de passos + o detalhe do passo seleccionado + a vista de Atividade.
 * O mesmo <AngariacaoProcessPanel> é montado na página de imóvel (Processos).
 * Rota: /dashboard/processos/preview-timeline
 */

import { AngariacaoProcessPanel } from '@/components/processes/angariacao-timeline/angariacao-process-panel'

export default function PreviewTimelinePage() {
  return (
    <div className="mx-auto max-w-5xl p-4 sm:p-6">
      <AngariacaoProcessPanel />
    </div>
  )
}
