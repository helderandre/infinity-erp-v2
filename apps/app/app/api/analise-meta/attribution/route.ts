/**
 * Atribuição de campanhas / anúncios Meta a consultores (+ referral).
 *
 * Cada "atribuição" é uma row em leads_assignment_rules pinada a um Meta ID:
 *   - scope='campaign' → campaign_external_id_match = <meta campaign_id>, priority 50
 *   - scope='ad'       → ad_id_match = <meta ad_id>,                      priority 100
 * Precedência ad > campaign vem do priority. source_match=['meta_ads'] limita o
 * efeito aos leads Meta. O referral declarado aqui é carimbado em cada lead que
 * a regra atribui (ver lib/crm/assignment-engine.ts + ingest-lead.ts).
 *
 * Gate: só gestão/Marketing (canManageAttribution). GET é read-only (auth).
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { createClient } from '@/lib/supabase/server'
import { createCrmAdminClient } from '@/lib/supabase/admin-untyped'
import { canManageAttribution } from '@/lib/analise-meta/can-manage-attribution'
import { bridgeMetaLeadToCrm } from '@/lib/mube/handlers'
import type { MubeLeadEvent } from '@/lib/mube/types'

// Cap on how many already-arrived leads we backfill inline when a rule is saved.
const BACKFILL_LIMIT = 25

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const uuid = z.string().regex(UUID_RE, 'UUID inválido')

const scopeEnum = z.enum(['campaign', 'ad'])

const upsertSchema = z
  .object({
    scope: scopeEnum,
    target_id: z.string().min(1),
    target_name: z.string().trim().max(200).optional().nullable(),
    consultant_id: uuid,
    has_referral: z.boolean().default(false),
    referral_consultant_id: uuid.optional().nullable(),
    referral_pct: z.number().min(0).max(100).optional().nullable(),
    referral_basis: z
      .enum(['agency_commission', 'sale_value', 'fixed'])
      .default('agency_commission'),
    referral_fixed_amount: z.number().min(0).optional().nullable(),
    // Lead type the campaign/ad generates (pre-fills qualification).
    lead_sector: z
      .enum(['real_estate_buy', 'real_estate_sell', 'real_estate_rent', 'real_estate_landlord'])
      .optional()
      .nullable(),
    lead_business_type: z.enum(['Venda', 'Arrendamento', 'Trespasse']).optional().nullable(),
    // Imóvel a que a campanha/anúncio pertence. Carimbado em cada lead que a
    // regra atribui (leads_entries.property_id) + faz aparecer a campanha e os
    // seus leads na página do imóvel.
    property_id: uuid.optional().nullable(),
  })
  .superRefine((v, ctx) => {
    if (!v.has_referral) return
    if (!v.referral_consultant_id) {
      ctx.addIssue({ code: 'custom', path: ['referral_consultant_id'], message: 'Indique o consultor que recebe o referral.' })
    }
    if (v.referral_basis === 'fixed') {
      if (v.referral_fixed_amount == null || v.referral_fixed_amount <= 0) {
        ctx.addIssue({ code: 'custom', path: ['referral_fixed_amount'], message: 'Indique o valor fixo do referral.' })
      }
    } else if (v.referral_pct == null || v.referral_pct <= 0) {
      ctx.addIssue({ code: 'custom', path: ['referral_pct'], message: 'Indique a percentagem do referral.' })
    }
  })

function matchColumnFor(scope: 'campaign' | 'ad'): 'campaign_external_id_match' | 'ad_id_match' {
  return scope === 'ad' ? 'ad_id_match' : 'campaign_external_id_match'
}

function priorityFor(scope: 'campaign' | 'ad'): number {
  return scope === 'ad' ? 100 : 50
}

// ── GET: current attribution for a campaign/ad ──────────────────────────────
export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const scopeParsed = scopeEnum.safeParse(searchParams.get('scope'))
  const targetId = searchParams.get('target_id')
  if (!scopeParsed.success || !targetId) {
    return NextResponse.json({ error: 'scope/target_id obrigatórios' }, { status: 400 })
  }

  const db = createCrmAdminClient()
  const col = matchColumnFor(scopeParsed.data)
  const { data: rule, error } = await db
    .from('leads_assignment_rules')
    .select('*')
    .eq(col, targetId)
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Hidrata o imóvel associado (se houver) para o painel mostrar o título.
  let property: { id: string; title: string | null; external_ref: string | null } | null = null
  if (rule?.property_id) {
    const { data: prop } = await db
      .from('dev_properties')
      .select('id, title, external_ref')
      .eq('id', rule.property_id)
      .maybeSingle()
    property = prop ?? null
  }

  const canManage = await canManageAttribution(db, user.id)
  return NextResponse.json({ rule: rule ?? null, property, can_manage: canManage })
}

// ── POST: upsert attribution ────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })

  const db = createCrmAdminClient()
  if (!(await canManageAttribution(db, user.id))) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  const parsed = upsertSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }
  const v = parsed.data
  const col = matchColumnFor(v.scope)

  // Resolve the property's external_ref (canonical) from the chosen id so the
  // rule carries both columns in sync — same shape the assignment engine reads.
  let propertyExternalRef: string | null = null
  let linkedProperty: { id: string; title: string | null; external_ref: string | null } | null = null
  if (v.property_id) {
    const { data: prop } = await db
      .from('dev_properties')
      .select('id, title, external_ref')
      .eq('id', v.property_id)
      .maybeSingle()
    propertyExternalRef = prop?.external_ref ?? null
    linkedProperty = prop ?? null
  }

  const label =
    v.scope === 'ad'
      ? `[Meta] Anúncio ${v.target_name ?? v.target_id}`
      : `[Meta] Campanha ${v.target_name ?? v.target_id}`

  const payload = {
    name: label.slice(0, 200),
    description: `Atribuição automática de leads Meta (${v.scope}).`,
    source_match: ['meta_ads'],
    campaign_external_id_match: v.scope === 'campaign' ? v.target_id : null,
    ad_id_match: v.scope === 'ad' ? v.target_id : null,
    consultant_id: v.consultant_id,
    priority: priorityFor(v.scope),
    is_active: true,
    fallback_action: 'gestora_pool',
    has_referral: v.has_referral,
    referral_consultant_id: v.has_referral ? v.referral_consultant_id ?? null : null,
    referral_pct: v.has_referral && v.referral_basis !== 'fixed' ? v.referral_pct ?? null : null,
    referral_basis: v.referral_basis,
    referral_fixed_amount: v.has_referral && v.referral_basis === 'fixed' ? v.referral_fixed_amount ?? null : null,
    lead_sector: v.lead_sector ?? null,
    lead_business_type: v.lead_business_type ?? null,
    property_id: v.property_id ?? null,
    property_external_ref: propertyExternalRef,
  }

  // Upsert: one attribution rule per (scope, target). Reuse the most recent.
  const { data: existing } = await db
    .from('leads_assignment_rules')
    .select('id')
    .eq(col, v.target_id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  let saved
  if (existing?.id) {
    const { data, error } = await db
      .from('leads_assignment_rules')
      .update(payload)
      .eq('id', existing.id)
      .select()
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    saved = data
  } else {
    const { data, error } = await db
      .from('leads_assignment_rules')
      .insert(payload)
      .select()
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    saved = data
  }

  // Property backfill — stamp this imóvel onto leads já existentes desta
  // campanha/anúncio que ainda não têm property_id (preenche só vazios). Faz a
  // campanha + histórico de leads aparecer na página do imóvel imediatamente.
  if (v.property_id) {
    const metaKey = v.scope === 'ad' ? 'meta_ad_id' : 'meta_campaign_id'
    await db
      .from('leads_entries')
      .update({ property_id: v.property_id, property_external_ref: propertyExternalRef })
      .eq('source', 'meta_ads')
      .eq(`form_data->>${metaKey}`, v.target_id)
      .is('property_id', null)
  }

  // Retroactive backfill — pull in leads that already arrived for this target
  // and are still unprocessed. The gated bridge now matches the rule we just
  // saved (assigns the consultor + stamps the referral). Best-effort, capped.
  const rawCol = v.scope === 'ad' ? 'ad_id' : 'campaign_id'
  const { data: pending } = await db
    .schema('meta')
    .from('meta_leads_raw')
    .select('id, payload')
    .eq(rawCol, v.target_id)
    .eq('processed', false)
    .limit(BACKFILL_LIMIT)

  let backfilled = 0
  for (const row of pending ?? []) {
    const lead = (row.payload as MubeLeadEvent | null)?.lead
    if (!lead?.leadgen_id) continue
    const r = await bridgeMetaLeadToCrm(lead, db, row.id as string, null)
    if (r.status === 'ingested' || r.status === 'already') backfilled++
  }

  return NextResponse.json({ rule: saved, property: linkedProperty, backfilled }, { status: 200 })
}

// ── DELETE: clear attribution (deactivate the rule) ─────────────────────────
export async function DELETE(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })

  const db = createCrmAdminClient()
  if (!(await canManageAttribution(db, user.id))) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const scopeParsed = scopeEnum.safeParse(searchParams.get('scope'))
  const targetId = searchParams.get('target_id')
  if (!scopeParsed.success || !targetId) {
    return NextResponse.json({ error: 'scope/target_id obrigatórios' }, { status: 400 })
  }

  const col = matchColumnFor(scopeParsed.data)
  const { error } = await db
    .from('leads_assignment_rules')
    .update({ is_active: false })
    .eq(col, targetId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
