/**
 * Agregação server-side dos insights do mirror local (meta.meta_insights_raw)
 * para KPIs de desempenho ao nível campanha/anúncio/conta.
 *
 * Regras de soma (ver prompt meta-api):
 *   - spend / impressions / clicks / inline_link_clicks / leads → SOMÁVEIS
 *   - reach / frequency → NÃO somáveis entre dias; ignorados aqui (evita
 *     números enganadores). cost_per_lead derivado de spend ÷ leads.
 */

import type { SupabaseClient } from '@supabase/supabase-js'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AdminSupabase = SupabaseClient<any, 'public', any>

export interface InsightKpis {
  /** true se há pelo menos uma linha de insights para o objecto */
  hasData: boolean
  spend: number
  impressions: number
  clicks: number
  inlineLinkClicks: number
  leads: number
  costPerLead: number | null
  ctr: number | null
  cpc: number | null
  currency: string | null
  /** dias distintos cobertos */
  days: number
  /** primeira/última data com dados (YYYY-MM-DD) */
  firstDay: string | null
  lastDay: string | null
}

const EMPTY: InsightKpis = {
  hasData: false,
  spend: 0,
  impressions: 0,
  clicks: 0,
  inlineLinkClicks: 0,
  leads: 0,
  costPerLead: null,
  ctr: null,
  cpc: null,
  currency: null,
  days: 0,
  firstDay: null,
  lastDay: null,
}

interface Row {
  date_start: string
  spend: number | null
  impressions: number | null
  clicks: number | null
  inline_link_clicks: number | null
  leads: number | null
  account_currency: string | null
}

const SCAN_LIMIT = 2000

/**
 * Lê e agrega as linhas de insights de um objecto (level + object_id).
 */
export async function getInsightKpis(
  supabase: AdminSupabase,
  level: 'account' | 'campaign' | 'adset' | 'ad',
  objectId: string,
): Promise<InsightKpis> {
  const { data, error } = await supabase
    .schema('meta')
    .from('meta_insights_raw')
    .select(
      'date_start, spend, impressions, clicks, inline_link_clicks, leads, account_currency',
    )
    .eq('level', level)
    .eq('object_id', objectId)
    .order('date_start', { ascending: true })
    .limit(SCAN_LIMIT)

  if (error || !data || data.length === 0) return { ...EMPTY }

  const rows = data as Row[]
  const acc = { ...EMPTY, hasData: true }
  const dayset = new Set<string>()

  for (const r of rows) {
    acc.spend += Number(r.spend ?? 0)
    acc.impressions += Number(r.impressions ?? 0)
    acc.clicks += Number(r.clicks ?? 0)
    acc.inlineLinkClicks += Number(r.inline_link_clicks ?? 0)
    acc.leads += Number(r.leads ?? 0)
    if (r.date_start) dayset.add(r.date_start)
    if (!acc.currency && r.account_currency) acc.currency = r.account_currency
  }

  acc.days = dayset.size
  const sortedDays = [...dayset].sort()
  acc.firstDay = sortedDays[0] ?? null
  acc.lastDay = sortedDays[sortedDays.length - 1] ?? null
  acc.costPerLead = acc.leads > 0 ? acc.spend / acc.leads : null
  acc.ctr = acc.impressions > 0 ? (acc.clicks / acc.impressions) * 100 : null
  acc.cpc = acc.clicks > 0 ? acc.spend / acc.clicks : null

  return acc
}

/**
 * Versão batched: agrega spend/leads/CPL por object_id para uma lista de ids
 * num só scan. Usada pelo endpoint /api/leads/meta-performance.
 */
export async function getInsightTotalsByObject(
  supabase: AdminSupabase,
  level: 'campaign' | 'ad',
  objectIds: string[],
): Promise<Record<string, { spend: number; leads: number; currency: string | null }>> {
  const out: Record<string, { spend: number; leads: number; currency: string | null }> = {}
  if (objectIds.length === 0) return out

  const { data } = await supabase
    .schema('meta')
    .from('meta_insights_raw')
    .select('object_id, spend, leads, account_currency')
    .eq('level', level)
    .in('object_id', objectIds)
    .limit(SCAN_LIMIT * 4)

  for (const r of (data ?? []) as Array<{
    object_id: string
    spend: number | null
    leads: number | null
    account_currency: string | null
  }>) {
    const cur = out[r.object_id] ?? { spend: 0, leads: 0, currency: null }
    cur.spend += Number(r.spend ?? 0)
    cur.leads += Number(r.leads ?? 0)
    if (!cur.currency && r.account_currency) cur.currency = r.account_currency
    out[r.object_id] = cur
  }

  return out
}
