'use client'

import { RefreshCw, Megaphone, BarChart3 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { useMetaSyncJob } from '@/hooks/use-meta-sync-job'

/**
 * Botões "Atualizar agora" para a Análise Meta. Disparam um sync job
 * fire-and-forget (não bloqueiam) e o resultado chega via Realtime + sino:
 *   - campaigns: força sync da connection (descobre campanhas/anúncios novos).
 *   - performance: força re-pull dos insights + espelha no mirror local.
 *
 * Ver hooks/use-meta-sync-job.ts. `show` controla quais botões aparecem
 * (detalhe de campanha/ad só mostra performance).
 */
export function MetaRefreshButtons({
  show = 'both',
}: {
  show?: 'both' | 'campaigns' | 'performance'
}) {
  const { trigger, pendingKind } = useMetaSyncJob()

  return (
    <div className="flex flex-wrap items-center gap-2">
      {(show === 'both' || show === 'campaigns') && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => trigger('campaigns')}
          disabled={pendingKind !== null}
        >
          {pendingKind === 'campaigns' ? (
            <RefreshCw className="mr-1.5 h-4 w-4 animate-spin" />
          ) : (
            <Megaphone className="mr-1.5 h-4 w-4" />
          )}
          Atualizar campanhas/anúncios
        </Button>
      )}
      {(show === 'both' || show === 'performance') && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => trigger('insights')}
          disabled={pendingKind !== null}
        >
          {pendingKind === 'insights' ? (
            <RefreshCw className="mr-1.5 h-4 w-4 animate-spin" />
          ) : (
            <BarChart3 className="mr-1.5 h-4 w-4" />
          )}
          Atualizar desempenho
        </Button>
      )}
    </div>
  )
}
