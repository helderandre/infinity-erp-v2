/**
 * Handlers por tipo de evento do meta-api Mube.
 *
 * Cada função aceita um SupabaseClient (service_role) injectado pela rota.
 * A lógica de upsert/silent-fail vive num só sítio, partilhada por:
 *   - /api/webhooks/mube/leads  (legacy, aceita só lead.created)
 *   - /api/webhooks/mube/events (multiplex, aceita os 4 event types)
 *
 * Padrão silent-fail: todo upsert chama .select('id'). Se a resposta vier
 * com error === null && data?.length === 0, devolvemos 500 (upsert_silent_fail)
 * para o meta-api fazer retry. Sem isto, RLS misconfiguration ou schema não-exposto
 * passa silenciosamente e os eventos perdem-se.
 *
 * Tipos: usamos SupabaseClient genérico (untyped) porque o schema `meta` não
 * faz parte do generated Database type. Os payloads vão como `any` para o upsert.
 */

import { NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'

import { ingestLead } from '@/lib/crm/ingest-lead'
import { metaLeadToIngestInput } from '@/lib/mube/lead-to-ingest'
import { getGestoraLeadsUserIds } from '@/lib/crm/gestora-leads'
import { sendPushToUser } from '@/lib/crm/send-push'
import { refreshInsightsMirror } from '@/lib/mube/insights-client'
import type {
  MubeAdEvent,
  MubeAdObjectIssueEvent,
  MubeCampaignEvent,
  MubeCreativeEvent,
  MubeFormEvent,
  MubeInsightsEvent,
  MubeLeadEvent,
  MubeLeadPayload,
} from '@/lib/mube/types'

// Untyped client (admin/service_role). O schema meta não está nos types gerados.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AdminSupabase = SupabaseClient<any, 'public', any>

export async function handleLeadCreated(
  event: MubeLeadEvent,
  supabase: AdminSupabase,
  deliveryId: string | null,
): Promise<NextResponse> {
  const { lead } = event
  if (!lead?.leadgen_id) {
    console.warn('[mube-webhook] lead.created without leadgen_id', { deliveryId })
    return NextResponse.json({ error: 'invalid_event' }, { status: 400 })
  }

  const { data, error } = await supabase
    .schema('meta')
    .from('meta_leads_raw')
    .upsert(
      {
        payload: event,
        leadgen_id: lead.leadgen_id,
        mube_tenant_id: event.tenant_id,
        page_id: lead.page_id,
        form_id: lead.form_id,
        ad_id: lead.ad_id,
        campaign_id: lead.campaign_id,
        email: lead.email,
        full_name: lead.full_name,
        phone: lead.phone,
        fb_created_time: lead.fb_created_time,
        // Custo por lead (aproximação). Chega null em leads novos — preenchido
        // depois pelo sync de insights. Só sobrepõe quando o payload o traz.
        cost_per_lead: lead.cost?.per_lead ?? null,
        cost_currency: lead.cost?.currency ?? null,
        cost_basis: lead.cost?.basis ?? null,
        signature_valid: true,
        received_at: new Date().toISOString(),
        processed: false,
      },
      { onConflict: 'leadgen_id' },
    )
    .select('id')

  if (error) {
    console.error('[mube-webhook] lead.created upsert failed', {
      deliveryId,
      leadgenId: lead.leadgen_id,
      err: error,
    })
    return NextResponse.json({ error: 'internal_error' }, { status: 500 })
  }
  if (!data || data.length === 0) {
    console.error('[mube-webhook] lead.created upsert returned no rows', {
      deliveryId,
      leadgenId: lead.leadgen_id,
    })
    return NextResponse.json({ error: 'upsert_silent_fail' }, { status: 500 })
  }

  console.info('[mube-webhook] lead.created received', {
    deliveryId,
    leadgenId: lead.leadgen_id,
  })

  // Bridge into the CRM (gated by attribution rules). Best-effort — never
  // affects the 200 we return to Mube. The raw row is already safely stored.
  const rawId = data[0]?.id as string | undefined
  if (rawId) {
    await bridgeMetaLeadToCrm(lead, supabase, rawId, deliveryId)
  }

  return NextResponse.json({ ok: true })
}

export interface BridgeResult {
  status: 'ingested' | 'already' | 'unattributed' | 'error'
  contact_id?: string
  entry_id?: string
}

/**
 * Bridge: turn a stored Mube lead into a CRM lead via the unified ingestLead
 * pipeline. By default it is GATED — ingests only when an attribution rule
 * matches (leads with no matching campaign/ad rule stay in meta_leads_raw,
 * processed=false, in the "Por atribuir" inbox). Pass `forceAgentId` to assign
 * a specific consultor regardless of rules (manual assign from the inbox).
 *
 * Reused by: the webhook (gated), the retroactive backfill on rule creation
 * (gated), and the manual-assign endpoint (forced).
 *
 * Idempotent: skips ingest when a leads_entries already carries this leadgen_id
 * (Mube re-delivers on retry, and the raw upsert resets processed=false).
 *
 * Best-effort: never throws. Webhook callers must NOT bubble a 500, since Mube
 * would retry and ingestLead is not idempotent on entry creation.
 */
export async function bridgeMetaLeadToCrm(
  lead: MubeLeadPayload,
  supabase: AdminSupabase,
  rawId: string,
  deliveryId: string | null,
  opts?: { forceAgentId?: string },
): Promise<BridgeResult> {
  try {
    // 1. Idempotency guard — already ingested for this leadgen_id?
    const { data: existing } = await supabase
      .from('leads_entries')
      .select('id, contact_id')
      .eq('form_data->>leadgen_id', lead.leadgen_id)
      .limit(1)
      .maybeSingle()

    if (existing?.id) {
      await supabase
        .schema('meta')
        .from('meta_leads_raw')
        .update({
          processed: true,
          processed_at: new Date().toISOString(),
          lead_id: existing.contact_id,
        })
        .eq('id', rawId)
      return { status: 'already', contact_id: existing.contact_id }
    }

    // 2. Enrich adset_id from the synced ad (the lead payload doesn't carry it).
    let adsetId: string | null = null
    if (lead.ad_id) {
      const { data: ad } = await supabase
        .schema('meta')
        .from('meta_ads_raw')
        .select('adset_id')
        .eq('ad_id', lead.ad_id)
        .maybeSingle()
      adsetId = (ad?.adset_id as string | null) ?? null
    }

    const input = metaLeadToIngestInput(lead, adsetId)

    // 3. Ingest — forced (manual) or gated (webhook/backfill).
    let result
    if (opts?.forceAgentId) {
      result = await ingestLead(supabase, { ...input, assigned_agent_id: opts.forceAgentId })
    } else {
      result = await ingestLead(supabase, input, { requireMatchedRule: true })
      if (!result) {
        // Lead sem regra de atribuição → fica no "Por atribuir". Avisa a(s)
        // Gestora(s) de Leads por push; o click abre a tab "Por atribuir"
        // dentro da Gestão de Leads.
        try {
          const gestoras = await getGestoraLeadsUserIds(supabase)
          await Promise.all(
            gestoras.map((uid) =>
              sendPushToUser(supabase, uid, {
                title: 'Nova lead por atribuir',
                body: `${input.name} — via Meta Ads`,
                url: '/dashboard/crm/leads?gestao=por_atribuir',
                tag: `lead-unattributed-${lead.leadgen_id}`,
              }),
            ),
          )
        } catch {
          /* best-effort — nunca bloqueia o webhook */
        }
        console.info('[mube-webhook] lead unattributed — left in inbox', {
          deliveryId,
          leadgenId: lead.leadgen_id,
        })
        return { status: 'unattributed' }
      }
    }

    // 4. Stamp the back-reference onto the raw row.
    await supabase
      .schema('meta')
      .from('meta_leads_raw')
      .update({
        processed: true,
        processed_at: new Date().toISOString(),
        lead_id: result.contact_id,
      })
      .eq('id', rawId)

    console.info('[mube-webhook] lead ingested to CRM', {
      deliveryId,
      leadgenId: lead.leadgen_id,
      contactId: result.contact_id,
      entryId: result.entry_id,
      agent: result.assigned_agent_id ?? 'pool',
      forced: !!opts?.forceAgentId,
    })
    return { status: 'ingested', contact_id: result.contact_id, entry_id: result.entry_id }
  } catch (err) {
    console.error('[mube-webhook] bridge to CRM failed (left unprocessed)', {
      deliveryId,
      leadgenId: lead.leadgen_id,
      err,
    })
    return { status: 'error' }
  }
}

export async function handleFormSynced(
  event: MubeFormEvent,
  supabase: AdminSupabase,
  deliveryId: string | null,
): Promise<NextResponse> {
  const { form } = event
  if (!form?.form_id) {
    console.warn('[mube-webhook] form.synced without form_id', { deliveryId })
    return NextResponse.json({ error: 'invalid_event' }, { status: 400 })
  }

  const { data, error } = await supabase
    .schema('meta')
    .from('meta_forms_raw')
    .upsert(
      {
        payload: event,
        form_id: form.form_id,
        page_id: form.page_id,
        mube_tenant_id: event.tenant_id,
        form_name: form.form_name,
        status: form.status,
        locale: form.locale,
        fb_created_time: form.fb_created_time,
        signature_valid: true,
        received_at: new Date().toISOString(),
        processed: false,
      },
      { onConflict: 'form_id' },
    )
    .select('id')

  if (error) {
    console.error('[mube-webhook] form.synced upsert failed', {
      deliveryId,
      formId: form.form_id,
      err: error,
    })
    return NextResponse.json({ error: 'internal_error' }, { status: 500 })
  }
  if (!data || data.length === 0) {
    console.error('[mube-webhook] form.synced upsert returned no rows', {
      deliveryId,
      formId: form.form_id,
    })
    return NextResponse.json({ error: 'upsert_silent_fail' }, { status: 500 })
  }

  console.info('[mube-webhook] form.synced received', {
    deliveryId,
    formId: form.form_id,
  })
  return NextResponse.json({ ok: true })
}

export async function handleCampaignSynced(
  event: MubeCampaignEvent,
  supabase: AdminSupabase,
  deliveryId: string | null,
): Promise<NextResponse> {
  const { campaign } = event
  if (!campaign?.campaign_id) {
    console.warn('[mube-webhook] campaign.synced without campaign_id', { deliveryId })
    return NextResponse.json({ error: 'invalid_event' }, { status: 400 })
  }

  const { data, error } = await supabase
    .schema('meta')
    .from('meta_campaigns_raw')
    .upsert(
      {
        payload: event,
        campaign_id: campaign.campaign_id,
        ad_account_id: campaign.ad_account_id,
        mube_tenant_id: event.tenant_id,
        name: campaign.name,
        status: campaign.status,
        objective: campaign.objective,
        daily_budget: campaign.daily_budget ?? null,
        lifetime_budget: campaign.lifetime_budget ?? null,
        start_time: campaign.start_time ?? null,
        stop_time: campaign.stop_time ?? null,
        fb_created_time: campaign.fb_created_time,
        signature_valid: true,
        received_at: new Date().toISOString(),
        processed: false,
      },
      { onConflict: 'campaign_id' },
    )
    .select('id')

  if (error) {
    console.error('[mube-webhook] campaign.synced upsert failed', {
      deliveryId,
      campaignId: campaign.campaign_id,
      err: error,
    })
    return NextResponse.json({ error: 'internal_error' }, { status: 500 })
  }
  if (!data || data.length === 0) {
    console.error('[mube-webhook] campaign.synced upsert returned no rows', {
      deliveryId,
      campaignId: campaign.campaign_id,
    })
    return NextResponse.json({ error: 'upsert_silent_fail' }, { status: 500 })
  }

  console.info('[mube-webhook] campaign.synced received', {
    deliveryId,
    campaignId: campaign.campaign_id,
  })
  return NextResponse.json({ ok: true })
}

export async function handleAdSynced(
  event: MubeAdEvent,
  supabase: AdminSupabase,
  deliveryId: string | null,
): Promise<NextResponse> {
  const { ad } = event
  if (!ad?.ad_id) {
    console.warn('[mube-webhook] ad.synced without ad_id', { deliveryId })
    return NextResponse.json({ error: 'invalid_event' }, { status: 400 })
  }

  const { data, error } = await supabase
    .schema('meta')
    .from('meta_ads_raw')
    .upsert(
      {
        payload: event,
        ad_id: ad.ad_id,
        campaign_id: ad.campaign_id,
        adset_id: ad.adset_id ?? null,
        mube_tenant_id: event.tenant_id,
        name: ad.name,
        status: ad.status,
        creative_id: ad.creative_id ?? null,
        creative_name: ad.creative_name ?? null,
        fb_created_time: ad.fb_created_time,
        signature_valid: true,
        received_at: new Date().toISOString(),
        processed: false,
      },
      { onConflict: 'ad_id' },
    )
    .select('id')

  if (error) {
    console.error('[mube-webhook] ad.synced upsert failed', {
      deliveryId,
      adId: ad.ad_id,
      err: error,
    })
    return NextResponse.json({ error: 'internal_error' }, { status: 500 })
  }
  if (!data || data.length === 0) {
    console.error('[mube-webhook] ad.synced upsert returned no rows', {
      deliveryId,
      adId: ad.ad_id,
    })
    return NextResponse.json({ error: 'upsert_silent_fail' }, { status: 500 })
  }

  console.info('[mube-webhook] ad.synced received', {
    deliveryId,
    adId: ad.ad_id,
  })
  return NextResponse.json({ ok: true })
}

/**
 * creative.synced — criativo completo (imagem/vídeo/copy/CTA/link). Upsert
 * idempotente por creative_id. Liga-se ao anúncio (meta_ads_raw.creative_id).
 */
export async function handleCreativeSynced(
  event: MubeCreativeEvent,
  supabase: AdminSupabase,
  deliveryId: string | null,
): Promise<NextResponse> {
  const { creative } = event
  if (!creative?.creative_id) {
    console.warn('[mube-webhook] creative.synced without creative_id', { deliveryId })
    return NextResponse.json({ error: 'invalid_event' }, { status: 400 })
  }

  const { data, error } = await supabase
    .schema('meta')
    .from('meta_creatives_raw')
    .upsert(
      {
        payload: event,
        creative_id: creative.creative_id,
        ad_account_id: creative.ad_account_id,
        mube_tenant_id: event.tenant_id,
        name: creative.name,
        title: creative.title,
        body: creative.body,
        cta_type: creative.cta_type,
        link_url: creative.link_url,
        image_url: creative.image_url,
        thumbnail_url: creative.thumbnail_url,
        video_id: creative.video_id,
        object_story_spec: creative.object_story_spec ?? null,
        signature_valid: true,
        received_at: new Date().toISOString(),
        processed: false,
      },
      { onConflict: 'creative_id' },
    )
    .select('id')

  if (error) {
    console.error('[mube-webhook] creative.synced upsert failed', {
      deliveryId,
      creativeId: creative.creative_id,
      err: error,
    })
    return NextResponse.json({ error: 'internal_error' }, { status: 500 })
  }
  if (!data || data.length === 0) {
    console.error('[mube-webhook] creative.synced upsert returned no rows', {
      deliveryId,
      creativeId: creative.creative_id,
    })
    return NextResponse.json({ error: 'upsert_silent_fail' }, { status: 500 })
  }

  console.info('[mube-webhook] creative.synced received', {
    deliveryId,
    creativeId: creative.creative_id,
  })
  return NextResponse.json({ ok: true })
}

/**
 * insights.synced — PING (sem métricas). Usamos como gatilho para re-buscar os
 * insights da meta-api (GET /api/insights, HMAC server-side) e fazer upsert no
 * mirror local meta.meta_insights_raw, na mesma janela [since, until] que o
 * ping reporta. Best-effort: nunca falha o webhook (insights.synced é
 * fire-and-forget — re-emitido no próximo sync).
 */
export async function handleInsightsSynced(
  event: MubeInsightsEvent,
  supabase: AdminSupabase,
  deliveryId: string | null,
): Promise<NextResponse> {
  const { insights } = event
  if (!insights?.ad_account_id) {
    console.warn('[mube-webhook] insights.synced without ad_account_id', { deliveryId })
    return NextResponse.json({ error: 'invalid_event' }, { status: 400 })
  }

  try {
    const result = await refreshInsightsMirror(supabase, {
      adAccountId: insights.ad_account_id,
      from: insights.since,
      to: insights.until,
    })
    console.info('[mube-webhook] insights.synced refreshed mirror', {
      deliveryId,
      adAccountId: insights.ad_account_id,
      since: insights.since,
      until: insights.until,
      pingRows: insights.rows_upserted,
      ...result,
    })
  } catch (err) {
    // Best-effort — o ping é re-emitido no próximo sync e há o botão manual.
    console.error('[mube-webhook] insights.synced mirror refresh threw', {
      deliveryId,
      err: err instanceof Error ? err.message : String(err),
    })
  }

  return NextResponse.json({ ok: true })
}

/**
 * ad_object.issue — alerta de estado/problema (webhook de Ad Account). Log de
 * eventos: uma linha por entrega (insert, não upsert) para manter o histórico.
 */
export async function handleAdObjectIssue(
  event: MubeAdObjectIssueEvent,
  supabase: AdminSupabase,
  deliveryId: string | null,
): Promise<NextResponse> {
  const { ad_object } = event
  if (!ad_object?.ad_account_id) {
    console.warn('[mube-webhook] ad_object.issue without ad_account_id', { deliveryId })
    return NextResponse.json({ error: 'invalid_event' }, { status: 400 })
  }

  const { data, error } = await supabase
    .schema('meta')
    .from('meta_ad_object_issues')
    .insert({
      payload: event,
      mube_tenant_id: event.tenant_id,
      ad_account_id: ad_object.ad_account_id,
      field: ad_object.field,
      value: ad_object.value,
      delivery_id: deliveryId,
      signature_valid: true,
      received_at: new Date().toISOString(),
    })
    .select('id')

  if (error) {
    console.error('[mube-webhook] ad_object.issue insert failed', {
      deliveryId,
      adAccountId: ad_object.ad_account_id,
      err: error,
    })
    return NextResponse.json({ error: 'internal_error' }, { status: 500 })
  }
  if (!data || data.length === 0) {
    console.error('[mube-webhook] ad_object.issue insert returned no rows', {
      deliveryId,
      adAccountId: ad_object.ad_account_id,
    })
    return NextResponse.json({ error: 'insert_silent_fail' }, { status: 500 })
  }

  console.info('[mube-webhook] ad_object.issue received', {
    deliveryId,
    adAccountId: ad_object.ad_account_id,
    field: ad_object.field,
  })
  return NextResponse.json({ ok: true })
}
