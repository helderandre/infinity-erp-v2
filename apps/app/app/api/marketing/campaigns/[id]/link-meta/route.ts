import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/auth/permissions'
import { isPartner } from '@/lib/auth/roles'
import { createCrmAdminClient } from '@/lib/supabase/admin-untyped'

export const dynamic = 'force-dynamic'

const linkSchema = z.object({
  meta_campaign_id: z.string().trim().min(1, 'Indique o ID da campanha Meta.'),
  // Optional: % da comissão da agência que o parceiro recebe nos leads gerados.
  // Sem valor, a atribuição (referenciado) é carimbada mas sem comissão computada.
  referral_pct: z.number().min(0).max(100).optional().nullable(),
})

// Mapa campaign_type (Loja) → sector da lead (prefill de qualificação na regra).
const SECTOR_BY_TYPE: Record<string, string> = {
  compradores: 'real_estate_buy',
  vendedores: 'real_estate_sell',
  arrendatarios: 'real_estate_rent',
  senhorios: 'real_estate_landlord',
}

// POST — liga a campanha-pedido a uma campanha Meta real (meta_campaign_id) e,
// nesse momento, cria/actualiza a regra de atribuição que torna o parceiro o
// REFERENCIADO de todos os leads gerados por essa campanha Meta. Reutiliza a
// maquinaria existente (leads_assignment_rules → ingest → referral → ledger).
//
// Acesso: parceiro dono (partner_id = self) ou gestão.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAuth()
    if (!auth.authorized) return auth.response

    const { id } = await params
    const body = await request.json().catch(() => null)
    const parsed = linkSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Dados inválidos', details: parsed.error.flatten() }, { status: 400 })
    }
    const { meta_campaign_id, referral_pct } = parsed.data

    const db = createCrmAdminClient()
    const { data: campaign, error: loadErr } = await db
      .from('marketing_campaigns')
      .select('id, partner_id, agent_id, property_id, campaign_type, partner_status, objective')
      .eq('id', id)
      .maybeSingle()

    if (loadErr) return NextResponse.json({ error: loadErr.message }, { status: 500 })
    if (!campaign) return NextResponse.json({ error: 'Campanha não encontrada' }, { status: 404 })

    const isManagement = auth.permissions.users === true || auth.permissions.marketing === true
    const isOwningPartner = isPartner(auth.roles) && campaign.partner_id === auth.user.id
    if (!isManagement && !isOwningPartner) {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    }
    if (!campaign.partner_id) {
      return NextResponse.json({ error: 'Campanha sem parceiro associado.' }, { status: 400 })
    }

    // 1. Persist the link + advance the lifecycle to "criada" if still earlier.
    const advance = campaign.partner_status === 'pedido' || campaign.partner_status === 'aceite'
    const { data: updated, error: updErr } = await db
      .from('marketing_campaigns')
      .update({
        meta_campaign_id,
        ...(advance ? { partner_status: 'criada', partner_status_updated_at: new Date().toISOString() } : {}),
      })
      .eq('id', id)
      .select('id, meta_campaign_id, partner_status')
      .single()

    if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 })

    // 2. Property external_ref (kept in sync on the rule, like the attribution panel).
    let propertyExternalRef: string | null = null
    if (campaign.property_id) {
      const { data: prop } = await db
        .from('dev_properties')
        .select('external_ref')
        .eq('id', campaign.property_id)
        .maybeSingle()
      propertyExternalRef = prop?.external_ref ?? null
    }

    // 3. Upsert the campaign-level assignment rule → partner is referenciado.
    //    Leads are worked by the requesting agent; the partner gets the referral.
    const rulePayload = {
      name: `[Campanha Loja] ${meta_campaign_id}`.slice(0, 200),
      description: 'Atribuição automática de leads Meta gerada pelo pedido de campanha da Loja.',
      source_match: ['meta_ads'],
      campaign_external_id_match: meta_campaign_id,
      consultant_id: campaign.agent_id,
      priority: 50,
      is_active: true,
      fallback_action: 'gestora_pool',
      has_referral: true,
      referral_consultant_id: campaign.partner_id,
      referral_pct: referral_pct ?? null,
      referral_basis: 'agency_commission',
      lead_sector: campaign.campaign_type ? SECTOR_BY_TYPE[campaign.campaign_type] ?? null : null,
      property_id: campaign.property_id ?? null,
      property_external_ref: propertyExternalRef,
    }

    const { data: existing } = await db
      .from('leads_assignment_rules')
      .select('id')
      .eq('campaign_external_id_match', meta_campaign_id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    let ruleError: string | null = null
    if (existing?.id) {
      const { error } = await db.from('leads_assignment_rules').update(rulePayload).eq('id', existing.id)
      if (error) ruleError = error.message
    } else {
      const { error } = await db.from('leads_assignment_rules').insert(rulePayload)
      if (error) ruleError = error.message
    }

    return NextResponse.json({ ...updated, referral_rule_error: ruleError })
  } catch (error) {
    console.error('Erro ao ligar campanha Meta:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
