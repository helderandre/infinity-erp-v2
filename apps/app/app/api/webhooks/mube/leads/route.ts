/**
 * POST /api/webhooks/mube/leads
 *
 * Legacy — aceita estritamente `event: "lead.created"`. Qualquer outro evento → 400.
 * Mantida para retrocompat. Para receber também form/campaign/ad, registar a
 * destination no meta-api para /api/webhooks/mube/events (rota multiplex).
 *
 * IMPORTANTE: lê `req.text()` ANTES de qualquer JSON.parse — a assinatura HMAC
 * é calculada sobre o body cru e qualquer reformatação inutilizaria a verificação.
 *
 * Autenticação: HMAC SHA256 sobre o body cru via header X-Mube-Signature-256.
 * Não usa sessão Supabase. Service role bypassa RLS para gravar.
 *
 * Retry policy do meta-api: backoff exponencial em 5xx (60s, 5min, 30min, 2h, 12h).
 * 401/400/403 são erros permanentes — não há retry.
 */

import { NextRequest, NextResponse } from 'next/server'

import { handleLeadCreated } from '@/lib/mube/handlers'
import { isValidMubeSignature } from '@/lib/mube/signature'
import { createCrmAdminClient } from '@/lib/supabase/admin-untyped'
import type { MubeLeadEvent } from '@/lib/mube/types'

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

  let event: MubeLeadEvent
  try {
    event = JSON.parse(rawBody) as MubeLeadEvent
  } catch {
    console.warn('[mube-webhook] Invalid JSON', { deliveryId })
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  if (event.version !== '1') {
    console.warn('[mube-webhook] Unsupported version', {
      deliveryId,
      version: event.version,
    })
    return NextResponse.json({ error: 'unsupported_version' }, { status: 400 })
  }

  if (event.event !== 'lead.created' || !event.lead?.leadgen_id) {
    console.warn('[mube-webhook] Invalid event shape', { deliveryId })
    return NextResponse.json({ error: 'invalid_event' }, { status: 400 })
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

  return handleLeadCreated(event, supabase, deliveryId)
}
