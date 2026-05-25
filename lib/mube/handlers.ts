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

import type {
  MubeAdEvent,
  MubeCampaignEvent,
  MubeFormEvent,
  MubeLeadEvent,
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
  return NextResponse.json({ ok: true })
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
