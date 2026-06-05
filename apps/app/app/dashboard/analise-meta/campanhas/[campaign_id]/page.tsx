import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, Target } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  formatCampaignObjective,
  formatMetaBudgetCents,
  formatMetaStatus,
  metaStatusVariant,
} from '@/lib/meta/labels'
import { createCrmAdminClient } from '@/lib/supabase/admin-untyped'
import { getInsightKpis } from '@/lib/meta/insights-kpis'
import {
  CampaignDetailTabs,
  type FunnelAdset,
  type FunnelAd,
} from '@/components/analise-meta/campaign-detail-tabs'
import { PerformanceKpis } from '@/components/analise-meta/performance-kpis'
import { MetaRefreshControls } from '@/components/analise-meta/meta-refresh-controls'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Campanha — Análise Meta' }

const LEAD_SCAN = 3000

interface Ad {
  id: string
  ad_id: string
  name: string | null
  status: string | null
  adset_id: string | null
  creative_name: string | null
}

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

  const [campRes, adsRes, leadsCountRes, leadsRes, insightKpis] = await Promise.all([
    supabase.schema('meta').from('meta_campaigns_raw').select('*').eq('campaign_id', campaign_id).maybeSingle(),
    supabase
      .schema('meta')
      .from('meta_ads_raw')
      .select('id, ad_id, name, status, adset_id, creative_name, fb_created_time')
      .eq('campaign_id', campaign_id)
      .order('fb_created_time', { ascending: false, nullsFirst: false }),
    supabase.schema('meta').from('meta_leads_raw').select('id', { count: 'exact', head: true }).eq('campaign_id', campaign_id),
    supabase
      .schema('meta')
      .from('meta_leads_raw')
      .select('id, ad_id, form_id, processed')
      .eq('campaign_id', campaign_id)
      .limit(LEAD_SCAN),
    getInsightKpis(supabase, 'campaign', campaign_id),
  ])

  if (!campRes.data) notFound()

  const campaign = campRes.data
  const ads = (adsRes.data ?? []) as Ad[]
  const totalLeads = leadsCountRes.count ?? 0
  const leads = (leadsRes.data ?? []) as Array<{ ad_id: string | null; form_id: string | null; processed: boolean }>

  // Aggregate leads → per-ad counts + the forms each ad produced.
  const adStats = new Map<string, { leads: number; inCrm: number; forms: Map<string, number> }>()
  let inCrmTotal = 0
  let noAdLeads = 0
  for (const l of leads) {
    if (l.processed) inCrmTotal++
    if (!l.ad_id) {
      noAdLeads++
      continue
    }
    let s = adStats.get(l.ad_id)
    if (!s) {
      s = { leads: 0, inCrm: 0, forms: new Map() }
      adStats.set(l.ad_id, s)
    }
    s.leads++
    if (l.processed) s.inCrm++
    if (l.form_id) s.forms.set(l.form_id, (s.forms.get(l.form_id) ?? 0) + 1)
  }

  // Resolve form names.
  const formIds = Array.from(new Set(leads.map((l) => l.form_id).filter(Boolean) as string[]))
  const formsRes = formIds.length
    ? await supabase.schema('meta').from('meta_forms_raw').select('form_id, form_name').in('form_id', formIds)
    : { data: [] as { form_id: string; form_name: string | null }[] }
  const formNameById = new Map((formsRes.data ?? []).map((f) => [f.form_id, f.form_name]))

  // Group ads by adset → serializable funnel for the client tabs.
  const byAdset = new Map<string, Ad[]>()
  for (const ad of ads) {
    const k = ad.adset_id ?? '__none__'
    const arr = byAdset.get(k)
    if (arr) arr.push(ad)
    else byAdset.set(k, [ad])
  }
  const adsetGroups: FunnelAdset[] = Array.from(byAdset.entries()).map(([adset_id, groupAds]) => ({
    adset_id,
    ads: groupAds.map((ad): FunnelAd => {
      const stat = adStats.get(ad.ad_id)
      const forms = stat
        ? Array.from(stat.forms.entries())
            .sort((a, b) => b[1] - a[1])
            .map(([form_id, count]) => ({ form_id, name: formNameById.get(form_id) ?? null, count }))
        : []
      return {
        id: ad.id,
        ad_id: ad.ad_id,
        name: ad.name,
        status: ad.status,
        creative_name: ad.creative_name,
        leads: stat?.leads ?? 0,
        forms,
      }
    }),
  }))

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
        kpis={{
          ads: ads.length,
          leads: totalLeads,
          inCrm: inCrmTotal,
          dailyBudget: formatMetaBudgetCents(campaign.daily_budget),
        }}
        adsetGroups={adsetGroups}
        noAdLeads={noAdLeads}
      />
    </div>
  )
}
