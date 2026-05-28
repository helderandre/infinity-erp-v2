'use client'

import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { RefreshCw, Megaphone, BarChart3 } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  refreshCampaignsAdsNow,
  refreshPerformanceNow,
} from '@/app/dashboard/integracoes/meta/sync-actions'

/**
 * Botões "Atualizar agora" para a Análise Meta. Chamam server actions que
 * proxam os endpoints admin da meta-api (X-Admin-Secret, só server-side).
 *
 *   - campaigns: força sync da connection (descobre campanhas/anúncios novos).
 *   - performance: força re-pull dos insights + espelha no mirror local.
 *
 * `show` controla quais aparecem (detalhe de campanha/ad só mostra performance).
 */
export function MetaRefreshButtons({
  show = 'both',
}: {
  show?: 'both' | 'campaigns' | 'performance'
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  function runCampaigns() {
    startTransition(async () => {
      const res = await refreshCampaignsAdsNow()
      if (res.ok) {
        const c = res.data.ad_assets?.campaigns
        const a = res.data.ad_assets?.ads
        toast.success('Campanhas e anúncios actualizados', {
          description:
            c || a
              ? `Campanhas: ${c?.upserted ?? 0} · Anúncios: ${a?.upserted ?? 0}`
              : 'Os dados novos chegam pelos webhooks em segundos.',
        })
        router.refresh()
      } else {
        toast.error('Falha ao actualizar campanhas/anúncios', {
          description: errorLabel(res.error),
        })
      }
    })
  }

  function runPerformance() {
    startTransition(async () => {
      const res = await refreshPerformanceNow()
      if (res.ok) {
        toast.success('Desempenho actualizado', {
          description: `${res.upserted} linha(s) de insights no mirror local.`,
        })
        router.refresh()
      } else {
        toast.error('Falha ao actualizar desempenho', {
          description: errorLabel(res.error),
        })
      }
    })
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {(show === 'both' || show === 'campaigns') && (
        <Button
          variant="outline"
          size="sm"
          onClick={runCampaigns}
          disabled={pending}
        >
          <Megaphone className="mr-1.5 h-4 w-4" />
          Atualizar campanhas/anúncios
        </Button>
      )}
      {(show === 'both' || show === 'performance') && (
        <Button
          variant="outline"
          size="sm"
          onClick={runPerformance}
          disabled={pending}
        >
          {pending ? (
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

function errorLabel(code: string): string {
  switch (code) {
    case 'forbidden':
      return 'Sem permissão (requer settings).'
    case 'unauthenticated':
      return 'Sessão expirada.'
    case 'no_active_connection':
      return 'Sem ligação Meta activa.'
    case 'server_misconfigured':
      return 'Configuração do servidor em falta.'
    default:
      return code
  }
}
