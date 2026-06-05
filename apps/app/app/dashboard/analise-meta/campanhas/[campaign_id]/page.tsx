import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, Target } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  formatCampaignObjective,
  formatMetaStatus,
  metaStatusVariant,
} from '@/lib/meta/labels'
import { createCrmAdminClient } from '@/lib/supabase/admin-untyped'
import { getMetaCampaignDetail } from '@/lib/meta/campaign-queries'
import { CampaignDetailTabs } from '@/components/analise-meta/campaign-detail-tabs'
import { PerformanceKpis } from '@/components/analise-meta/performance-kpis'
import { MetaRefreshControls } from '@/components/analise-meta/meta-refresh-controls'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Campanha — Análise Meta' }

export default async function CampanhaDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ campaign_id: string }>
  searchParams: Promise<{ from?: string }>
}) {
  const { campaign_id } = await params
  const { from } = await searchParams
  // "Voltar" honra a página de origem (ex.: imóvel → Interessados → Campanhas).
  // Só aceitamos caminhos internos (/dashboard/...) para evitar open-redirect.
  const backHref = from && from.startsWith('/dashboard/') ? from : '/dashboard/analise-meta/campanhas'
  const backLabel = backHref === '/dashboard/analise-meta/campanhas' ? 'Campanhas' : 'Voltar'
  const supabase = createCrmAdminClient()

  const detail = await getMetaCampaignDetail(supabase, campaign_id)
  if (!detail) notFound()

  const { campaign, kpis, adsetGroups, noAdLeads, insightKpis } = detail

  return (
    <div className="space-y-5">
      {/* Header — own back button; the section tab picker is hidden on detail */}
      <div className="space-y-2">
        <Button asChild variant="ghost" size="sm" className="-ml-3">
          <Link href={backHref}>
            <ArrowLeft className="mr-1 h-4 w-4" />
            {backLabel}
          </Link>
        </Button>
        <div className="flex flex-wrap items-center gap-2">
          <Target className="text-muted-foreground h-5 w-5" />
          <h1 className="text-2xl font-semibold tracking-tight">{campaign.name ?? '(sem nome)'}</h1>
          <Badge variant={metaStatusVariant(campaign.status)} className="text-[10px]">
            {formatMetaStatus(campaign.status)}
          </Badge>
        </div>
        <p className="text-muted-foreground text-sm">{formatCampaignObjective(campaign.objective)}</p>
      </div>

      {/* Desempenho (insights) + refresh */}
      <div className="space-y-3">
        <div className="flex items-center justify-end">
          <MetaRefreshControls defaultResources={['insights']} />
        </div>
        <PerformanceKpis kpis={insightKpis} />
      </div>

      <CampaignDetailTabs
        campaignId={campaign.campaign_id}
        campaignName={campaign.name}
        kpis={kpis}
        adsetGroups={adsetGroups}
        noAdLeads={noAdLeads}
      />
    </div>
  )
}
