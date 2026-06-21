import { NextResponse } from 'next/server'
import { createCrmAdminClient } from '@/lib/supabase/admin-untyped'
import { requireAuth } from '@/lib/auth/permissions'
import { isManagementRole } from '@/lib/auth/roles'
import { redactLead, redactNestedLead } from '@/lib/auth/redact-lead'

/**
 * GET /api/properties/[id]/campaigns
 *
 * Campanhas/anúncios Meta associados a este imóvel (via
 * leads_assignment_rules.property_id) + os leads que geraram
 * (leads_entries.property_id, source='meta_ads').
 *
 * Devolve:
 *   - campaigns[]: regra por campanha/anúncio com consultor + nº de leads
 *   - stats: total + breakdown por status
 *   - leads[]: lista (contacto redacted para gestão que não é dona da entry)
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireAuth()
    if (!auth.authorized) return auth.response

    const { id } = await params
    // Admin client: leads_assignment_rules + leads_entries são protegidas por
    // RLS (só service_role lê). Scoping por property_id + redacção de PII são
    // feitos em código abaixo (com base no auth.user/roles).
    const supabase = createCrmAdminClient() as any
    const canSeeAll = isManagementRole(auth.roles)

    // Dono do imóvel — vê os contactos dos leads das campanhas deste imóvel
    // (tal como a gestão). Outros consultores vêem o lead mascarado.
    const { data: prop } = await supabase
      .from('dev_properties')
      .select('consultant_id')
      .eq('id', id)
      .maybeSingle()
    const propertyOwnerId: string | null = prop?.consultant_id ?? null

    // 1. Regras de atribuição ligadas a este imóvel = as campanhas/anúncios.
    const { data: rules } = await supabase
      .from('leads_assignment_rules')
      .select(`
        id, name, campaign_external_id_match, ad_id_match, consultant_id, is_active,
        consultant:dev_users!leads_assignment_rules_consultant_id_fkey(id, commercial_name)
      `)
      .eq('property_id', id)
      .order('priority', { ascending: false })

    // 2. Leads gerados por campanhas para este imóvel.
    const { data: entries } = await supabase
      .from('leads_entries')
      .select(`
        id, source, status, created_at, assigned_consultant_id, form_data,
        contact:leads!leads_entries_contact_id_fkey(id, nome, email, telemovel)
      `)
      .eq('property_id', id)
      .eq('source', 'meta_ads')
      .order('created_at', { ascending: false })
      .limit(200)

    const entryRows: any[] = entries ?? []

    // 3. Stats — total + breakdown por status.
    const byStatus: Record<string, number> = { new: 0, seen: 0, no_answer: 0, no_answer_2plus: 0, processing: 0, converted: 0, discarded: 0 }
    for (const e of entryRows) {
      if (e.status in byStatus) byStatus[e.status] += 1
    }

    // 4. nº de leads por campanha/anúncio (match pelo meta id na form_data).
    const campaigns = (rules ?? []).map((r: any) => {
      const scope: 'campaign' | 'ad' = r.ad_id_match ? 'ad' : 'campaign'
      const metaId = scope === 'ad' ? r.ad_id_match : r.campaign_external_id_match
      const key = scope === 'ad' ? 'meta_ad_id' : 'meta_campaign_id'
      const leadCount = entryRows.filter((e) => e.form_data?.[key] === metaId).length
      return {
        rule_id: r.id,
        name: r.name as string,
        scope,
        meta_id: metaId as string | null,
        consultant_id: r.consultant_id as string | null,
        consultant_name: r.consultant?.commercial_name ?? null,
        is_active: !!r.is_active,
        lead_count: leadCount,
      }
    })

    // 5. Redacção do contacto para gestão que não é dona da entry.
    const leads = entryRows.map((e) => {
      const campaignMetaId = e.form_data?.meta_campaign_id ?? null
      const adMetaId = e.form_data?.meta_ad_id ?? null
      const base = {
        id: e.id,
        source: e.source,
        status: e.status,
        created_at: e.created_at,
        campaign_meta_id: campaignMetaId,
        ad_meta_id: adMetaId,
        contact: e.contact ?? null,
      }
      // Nesta página vêem o contacto completo: a gestão, o dono do imóvel, e o
      // consultor dono do lead. Qualquer outro consultor vê o lead com o
      // contacto mascarado.
      const canSeeContact =
        canSeeAll ||
        auth.user.id === propertyOwnerId ||
        auth.user.id === e.assigned_consultant_id
      if (!canSeeContact) {
        return redactNestedLead(redactLead(base), ['contact'])
      }
      return base
    })

    return NextResponse.json({
      campaigns,
      stats: { total: entryRows.length, by_status: byStatus },
      leads,
      can_see_all: canSeeAll,
    })
  } catch (err) {
    console.error('[properties/campaigns] unexpected:', err)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
