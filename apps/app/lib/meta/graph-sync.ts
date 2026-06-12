/**
 * Sincronização Meta via Graph API directa (app Meta — META_ACCESS_TOKEN +
 * META_AD_ACCOUNT_ID), em substituição do caminho mube (ligação federada, hoje
 * inactiva). Escreve no mesmo mirror `meta.*` que a Análise Meta lê, com as
 * mesmas formas de upsert dos webhook handlers — por isso a UI não muda.
 *
 * Estratégia:
 *   - campaigns / ads: sincroniza TUDO (upsert idempotente, nunca apaga → a
 *     memória do histórico mantém-se).
 *   - insights: campaign-level, por dia (time_increment=1) → spend/leads.
 *   - leads: só percorre os anúncios ACTIVE ou de campanhas com gasto (evita
 *     ~900 chamadas/loop). Leads de anúncios já pausados continuam no mirror.
 *
 * Best-effort por recurso; só lança em falta de credenciais ou falha dura no
 * primeiro fetch (auth). O wrapper actualiza meta_sync_jobs + notifica.
 */

import type { SupabaseClient } from '@supabase/supabase-js'

import type { SyncResource } from '@/hooks/use-meta-sync-job'
import { bridgeMetaLeadToCrm } from '@/lib/mube/handlers'
import type { MubeLeadPayload } from '@/lib/mube/types'
import { notify } from '@/lib/mube/run-sync-job'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AdminSupabase = SupabaseClient<any, 'public', any>

const GRAPH = 'https://graph.facebook.com/v21.0'
const MAX_PAGES = 50 // backstop p/ paginação (campaigns/ads/insights)
const MAX_LEAD_ADS = 400 // backstop p/ o loop de leads por anúncio

type Counters = Record<string, unknown>

interface GraphPage<T> {
  data: T[]
  paging?: { next?: string }
}

/** GET paginado ao Graph; segue paging.next até MAX_PAGES. Não lança — devolve
 *  o que conseguir + um erro opcional. */
async function graphGetAll<T>(url: string): Promise<{ rows: T[]; error: string | null }> {
  const rows: T[] = []
  let next: string | undefined = url
  let pages = 0
  while (next && pages < MAX_PAGES) {
    pages++
    const res = await fetch(next, { cache: 'no-store' })
    if (!res.ok) {
      const body = await res.json().catch(() => null)
      return { rows, error: body?.error?.message ?? `HTTP ${res.status}` }
    }
    const json = (await res.json()) as GraphPage<T>
    rows.push(...(json.data ?? []))
    next = json.paging?.next
  }
  return { rows, error: null }
}

function extractField(fieldData: Array<{ name: string; values?: string[] }> | undefined, ...names: string[]): string | null {
  if (!fieldData) return null
  for (const name of names) {
    const fd = fieldData.find((f) => f.name === name)
    if (fd?.values?.[0]) return fd.values[0]
  }
  return null
}

// ── Campaigns ────────────────────────────────────────────────────────────────
async function syncCampaigns(db: AdminSupabase, accountId: string, token: string): Promise<Counters> {
  const fields = 'id,name,status,objective,daily_budget,lifetime_budget,start_time,stop_time,created_time'
  const { rows, error } = await graphGetAll<Record<string, any>>(
    `${GRAPH}/${accountId}/campaigns?fields=${fields}&limit=200&access_token=${token}`,
  )
  if (error && rows.length === 0) throw new Error(error)

  let upserted = 0
  let errors = 0
  for (const c of rows) {
    const { error: upErr } = await db
      .schema('meta')
      .from('meta_campaigns_raw')
      .upsert(
        {
          payload: c,
          campaign_id: c.id,
          ad_account_id: accountId,
          mube_tenant_id: null,
          name: c.name ?? null,
          status: c.status ?? null,
          objective: c.objective ?? null,
          daily_budget: c.daily_budget != null ? String(c.daily_budget) : null,
          lifetime_budget: c.lifetime_budget != null ? String(c.lifetime_budget) : null,
          start_time: c.start_time ?? null,
          stop_time: c.stop_time ?? null,
          fb_created_time: c.created_time ?? null,
          signature_valid: true,
          received_at: new Date().toISOString(),
          processed: true,
        },
        { onConflict: 'campaign_id' },
      )
    if (upErr) errors++
    else upserted++
  }
  return { fetched: rows.length, upserted, errors }
}

// ── Ads ──────────────────────────────────────────────────────────────────────
async function syncAds(db: AdminSupabase, accountId: string, token: string): Promise<Counters> {
  const fields = 'id,name,status,campaign_id,adset_id,creative{id,name},created_time'
  const { rows, error } = await graphGetAll<Record<string, any>>(
    `${GRAPH}/${accountId}/ads?fields=${fields}&limit=500&access_token=${token}`,
  )
  if (error && rows.length === 0) throw new Error(error)

  let upserted = 0
  let errors = 0
  for (const a of rows) {
    const { error: upErr } = await db
      .schema('meta')
      .from('meta_ads_raw')
      .upsert(
        {
          payload: a,
          ad_id: a.id,
          campaign_id: a.campaign_id ?? null,
          adset_id: a.adset_id ?? null,
          mube_tenant_id: null,
          name: a.name ?? null,
          status: a.status ?? null,
          creative_id: a.creative?.id ?? null,
          creative_name: a.creative?.name ?? null,
          fb_created_time: a.created_time ?? null,
          signature_valid: true,
          received_at: new Date().toISOString(),
          processed: true,
        },
        { onConflict: 'ad_id' },
      )
    if (upErr) errors++
    else upserted++
  }
  return { fetched: rows.length, upserted, errors }
}

// ── Insights (campaign-level, por dia) ────────────────────────────────────────
function leadsFromActions(actions: Array<{ action_type: string; value: string }> | undefined): number {
  if (!actions) return 0
  return actions
    .filter((a) => a.action_type && a.action_type.toLowerCase().includes('lead'))
    .reduce((s, a) => s + Number(a.value ?? 0), 0)
}

async function syncInsights(db: AdminSupabase, accountId: string, token: string): Promise<Counters> {
  const fields = 'campaign_id,spend,impressions,reach,frequency,clicks,inline_link_clicks,cpc,cpm,ctr,actions,account_currency'
  const { rows, error } = await graphGetAll<Record<string, any>>(
    `${GRAPH}/${accountId}/insights?level=campaign&fields=${fields}&time_increment=1&date_preset=maximum&limit=500&access_token=${token}`,
  )
  if (error && rows.length === 0) throw new Error(error)

  let upserted = 0
  let errors = 0
  for (const r of rows) {
    if (!r.campaign_id || !r.date_start) continue
    const { error: upErr } = await db
      .schema('meta')
      .from('meta_insights_raw')
      .upsert(
        {
          external_id: `graph_campaign_${r.campaign_id}_${r.date_start}`,
          payload: r,
          mube_tenant_id: null,
          ad_account_id: accountId,
          level: 'campaign',
          object_id: r.campaign_id,
          campaign_id: r.campaign_id,
          adset_id: null,
          ad_id: null,
          date_start: r.date_start,
          date_stop: r.date_stop ?? r.date_start,
          spend: r.spend != null ? Number(r.spend) : null,
          impressions: r.impressions != null ? Number(r.impressions) : null,
          reach: r.reach != null ? Number(r.reach) : null,
          frequency: r.frequency != null ? Number(r.frequency) : null,
          clicks: r.clicks != null ? Number(r.clicks) : null,
          inline_link_clicks: r.inline_link_clicks != null ? Number(r.inline_link_clicks) : null,
          cpc: r.cpc != null ? Number(r.cpc) : null,
          cpm: r.cpm != null ? Number(r.cpm) : null,
          ctr: r.ctr != null ? Number(r.ctr) : null,
          leads: leadsFromActions(r.actions),
          actions: r.actions ?? null,
          account_currency: r.account_currency ?? null,
          received_at: new Date().toISOString(),
        },
        { onConflict: 'level,object_id,date_start' },
      )
    if (upErr) errors++
    else upserted++
  }
  return { fetched: rows.length, upserted, errors }
}

// ── Leads (só anúncios ACTIVE ou de campanhas com gasto) ──────────────────────
async function syncLeads(db: AdminSupabase, token: string): Promise<Counters> {
  // Campanhas com gasto (a partir do mirror de insights acabado de sincronizar).
  const { data: spendRows } = await db
    .schema('meta')
    .from('meta_insights_raw')
    .select('campaign_id, spend')
    .eq('level', 'campaign')
    .gt('spend', 0)
    .limit(20000)
  const spendCampaignIds = new Set(
    ((spendRows ?? []) as Array<{ campaign_id: string | null }>).map((r) => r.campaign_id).filter(Boolean),
  )

  // Anúncios-alvo: ACTIVE ∪ (campanha com gasto). Lê do mirror já sincronizado.
  const { data: activeAds } = await db
    .schema('meta')
    .from('meta_ads_raw')
    .select('ad_id, campaign_id, status')
    .limit(20000)
  const targetAds = ((activeAds ?? []) as Array<{ ad_id: string; campaign_id: string | null; status: string | null }>)
    .filter((a) => a.status === 'ACTIVE' || (a.campaign_id && spendCampaignIds.has(a.campaign_id)))
    .slice(0, MAX_LEAD_ADS)

  let fetched = 0
  let upserted = 0
  let ingested = 0
  let errors = 0

  for (const ad of targetAds) {
    const fields = 'id,created_time,field_data,ad_id,campaign_id,form_id,form_name,platform,is_organic'
    const { rows, error } = await graphGetAll<Record<string, any>>(
      `${GRAPH}/${ad.ad_id}/leads?fields=${fields}&limit=500&access_token=${token}`,
    )
    if (error) { errors++; continue }

    for (const ml of rows) {
      fetched++
      const email = extractField(ml.field_data, 'email', 'e-mail')
      const phone = extractField(ml.field_data, 'phone_number', 'phone', 'número_de_telefone', 'numero_de_telefone', 'telefone')
      const fullName =
        extractField(ml.field_data, 'full_name', 'nome_completo') ??
        ([extractField(ml.field_data, 'first_name'), extractField(ml.field_data, 'last_name')].filter(Boolean).join(' ') || null)

      const lead: MubeLeadPayload = {
        id: ml.id,
        leadgen_id: ml.id,
        page_id: '',
        form_id: ml.form_id ?? null,
        form_name: ml.form_name ?? null,
        ad_id: ml.ad_id ?? ad.ad_id,
        campaign_id: ml.campaign_id ?? ad.campaign_id ?? null,
        email,
        full_name: fullName,
        phone,
        field_data: (ml.field_data ?? []) as MubeLeadPayload['field_data'],
        fb_created_time: ml.created_time ?? null,
        received_at: new Date().toISOString(),
      }

      const { data: upData, error: upErr } = await db
        .schema('meta')
        .from('meta_leads_raw')
        .upsert(
          {
            payload: ml,
            leadgen_id: lead.leadgen_id,
            mube_tenant_id: null,
            page_id: lead.page_id,
            form_id: lead.form_id,
            ad_id: lead.ad_id,
            campaign_id: lead.campaign_id,
            email: lead.email,
            full_name: lead.full_name,
            phone: lead.phone,
            fb_created_time: lead.fb_created_time,
            signature_valid: true,
            received_at: new Date().toISOString(),
            processed: false,
          },
          { onConflict: 'leadgen_id' },
        )
        .select('id')
      if (upErr || !upData?.[0]) { errors++; continue }
      upserted++

      // Bridge para o CRM (gated por regras de atribuição) — idempotente.
      const bridge = await bridgeMetaLeadToCrm(lead, db, upData[0].id as string, null)
      if (bridge.status === 'ingested' || bridge.status === 'already') ingested++
    }
  }

  return { ads_scanned: targetAds.length, fetched, upserted, ingested, errors }
}

/**
 * Corre o sync via Graph para os recursos pedidos e fecha o job (done/error +
 * notificação). Mesma assinatura-base de runMetaSyncJob (drop-in no sync-jobs).
 */
export async function runMetaGraphSync(
  db: AdminSupabase,
  jobId: string,
  resources: SyncResource[],
  // null quando corre agendado (cron) — sem notificação per-user.
  userId: string | null,
): Promise<void> {
  const counters: Counters = {}
  try {
    const token = process.env.META_ACCESS_TOKEN
    const adAccountId = process.env.META_AD_ACCOUNT_ID
    if (!token || !adAccountId) throw new Error('no_meta_app_credentials')
    const accountId = adAccountId.startsWith('act_') ? adAccountId : `act_${adAccountId}`

    // Ordem fixa (independente da ordem pedida): campanhas → anúncios →
    // insights → leads (leads dependem dos anúncios/insights já no mirror).
    if (resources.includes('campaigns')) counters.campaigns = await syncCampaigns(db, accountId, token)
    if (resources.includes('ads')) counters.ads = await syncAds(db, accountId, token)
    if (resources.includes('insights')) counters.insights = await syncInsights(db, accountId, token)
    if (resources.includes('leads')) counters.leads = await syncLeads(db, token)

    await db
      .from('meta_sync_jobs')
      .update({ status: 'done', counters, finished_at: new Date().toISOString() })
      .eq('id', jobId)
    if (userId) await notify(db, userId, jobId, resources, 'done')
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown_error'
    console.error('[meta-graph-sync] failed', { jobId, resources, message })
    await db
      .from('meta_sync_jobs')
      .update({ status: 'error', error: message, counters, finished_at: new Date().toISOString() })
      .eq('id', jobId)
    if (userId) await notify(db, userId, jobId, resources, 'error', message)
  }
}
