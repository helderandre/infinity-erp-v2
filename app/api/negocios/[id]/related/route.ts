import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAuth } from '@/lib/auth/permissions'

/**
 * GET /api/negocios/[id]/related
 *
 * Single endpoint que devolve TUDO o que a página de detalhe do negócio
 * precisa para alimentar as tabs (Resumo, Momentos, Processo, Financeiro):
 *
 *   - deal (linkado por negocio_id, mais recente)
 *   - payments (deal_payments do deal)
 *   - proc_instance (do deal, com external_ref + current_status)
 *   - moments (deal_marketing_moments do deal)
 *   - consultant (avatar + email + phone)
 *   - property (interno) — se houver
 *
 * Usa `createAdminClient` para evitar problemas de RLS / permissões em
 * tabelas como `proc_instances` (que requer permissão `processes`).
 * Auth básica: requer utilizador autenticado.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth()
    if (!auth.authorized) return auth.response

    const { id: negocioId } = await params
    const admin = createAdminClient()
    const adminDb = admin as unknown as { from: (t: string) => ReturnType<typeof admin.from> }

    // Negócio + lead + pipeline_stage + property (interno) + consultant
    const { data: negocioRow, error: negErr } = await adminDb
      .from('negocios')
      .select(`
        *,
        pipeline_stage:leads_pipeline_stages!pipeline_stage_id(id, name, color, order_index, is_terminal, terminal_type, pipeline_type),
        lead:leads(id, nome, full_name, telefone, telemovel, email, empresa, nipc, morada, codigo_postal, localidade),
        property:dev_properties!negocios_property_id_fkey(id, address_street, city, zone, address_parish, listing_price, property_type),
        consultant:dev_users!negocios_assigned_consultant_id_fkey(
          id, commercial_name, professional_email,
          dev_consultant_profiles(profile_photo_url, phone_commercial)
        )
      `)
      .eq('id', negocioId)
      .maybeSingle()

    if (negErr || !negocioRow) {
      return NextResponse.json({ error: 'Negócio não encontrado' }, { status: 404 })
    }

    const negocio = negocioRow as Record<string, unknown>

    // Deal mais recente para este negócio (com payments embedded)
    const { data: dealRows } = await adminDb
      .from('deals')
      .select(`
        id, reference, pv_number, status, deal_type, deal_value, deal_date,
        commission_pct, commission_total, commission_type, payment_structure,
        contract_signing_date, max_deadline, proc_instance_id, negocio_id, property_id,
        external_property_link, external_property_zone, external_property_typology,
        external_consultant_name,
        deal_payments (
          id, payment_moment, payment_pct, amount,
          network_amount, agency_amount, consultant_amount,
          is_signed, is_received, signed_date, received_date
        )
      `)
      .eq('negocio_id', negocioId)
      .order('created_at', { ascending: false })
      .limit(1)

    const dealRow = ((dealRows ?? [])[0] ?? null) as Record<string, unknown> | null
    const payments = (dealRow?.deal_payments ?? []) as unknown[]
    const deal = dealRow ? { ...dealRow, payments, deal_payments: undefined } : null
    if (deal) delete (deal as Record<string, unknown>).deal_payments

    // Proc instance (se deal tiver)
    let procInstance: { id: string; external_ref: string | null; current_status: string | null } | null = null
    if (deal && deal.proc_instance_id) {
      const { data: procRow } = await adminDb
        .from('proc_instances')
        .select('id, external_ref, current_status')
        .eq('id', deal.proc_instance_id as string)
        .maybeSingle()
      if (procRow) {
        procInstance = procRow as { id: string; external_ref: string | null; current_status: string | null }
      }
    }

    // Marketing moments (se deal tiver)
    let moments: unknown[] = []
    if (deal?.id) {
      const { data: momRows } = await adminDb
        .from('deal_marketing_moments')
        .select('*')
        .eq('deal_id', deal.id as string)
        .order('created_at', { ascending: false })
      moments = momRows ?? []
    }

    return NextResponse.json({
      negocio,
      deal,
      payments,
      proc_instance: procInstance,
      moments,
    })
  } catch (err) {
    console.error('[GET negocios/related]', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
