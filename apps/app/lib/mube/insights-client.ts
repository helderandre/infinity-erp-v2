/**
 * Cliente server-side de leitura dos Insights da meta-api (tenant-facing).
 *
 * GET /api/insights é tenant-facing e assina-se com HMAC (X-Mube-Tenant-Id +
 * X-Mube-Timestamp + X-Mube-Signature-256), exactamente como /replay e
 * /connection — o signing secret nunca toca o browser.
 *
 * Padrão deste repo: espelhar tudo no schema `meta` e ler localmente. O ping
 * `insights.synced` (sem métricas) e o botão "Atualizar desempenho agora"
 * disparam refreshInsightsMirror(), que busca as linhas e faz upsert idempotente
 * em meta.meta_insights_raw. A UI lê o mirror local (joins rápidos com receita
 * do CRM para ROI).
 *
 * NUNCA importar do browser — usa MUBE_SIGNING_SECRET.
 */

import type { SupabaseClient } from '@supabase/supabase-js'

import { signMubeRequest } from '@/lib/mube/signature'
import type { Insight, InsightLevel, InsightsResponse } from '@/lib/mube/types'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AdminSupabase = SupabaseClient<any, 'public', any>

const INSIGHTS_PATH = '/api/insights'
const PAGE_LIMIT = 500
const MAX_PAGES = 40 // backstop: 40 * 500 = 20k linhas por refresh

interface FetchInsightsParams {
  level?: InsightLevel
  adAccountId?: string
  campaignId?: string
  adId?: string
  /** YYYY-MM-DD */
  from?: string
  /** YYYY-MM-DD */
  to?: string
}

interface MubeEnv {
  baseUrl: string
  tenantId: string
  signingSecret: string
}

function readEnv(): MubeEnv | null {
  const baseUrl = process.env.MUBE_API_BASE_URL
  const tenantId = process.env.MUBE_TENANT_ID
  const signingSecret = process.env.MUBE_SIGNING_SECRET
  if (!baseUrl || !tenantId || !signingSecret) {
    console.error('[mube-insights] missing env', {
      hasBase: !!baseUrl,
      hasTenant: !!tenantId,
      hasSecret: !!signingSecret,
    })
    return null
  }
  return { baseUrl, tenantId, signingSecret }
}

/**
 * Busca uma página de insights da meta-api (HMAC server-side). Devolve a
 * resposta crua ou null em erro (best-effort — caller decide se falha).
 */
async function fetchInsightsPage(
  env: MubeEnv,
  params: FetchInsightsParams,
  limit: number,
  offset: number,
): Promise<InsightsResponse | null> {
  const qs = new URLSearchParams()
  qs.set('tenant_id', env.tenantId)
  if (params.level) qs.set('level', params.level)
  if (params.adAccountId) qs.set('ad_account_id', params.adAccountId)
  if (params.campaignId) qs.set('campaign_id', params.campaignId)
  if (params.adId) qs.set('ad_id', params.adId)
  if (params.from) qs.set('from', params.from)
  if (params.to) qs.set('to', params.to)
  qs.set('limit', String(limit))
  qs.set('offset', String(offset))

  // O HMAC assina o pathWithQuery LITERAL que enviamos — a meta-api reconstrói
  // a mensagem a partir da mesma string, por isso tem de bater bit-a-bit.
  const pathWithQuery = `${INSIGHTS_PATH}?${qs.toString()}`
  const { timestamp, signature } = signMubeRequest({
    method: 'GET',
    pathWithQuery,
    body: '',
    secret: env.signingSecret,
  })

  try {
    const res = await fetch(`${env.baseUrl}${pathWithQuery}`, {
      method: 'GET',
      headers: {
        'X-Mube-Tenant-Id': env.tenantId,
        'X-Mube-Timestamp': timestamp,
        'X-Mube-Signature-256': signature,
      },
      signal: AbortSignal.timeout(20_000),
      cache: 'no-store',
    })
    if (!res.ok) {
      console.warn('[mube-insights] /api/insights non-2xx', {
        status: res.status,
        offset,
      })
      return null
    }
    return (await res.json()) as InsightsResponse
  } catch (err) {
    console.error('[mube-insights] /api/insights fetch threw', {
      err: err instanceof Error ? err.message : String(err),
    })
    return null
  }
}

/**
 * Busca TODAS as páginas de insights para os params dados (segue has_more).
 */
export async function fetchAllInsights(
  params: FetchInsightsParams = {},
): Promise<{ ok: boolean; insights: Insight[] }> {
  const env = readEnv()
  if (!env) return { ok: false, insights: [] }

  const out: Insight[] = []
  let offset = 0
  for (let i = 0; i < MAX_PAGES; i++) {
    const page = await fetchInsightsPage(env, params, PAGE_LIMIT, offset)
    if (!page) return { ok: false, insights: out }
    out.push(...(page.insights ?? []))
    if (!page.pagination?.has_more) break
    offset += PAGE_LIMIT
  }
  return { ok: true, insights: out }
}

/**
 * Mapeia um Insight da meta-api para a row de meta.meta_insights_raw.
 */
function insightToRow(insight: Insight, tenantId: string) {
  return {
    external_id: insight.id,
    payload: insight,
    mube_tenant_id: tenantId,
    ad_account_id: insight.ad_account_id,
    level: insight.level,
    object_id: insight.object_id,
    campaign_id: insight.campaign_id,
    adset_id: insight.adset_id,
    ad_id: insight.ad_id,
    date_start: insight.date_start,
    date_stop: insight.date_stop,
    spend: insight.spend,
    impressions: insight.impressions,
    reach: insight.reach,
    frequency: insight.frequency,
    clicks: insight.clicks,
    inline_link_clicks: insight.inline_link_clicks,
    cpc: insight.cpc,
    cpm: insight.cpm,
    ctr: insight.ctr,
    leads: insight.leads,
    cost_per_lead: insight.cost_per_lead,
    actions: insight.actions,
    action_values: insight.action_values,
    cost_per_action_type: insight.cost_per_action_type,
    purchase_roas: insight.purchase_roas,
    account_currency: insight.account_currency,
    fetched_at: insight.fetched_at,
    received_at: new Date().toISOString(),
  }
}

/**
 * Upsert idempotente das linhas de insights no mirror local. onConflict no grão
 * natural (level, object_id, date_start). Chunked para não estourar limites.
 */
export async function mirrorInsightsToDb(
  supabase: AdminSupabase,
  insights: Insight[],
  tenantId: string,
): Promise<{ upserted: number; errors: number }> {
  if (insights.length === 0) return { upserted: 0, errors: 0 }

  const rows = insights.map((i) => insightToRow(i, tenantId))
  const CHUNK = 500
  let upserted = 0
  let errors = 0

  for (let i = 0; i < rows.length; i += CHUNK) {
    const slice = rows.slice(i, i + CHUNK)
    const { error } = await supabase
      .schema('meta')
      .from('meta_insights_raw')
      .upsert(slice, { onConflict: 'level,object_id,date_start' })
    if (error) {
      console.error('[mube-insights] mirror upsert failed', {
        chunkStart: i,
        err: error.message,
      })
      errors += slice.length
    } else {
      upserted += slice.length
    }
  }

  return { upserted, errors }
}

/**
 * Pipeline completa: busca os insights da meta-api (HMAC) e faz upsert no
 * mirror local. Usada pelo ping `insights.synced` e pelo botão de refresh.
 * Best-effort — devolve contadores, nunca lança.
 */
export async function refreshInsightsMirror(
  supabase: AdminSupabase,
  params: FetchInsightsParams = {},
): Promise<{ ok: boolean; fetched: number; upserted: number; errors: number }> {
  const env = readEnv()
  if (!env) return { ok: false, fetched: 0, upserted: 0, errors: 0 }

  const { ok, insights } = await fetchAllInsights(params)
  if (!ok && insights.length === 0) {
    return { ok: false, fetched: 0, upserted: 0, errors: 0 }
  }

  const { upserted, errors } = await mirrorInsightsToDb(
    supabase,
    insights,
    env.tenantId,
  )
  return { ok, fetched: insights.length, upserted, errors }
}
