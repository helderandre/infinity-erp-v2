import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/permissions'
import { buildMapaRowsFromPayment } from '@/lib/financial/build-mapa-rows'

/**
 * GET /api/financial/deal-payments/[id]/breakdown
 *
 * Devolve TODOS os intervenientes de UM pagamento (não só um split): as partes
 * (consultores/referências/manuais) + os montantes ao nível do pagamento
 * (Convictus/rede, margem da agência, agência parceira, total) — todos já
 * `override ?? automático` via `buildMapaRowsFromPayment`. Alimenta o
 * `<PaymentPartiesEditor>` (sheet do mapa + futuras superfícies).
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requirePermission('financial')
    if (!auth.authorized) return auth.response

    const { id } = await params
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = createAdminClient() as any

    const { data: payment, error } = await supabase
      .from('deal_payments')
      .select(`
        id, payment_moment, payment_pct, amount,
        network_amount, agency_amount, partner_amount,
        amount_override, network_amount_override, agency_amount_override, partner_amount_override,
        amounts_locked, override_reason,
        is_signed, signed_date, date_type,
        is_received, received_date,
        is_reported, reported_date,
        moloni_status,
        notes,
        deals:deal_id (
          id, reference, pv_number,
          deal_type, deal_value, deal_date, business_type,
          commission_pct, commission_total,
          has_share, share_type, share_pct,
          partner_amount, partner_agency_name,
          status, proc_instance_id,
          property:dev_properties!deals_property_id_fkey(id, title, external_ref),
          deal_referrals(consultant_id, referral_pct, side)
        ),
        deal_payment_splits(
          id, agent_id, role, split_pct, amount,
          amount_override, split_pct_override, is_manual, is_deleted, manual_label, override_reason,
          consultant_invoice_number, consultant_invoice_date, consultant_invoice_type,
          consultant_paid, consultant_paid_date,
          agent:dev_users!deal_payment_splits_agent_id_fkey(id, commercial_name)
        )
      `)
      .eq('id', id)
      .single()

    if (error || !payment) {
      return NextResponse.json({ error: 'Pagamento não encontrado' }, { status: 404 })
    }
    const deal = payment.deals
    if (!deal) return NextResponse.json({ error: 'Negócio em falta' }, { status: 404 })

    const rows = buildMapaRowsFromPayment(payment, deal)

    const eff = (o: any, a: any) => (o != null ? Number(o) : Number(a ?? 0))

    const paymentOut = {
      id: payment.id,
      moment: payment.payment_moment,
      amount: eff(payment.amount_override, payment.amount),
      amount_auto: Number(payment.amount ?? 0),
      amount_is_override: payment.amount_override != null,
      network_amount: eff(payment.network_amount_override, payment.network_amount),
      network_amount_auto: Number(payment.network_amount ?? 0),
      network_amount_is_override: payment.network_amount_override != null,
      agency_amount: eff(payment.agency_amount_override, payment.agency_amount),
      agency_amount_auto: Number(payment.agency_amount ?? 0),
      agency_amount_is_override: payment.agency_amount_override != null,
      partner_amount: payment.partner_amount_override != null
        ? Number(payment.partner_amount_override)
        : (payment.partner_amount != null ? Number(payment.partner_amount) : 0),
      partner_amount_auto: payment.partner_amount != null ? Number(payment.partner_amount) : 0,
      partner_amount_is_override: payment.partner_amount_override != null,
      partner_agency_name: deal.partner_agency_name ?? null,
      amounts_locked: payment.amounts_locked ?? false,
      is_received: payment.is_received ?? false,
      moloni_status: payment.moloni_status ?? null,
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const parties = rows.map((r: any) => ({
      split_id: r.split_id,
      agent_id: r.agent?.id ?? null,
      name: r.agent?.commercial_name ?? r.manual_label ?? 'Interveniente',
      role: r.split_role as 'main' | 'partner' | 'referral',
      amount: r.split_amount,
      amount_auto: r.split_amount_auto,
      amount_is_override: r.split_amount_is_override,
      is_manual: r.split_is_manual,
      consultant_paid: r.consultant_paid,
    }))

    return NextResponse.json({ payment: paymentOut, parties })
  } catch {
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
