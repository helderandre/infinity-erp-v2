/**
 * GET /api/analise-meta/leads/[id]
 *
 * Bundle de detalhe de um lead Meta para o <LeadDetailSheet> (inline, sem
 * navegar para fora da tab CRM → Análise → Meta): lead raw + perguntas do
 * formulário (para humanizar as respostas) + nomes da campanha/anúncio.
 *
 * Scope: gestão vê qualquer lead; consultor só vê leads das campanhas/anúncios
 * atribuídos a si via leads_assignment_rules.
 */

import { NextResponse } from 'next/server'

import { createCrmAdminClient } from '@/lib/supabase/admin-untyped'
import { requireAuth } from '@/lib/auth/permissions'
import { isManagementRole } from '@/lib/auth/roles'

export const dynamic = 'force-dynamic'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireAuth()
    if (!auth.authorized) return auth.response

    const { id } = await params
    if (!UUID_RE.test(id)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 })
    }

    const supabase = createCrmAdminClient()
    const { data: lead, error } = await supabase
      .schema('meta')
      .from('meta_leads_raw')
      .select('*')
      .eq('id', id)
      .maybeSingle()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!lead) return NextResponse.json({ error: 'Lead não encontrado' }, { status: 404 })

    // Consultor — só pode abrir leads das campanhas/anúncios atribuídos a si.
    if (!isManagementRole(auth.roles)) {
      const { data: rules } = await supabase
        .from('leads_assignment_rules')
        .select('campaign_external_id_match, ad_id_match')
        .eq('consultant_id', auth.user.id)
        .eq('is_active', true)

      const allowed = ((rules ?? []) as { campaign_external_id_match: string | null; ad_id_match: string | null }[])
        .some((r) =>
          (r.campaign_external_id_match && r.campaign_external_id_match === lead.campaign_id) ||
          (r.ad_id_match && r.ad_id_match === lead.ad_id),
        )
      if (!allowed) {
        return NextResponse.json({ error: 'forbidden' }, { status: 403 })
      }
    }

    const [formRes, campRes, adRes] = await Promise.all([
      lead.form_id
        ? supabase.schema('meta').from('meta_forms_raw').select('form_id, form_name, payload').eq('form_id', lead.form_id).maybeSingle()
        : Promise.resolve({ data: null }),
      lead.campaign_id
        ? supabase.schema('meta').from('meta_campaigns_raw').select('campaign_id, name').eq('campaign_id', lead.campaign_id).maybeSingle()
        : Promise.resolve({ data: null }),
      lead.ad_id
        ? supabase.schema('meta').from('meta_ads_raw').select('ad_id, name').eq('ad_id', lead.ad_id).maybeSingle()
        : Promise.resolve({ data: null }),
    ])

    const form = formRes.data as { form_id: string; form_name: string | null; payload: unknown } | null
    const questions =
      (form?.payload as { form?: { questions?: unknown[] } } | undefined)?.form?.questions ?? []

    const fieldData =
      (lead.payload as { lead?: { field_data?: unknown[] } } | undefined)?.lead?.field_data ?? []

    return NextResponse.json({
      lead: {
        id: lead.id,
        leadgen_id: lead.leadgen_id,
        full_name: lead.full_name,
        email: lead.email,
        phone: lead.phone,
        page_id: lead.page_id,
        form_id: lead.form_id,
        campaign_id: lead.campaign_id,
        ad_id: lead.ad_id,
        signature_valid: lead.signature_valid,
        received_at: lead.received_at,
        fb_created_time: lead.fb_created_time,
        processed: lead.processed,
        processed_at: lead.processed_at,
        lead_id: lead.lead_id,
      },
      field_data: fieldData,
      form: form ? { form_id: form.form_id, form_name: form.form_name, questions } : null,
      campaign: campRes.data ?? null,
      ad: adRes.data ?? null,
    })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Erro a carregar o lead.' },
      { status: 500 },
    )
  }
}
