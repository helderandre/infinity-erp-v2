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
  type InsightObjectTotals,
} from './insights-kpis'
import { timestampBounds, type MetaDateRange } from './date-range'

const INSIGHT_SCAN_LIMIT = 20000

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
  impressions: number | null
  clicks: number | null
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

export interface MetaCampaignSummary {
  name: string | null
  status: string | null
  spend: number | null
  currency: string | null
  leads_count: number
  ads_count: number
}

/**
 * Lightweight summary (name/status + ad/lead counts + insight spend) for an
 * explicit set of Meta campaign_ids. Used to fold live Meta data into the
 * marketing campaign requests linked by partners. Returns a map keyed by
 * campaign_id; ids without a synced campaign are simply absent.
 */
export async function getMetaCampaignSummaries(
  supabase: AdminClient,
  campaignIds: string[],
): Promise<Record<string, MetaCampaignSummary>> {
  const ids = Array.from(new Set(campaignIds.filter(Boolean)))
  if (ids.length === 0) return {}

  const [campRes, adsRes, leadsRes, spendByCamp] = await Promise.all([
    supabase.schema('meta').from('meta_campaigns_raw').select('campaign_id, name, status').in('campaign_id', ids),
    supabase.schema('meta').from('meta_ads_raw').select('campaign_id').in('campaign_id', ids).limit(5000),
    supabase.schema('meta').from('meta_leads_raw').select('campaign_id').in('campaign_id', ids).limit(8000),
    getInsightTotalsByObject(supabase, 'campaign', ids),
  ])

  const adsByCamp = countBy((adsRes.data ?? []) as { campaign_id: string | null }[])
  const leadsByCamp = countBy((leadsRes.data ?? []) as { campaign_id: string | null }[])
  const campMeta = new Map<string, { name: string | null; status: string | null }>()
  for (const c of (campRes.data ?? []) as { campaign_id: string; name: string | null; status: string | null }[]) {
    campMeta.set(c.campaign_id, { name: c.name, status: c.status })
  }

  const out: Record<string, MetaCampaignSummary> = {}
  for (const id of ids) {
    out[id] = {
      name: campMeta.get(id)?.name ?? null,
      status: campMeta.get(id)?.status ?? null,
      spend: spendByCamp[id]?.spend ?? null,
      currency: spendByCamp[id]?.currency ?? null,
      leads_count: leadsByCamp[id] ?? 0,
      ads_count: adsByCamp[id] ?? 0,
    }
  }
  return out
}

/**
 * Paginated, searchable campaign list with per-campaign ad/lead counts and
 * insight spend folded in. Mirrors the standalone Campanhas page.
 */
export async function listMetaCampaigns(
  supabase: AdminClient,
  {
    q = '',
    page = 1,
    pageSize = 30,
    campaignIds,
    range,
  }: { q?: string; page?: number; pageSize?: number; campaignIds?: string[]; range?: MetaDateRange },
): Promise<{ campaigns: MetaCampaignListItem[]; total: number }> {
  // Scope to an explicit allow-list of campaign_ids (used by the Parceiros
  // app to show only the campaigns a partner manages/references). An empty
  // array means "no campaigns" → return early rather than an unscoped list.
  if (campaignIds && campaignIds.length === 0) {
    return { campaigns: [], total: 0 }
  }

  const from = (Math.max(1, page) - 1) * pageSize
  const to = from + pageSize - 1

  let query = supabase
    .schema('meta')
    .from('meta_campaigns_raw')
    .select(
      'id, campaign_id, ad_account_id, name, status, objective, daily_budget, lifetime_budget, fb_created_time, received_at',
      { count: 'exact' },
    )

  if (campaignIds && campaignIds.length > 0) {
    query = query.in('campaign_id', campaignIds)
  }

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
  const leadBounds = timestampBounds(range ?? {})

  const [adsRes, leadsRes, spendByCamp] = await Promise.all([
    ids.length
      ? supabase.schema('meta').from('meta_ads_raw').select('campaign_id').in('campaign_id', ids).limit(5000)
      : Promise.resolve({ data: [] as { campaign_id: string | null }[] }),
    ids.length
      ? (() => {
          let lq = supabase.schema('meta').from('meta_leads_raw').select('campaign_id').in('campaign_id', ids)
          if (leadBounds.gte) lq = lq.gte('fb_created_time', leadBounds.gte)
          if (leadBounds.lte) lq = lq.lte('fb_created_time', leadBounds.lte)
          return lq.limit(8000)
        })()
      : Promise.resolve({ data: [] as { campaign_id: string | null }[] }),
    ids.length
      ? getInsightTotalsByObject(supabase, 'campaign', ids, range)
      : Promise.resolve({} as Record<string, InsightObjectTotals>),
  ])
  const adsByCamp = countBy(adsRes.data ?? [])
  const leadsByCamp = countBy(leadsRes.data ?? [])

  const campaigns: MetaCampaignListItem[] = rows.map((c) => ({
    ...c,
    ads_count: adsByCamp[c.campaign_id] ?? 0,
    leads_count: leadsByCamp[c.campaign_id] ?? 0,
    spend: spendByCamp[c.campaign_id]?.spend ?? null,
    impressions: spendByCamp[c.campaign_id]?.impressions ?? null,
    clicks: spendByCamp[c.campaign_id]?.clicks ?? null,
    currency: spendByCamp[c.campaign_id]?.currency ?? null,
  }))

  return { campaigns, total: count ?? 0 }
}

export interface MetaCampaignsGlobalTotals {
  spend: number
  impressions: number
  clicks: number
  leads: number
  currency: string | null
}

/**
 * Account-wide totals for the metric cards above the campaigns grid (matches
 * the Meta Ads page header cards). Spend/impressions/clicks come from the
 * campaign-level insight mirror; leads is the raw lead count. Independent of
 * pagination so the cards reflect the whole dataset, not the current page.
 */
export async function getMetaCampaignsGlobalTotals(
  supabase: AdminClient,
  { range, campaignIds }: { range?: MetaDateRange; campaignIds?: string[] } = {},
): Promise<MetaCampaignsGlobalTotals> {
  // Scoped to a consultor's campaigns? An empty allow-list means "nothing".
  if (campaignIds && campaignIds.length === 0) {
    return { spend: 0, impressions: 0, clicks: 0, leads: 0, currency: null }
  }
  const leadBounds = timestampBounds(range ?? {})

  let insightsQuery = supabase
    .schema('meta')
    .from('meta_insights_raw')
    .select('spend, impressions, clicks, account_currency')
    .eq('level', 'campaign')
  if (campaignIds && campaignIds.length) insightsQuery = insightsQuery.in('object_id', campaignIds)
  if (range?.from) insightsQuery = insightsQuery.gte('date_start', range.from)
  if (range?.to) insightsQuery = insightsQuery.lte('date_start', range.to)

  let leadsCountQuery = supabase.schema('meta').from('meta_leads_raw').select('id', { count: 'exact', head: true })
  if (campaignIds && campaignIds.length) leadsCountQuery = leadsCountQuery.in('campaign_id', campaignIds)
  if (leadBounds.gte) leadsCountQuery = leadsCountQuery.gte('fb_created_time', leadBounds.gte)
  if (leadBounds.lte) leadsCountQuery = leadsCountQuery.lte('fb_created_time', leadBounds.lte)

  const [insightsRes, leadsCountRes] = await Promise.all([
    insightsQuery.limit(INSIGHT_SCAN_LIMIT),
    leadsCountQuery,
  ])

  const acc: MetaCampaignsGlobalTotals = { spend: 0, impressions: 0, clicks: 0, leads: 0, currency: null }
  for (const r of (insightsRes.data ?? []) as Array<{
    spend: number | null
    impressions: number | null
    clicks: number | null
    account_currency: string | null
  }>) {
    acc.spend += Number(r.spend ?? 0)
    acc.impressions += Number(r.impressions ?? 0)
    acc.clicks += Number(r.clicks ?? 0)
    if (!acc.currency && r.account_currency) acc.currency = r.account_currency
  }
  acc.leads = leadsCountRes.count ?? 0
  return acc
}

export interface MetaCampaignAdItem {
  id: string
  ad_id: string
  name: string | null
  status: string | null
  adset_id: string | null
  creative_name: string | null
  leads_count: number
  spend: number | null
  impressions: number | null
  clicks: number | null
  ctr: number | null
  cost_per_lead: number | null
  currency: string | null
}

/** Sentinel adset_id for ads that have no adset (mirrors the detail funnel). */
export const NO_ADSET = '__none__'

export interface MetaCampaignAdsetGroup {
  adset_id: string
  /** real adset name (live Graph, best-effort) — null when unavailable */
  name: string | null
  /** real adset configured status (live Graph) — null when unavailable */
  status: string | null
  leads_count: number
  spend: number | null
  impressions: number | null
  clicks: number | null
  ctr: number | null
  cost_per_lead: number | null
  currency: string | null
  ads: MetaCampaignAdItem[]
}

/**
 * Best-effort live lookup of a campaign's adsets (name + configured status) from
 * the Graph API. Adsets aren't synced to the mirror, so this is the only source
 * for their name/status — used to label adset groups and drive the pause/activate
 * toggle. Returns an empty map when the token is missing or the call fails.
 */
async function fetchAdsetMeta(campaignId: string): Promise<Map<string, { name: string | null; status: string | null }>> {
  const out = new Map<string, { name: string | null; status: string | null }>()
  const token = process.env.META_ACCESS_TOKEN
  if (!token) return out
  try {
    const url = `https://graph.facebook.com/v21.0/${campaignId}/adsets?fields=id,name,status&limit=500&access_token=${token}`
    const res = await fetch(url)
    if (!res.ok) return out
    const body = await res.json()
    for (const a of (body.data ?? []) as Array<{ id: string; name?: string; status?: string }>) {
      out.set(a.id, { name: a.name ?? null, status: a.status ?? null })
    }
  } catch {
    // best-effort — groups just render without name/status
  }
  return out
}

/**
 * Ads of a single campaign grouped by adset_id (same grouping as the campaign
 * detail funnel), each ad + each adset group enriched with insight totals and
 * lead counts. Powers the lazy accordion expansion under a campaign row
 * (campaign → adset → ad), mirroring the Meta Ads page. Adsets aren't synced
 * as their own entity, so the group is keyed/labelled by adset_id; ads without
 * an adset fall into the NO_ADSET group, which is sorted last.
 */
export async function listCampaignAdsetGroups(
  supabase: AdminClient,
  campaignId: string,
  range?: MetaDateRange,
): Promise<MetaCampaignAdsetGroup[]> {
  const leadBounds = timestampBounds(range ?? {})
  const [adsRes, leadsRes] = await Promise.all([
    supabase
      .schema('meta')
      .from('meta_ads_raw')
      .select('id, ad_id, name, status, adset_id, creative_name, fb_created_time')
      .eq('campaign_id', campaignId)
      .order('fb_created_time', { ascending: false, nullsFirst: false }),
    (() => {
      let lq = supabase.schema('meta').from('meta_leads_raw').select('ad_id').eq('campaign_id', campaignId)
      if (leadBounds.gte) lq = lq.gte('fb_created_time', leadBounds.gte)
      if (leadBounds.lte) lq = lq.lte('fb_created_time', leadBounds.lte)
      return lq.limit(DETAIL_LEAD_SCAN)
    })(),
  ])

  const ads = (adsRes.data ?? []) as AdRow[]
  const leadsByAd = countByAd((leadsRes.data ?? []) as { ad_id: string | null }[])
  const adIds = ads.map((a) => a.ad_id)
  const insightsByAd = await getInsightTotalsByObject(supabase, 'ad', adIds, range)

  const adItems: MetaCampaignAdItem[] = ads.map((a) => {
    const ins = insightsByAd[a.ad_id]
    const leads_count = leadsByAd[a.ad_id] ?? 0
    return {
      id: a.id,
      ad_id: a.ad_id,
      name: a.name,
      status: a.status,
      adset_id: a.adset_id,
      creative_name: a.creative_name,
      leads_count,
      spend: ins?.spend ?? null,
      impressions: ins?.impressions ?? null,
      clicks: ins?.clicks ?? null,
      ctr: ins && ins.impressions > 0 ? (ins.clicks / ins.impressions) * 100 : null,
      cost_per_lead: ins && leads_count > 0 ? ins.spend / leads_count : null,
      currency: ins?.currency ?? null,
    }
  })

  // Group by adset_id, preserving first-seen order; each group totals = sum of
  // its ads (so the group row always equals the visible ad rows beneath it).
  const groups = new Map<string, MetaCampaignAdsetGroup>()
  for (const ad of adItems) {
    const key = ad.adset_id ?? NO_ADSET
    let g = groups.get(key)
    if (!g) {
      g = {
        adset_id: key,
        name: null,
        status: null,
        leads_count: 0,
        spend: null,
        impressions: null,
        clicks: null,
        ctr: null,
        cost_per_lead: null,
        currency: null,
        ads: [],
      }
      groups.set(key, g)
    }
    g.ads.push(ad)
    g.leads_count += ad.leads_count
    if (ad.spend !== null) g.spend = (g.spend ?? 0) + ad.spend
    if (ad.impressions !== null) g.impressions = (g.impressions ?? 0) + ad.impressions
    if (ad.clicks !== null) g.clicks = (g.clicks ?? 0) + ad.clicks
    if (!g.currency && ad.currency) g.currency = ad.currency
  }

  const result = Array.from(groups.values())
  for (const g of result) {
    g.ctr = g.impressions && g.impressions > 0 ? ((g.clicks ?? 0) / g.impressions) * 100 : null
    g.cost_per_lead = g.spend !== null && g.leads_count > 0 ? g.spend / g.leads_count : null
  }

  // Live-enrich adset name + status (the mirror has neither) — best-effort.
  const adsetMeta = await fetchAdsetMeta(campaignId)
  if (adsetMeta.size) {
    for (const g of result) {
      const meta = adsetMeta.get(g.adset_id)
      if (meta) {
        g.name = meta.name
        g.status = meta.status
      }
    }
  }

  // Named adsets first, the "no adset" bucket last.
  result.sort((a, b) => (a.adset_id === NO_ADSET ? 1 : 0) - (b.adset_id === NO_ADSET ? 1 : 0))
  return result
}

function countByAd(rows: { ad_id: string | null }[]): Record<string, number> {
  const map: Record<string, number> = {}
  for (const r of rows) {
    if (!r.ad_id) continue
    map[r.ad_id] = (map[r.ad_id] ?? 0) + 1
  }
  return map
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
  range?: MetaDateRange,
): Promise<MetaCampaignDetail | null> {
  const leadBounds = timestampBounds(range ?? {})
  const leadsCountQuery = (() => {
    let q = supabase.schema('meta').from('meta_leads_raw').select('id', { count: 'exact', head: true }).eq('campaign_id', campaignId)
    if (leadBounds.gte) q = q.gte('fb_created_time', leadBounds.gte)
    if (leadBounds.lte) q = q.lte('fb_created_time', leadBounds.lte)
    return q
  })()
  const leadsScanQuery = (() => {
    let q = supabase.schema('meta').from('meta_leads_raw').select('id, ad_id, form_id, processed').eq('campaign_id', campaignId)
    if (leadBounds.gte) q = q.gte('fb_created_time', leadBounds.gte)
    if (leadBounds.lte) q = q.lte('fb_created_time', leadBounds.lte)
    return q.limit(DETAIL_LEAD_SCAN)
  })()

  const [campRes, adsRes, leadsCountRes, leadsRes, insightKpis] = await Promise.all([
    supabase.schema('meta').from('meta_campaigns_raw').select('*').eq('campaign_id', campaignId).maybeSingle(),
    supabase
      .schema('meta')
      .from('meta_ads_raw')
      .select('id, ad_id, name, status, adset_id, creative_name, fb_created_time')
      .eq('campaign_id', campaignId)
      .order('fb_created_time', { ascending: false, nullsFirst: false }),
    leadsCountQuery,
    leadsScanQuery,
    getInsightKpis(supabase, 'campaign', campaignId, range),
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
