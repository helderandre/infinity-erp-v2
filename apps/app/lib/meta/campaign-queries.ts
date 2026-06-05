/**
 * Shared Meta-campaign queries (read from the `meta` schema with the admin
 * client). Used by both the server pages under /dashboard/analise-meta and the
 * client-facing API routes that power the CRM → Análise → Meta tab, so the two
 * surfaces stay in lockstep.
 */

import type { createCrmAdminClient } from '@/lib/supabase/admin-untyped'
import type { FunnelAdset, FunnelAd } from '@/components/analise-meta/campaign-detail-tabs'
import { formatMetaBudgetCents } from './labels'
import {
  getInsightKpis,
  getInsightTotalsByObject,
  type InsightKpis,
} from './insights-kpis'

type AdminClient = ReturnType<typeof createCrmAdminClient>

const DETAIL_LEAD_SCAN = 3000

export interface MetaCampaignListItem {
  id: string
  campaign_id: string
  ad_account_id: string | null
  name: string | null
  status: string | null
  objective: string | null
  daily_budget: string | null
  lifetime_budget: string | null
  fb_created_time: string | null
  received_at: string
  ads_count: number
  leads_count: number
  spend: number | null
  currency: string | null
}

interface CampaignRow {
  id: string
  campaign_id: string
  ad_account_id: string | null
  name: string | null
  status: string | null
  objective: string | null
  daily_budget: string | null
  lifetime_budget: string | null
  fb_created_time: string | null
  received_at: string
}

function countBy(rows: { campaign_id: string | null }[]): Record<string, number> {
  const map: Record<string, number> = {}
  for (const r of rows) {
    if (!r.campaign_id) continue
    map[r.campaign_id] = (map[r.campaign_id] ?? 0) + 1
  }
  return map
}

/**
 * Paginated, searchable campaign list with per-campaign ad/lead counts and
 * insight spend folded in. Mirrors the standalone Campanhas page.
 */
export async function listMetaCampaigns(
  supabase: AdminClient,
  { q = '', page = 1, pageSize = 30 }: { q?: string; page?: number; pageSize?: number },
): Promise<{ campaigns: MetaCampaignListItem[]; total: number }> {
  const from = (Math.max(1, page) - 1) * pageSize
  const to = from + pageSize - 1

  let query = supabase
    .schema('meta')
    .from('meta_campaigns_raw')
    .select(
      'id, campaign_id, ad_account_id, name, status, objective, daily_budget, lifetime_budget, fb_created_time, received_at',
      { count: 'exact' },
    )

  const trimmed = q.trim()
  if (trimmed) {
    const safe = trimmed.replace(/%/g, '\\%').replace(/_/g, '\\_')
    query = query.or(
      `name.ilike.%${safe}%,campaign_id.ilike.%${safe}%,objective.ilike.%${safe}%`,
    )
  }

  // Most recent first by the real Facebook creation date (received_at collapses
  // to "now" on every backfill/replay, so it sorts arbitrarily).
  const { data, count, error } = await query
    .order('fb_created_time', { ascending: false, nullsFirst: false })
    .order('received_at', { ascending: false })
    .range(from, to)

  if (error) throw new Error(error.message)

  const rows = (data ?? []) as CampaignRow[]
  const ids = rows.map((c) => c.campaign_id)

  const [adsRes, leadsRes, spendByCamp] = await Promise.all([
    ids.length
      ? supabase.schema('meta').from('meta_ads_raw').select('campaign_id').in('campaign_id', ids).limit(5000)
      : Promise.resolve({ data: [] as { campaign_id: string | null }[] }),
    ids.length
      ? supabase.schema('meta').from('meta_leads_raw').select('campaign_id').in('campaign_id', ids).limit(8000)
      : Promise.resolve({ data: [] as { campaign_id: string | null }[] }),
    ids.length
      ? getInsightTotalsByObject(supabase, 'campaign', ids)
      : Promise.resolve({} as Record<string, { spend: number; leads: number; currency: string | null }>),
  ])
  const adsByCamp = countBy(adsRes.data ?? [])
  const leadsByCamp = countBy(leadsRes.data ?? [])

  const campaigns: MetaCampaignListItem[] = rows.map((c) => ({
    ...c,
    ads_count: adsByCamp[c.campaign_id] ?? 0,
    leads_count: leadsByCamp[c.campaign_id] ?? 0,
    spend: spendByCamp[c.campaign_id]?.spend ?? null,
    currency: spendByCamp[c.campaign_id]?.currency ?? null,
  }))

  return { campaigns, total: count ?? 0 }
}

export interface MetaCampaignDetail {
  campaign: {
    campaign_id: string
    name: string | null
    status: string | null
    objective: string | null
    daily_budget: string | null
  }
  kpis: { ads: number; leads: number; inCrm: number; dailyBudget: string }
  adsetGroups: FunnelAdset[]
  noAdLeads: number
  insightKpis: InsightKpis
}

interface AdRow {
  id: string
  ad_id: string
  name: string | null
  status: string | null
  adset_id: string | null
  creative_name: string | null
}

/**
 * Full campaign detail: header fields, summary KPIs, the adset → ad funnel
 * (with per-ad lead counts and form breakdown) and aggregated insight KPIs.
 * Mirrors the standalone campaign detail page. Returns null when not found.
 */
export async function getMetaCampaignDetail(
  supabase: AdminClient,
  campaignId: string,
): Promise<MetaCampaignDetail | null> {
  const [campRes, adsRes, leadsCountRes, leadsRes, insightKpis] = await Promise.all([
    supabase.schema('meta').from('meta_campaigns_raw').select('*').eq('campaign_id', campaignId).maybeSingle(),
    supabase
      .schema('meta')
      .from('meta_ads_raw')
      .select('id, ad_id, name, status, adset_id, creative_name, fb_created_time')
      .eq('campaign_id', campaignId)
      .order('fb_created_time', { ascending: false, nullsFirst: false }),
    supabase.schema('meta').from('meta_leads_raw').select('id', { count: 'exact', head: true }).eq('campaign_id', campaignId),
    supabase
      .schema('meta')
      .from('meta_leads_raw')
      .select('id, ad_id, form_id, processed')
      .eq('campaign_id', campaignId)
      .limit(DETAIL_LEAD_SCAN),
    getInsightKpis(supabase, 'campaign', campaignId),
  ])

  if (!campRes.data) return null

  const campaign = campRes.data as Record<string, unknown> & {
    campaign_id: string
    name: string | null
    status: string | null
    objective: string | null
    daily_budget: string | null
  }
  const ads = (adsRes.data ?? []) as AdRow[]
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
  const byAdset = new Map<string, AdRow[]>()
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

  return {
    campaign: {
      campaign_id: campaign.campaign_id,
      name: campaign.name,
      status: campaign.status,
      objective: campaign.objective,
      daily_budget: campaign.daily_budget,
    },
    kpis: {
      ads: ads.length,
      leads: totalLeads,
      inCrm: inCrmTotal,
      dailyBudget: formatMetaBudgetCents(campaign.daily_budget),
    },
    adsetGroups,
    noAdLeads,
    insightKpis,
  }
}
