/**
 * POST /api/webhooks/mube/events
 *
 * Rota multiplex: recebe qualquer evento do meta-api Mube (lead.created,
 * form.synced, campaign.synced, ad.synced) e despacha para o handler certo
 * em lib/mube/handlers.ts.
 *
 * IMPORTANTE: lê req.text() ANTES de qualquer JSON.parse — a assinatura HMAC
 * é calculada sobre o body cru.
 *
 * Autenticação: HMAC SHA256 sobre o body cru via header X-Mube-Signature-256.
 * Não usa sessão Supabase. Service role bypassa RLS para gravar.
 *
 * A rota antiga /api/webhooks/mube/leads continua a aceitar lead.created
 * (retrocompat). Para receber também form/campaign/ad, registar este URL
 * como destination no meta-api.
 */

import { NextRequest, NextResponse } from 'next/server'

import {
  handleAdObjectIssue,
  handleAdSynced,
  handleCampaignSynced,
  handleCreativeSynced,
  handleFormSynced,
  handleInsightsSynced,
  handleLeadCreated,
} from '@/lib/mube/handlers'
import { isValidMubeSignature } from '@/lib/mube/signature'
import { createCrmAdminClient } from '@/lib/supabase/admin-untyped'
import type { MubeEvent } from '@/lib/mube/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const rawBody = await req.text()
  const signatureHeader = req.headers.get('x-mube-signature-256')
  const deliveryId = req.headers.get('x-mube-delivery-id')

  const signingSecret = process.env.MUBE_SIGNING_SECRET
  if (!signingSecret) {
    console.error('[mube-webhook] MUBE_SIGNING_SECRET not configured')
    return NextResponse.json({ error: 'server_misconfigured' }, { status: 500 })
  }

  if (!isValidMubeSignature(rawBody, signatureHeader, signingSecret)) {
    console.warn('[mube-webhook] Invalid signature', { deliveryId })
    return NextResponse.json({ error: 'invalid_signature' }, { status: 401 })
  }

  let event: MubeEvent
  try {
    event = JSON.parse(rawBody) as MubeEvent
  } catch {
    console.warn('[mube-webhook] Invalid JSON', { deliveryId })
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  if (event.version !== '1') {
    console.warn('[mube-webhook] Unsupported version', {
      deliveryId,
      version: (event as { version?: unknown }).version,
    })
    return NextResponse.json({ error: 'unsupported_version' }, { status: 400 })
  }

  const expectedTenantId = process.env.MUBE_TENANT_ID
  if (expectedTenantId && event.tenant_id !== expectedTenantId) {
    console.warn('[mube-webhook] Tenant mismatch', {
      deliveryId,
      received: event.tenant_id,
      expected: expectedTenantId,
    })
    return NextResponse.json({ error: 'tenant_mismatch' }, { status: 403 })
  }

  let supabase
  try {
    supabase = createCrmAdminClient()
  } catch (err) {
    console.error('[mube-webhook] Supabase admin client init failed', { err })
    return NextResponse.json({ error: 'server_misconfigured' }, { status: 500 })
  }

  switch (event.event) {
    case 'lead.created':
      return handleLeadCreated(event, supabase, deliveryId)
    case 'form.synced':
      return handleFormSynced(event, supabase, deliveryId)
    case 'campaign.synced':
      return handleCampaignSynced(event, supabase, deliveryId)
    case 'ad.synced':
      return handleAdSynced(event, supabase, deliveryId)
    case 'creative.synced':
      return handleCreativeSynced(event, supabase, deliveryId)
    case 'insights.synced':
      return handleInsightsSynced(event, supabase, deliveryId)
    case 'ad_object.issue':
      return handleAdObjectIssue(event, supabase, deliveryId)
    default: {
      const unknown = (event as { event?: string }).event
      console.warn('[mube-webhook] Unknown event type', {
        deliveryId,
        event: unknown,
      })
      return NextResponse.json({ error: 'unknown_event' }, { status: 400 })
    }
  }
}
