import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/permissions'

// Returns a single MapaGestaoRow (first split) for the given payment.
// Used by the dashboard drilldown sheet to open the existing <MapaRowSheet>
// without refetching an entire month.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requirePermission('financial')
    if (!auth.authorized) return auth.response

    const { id } = await params
    const supabase = await createClient() as any

    const { data: payment, error } = await supabase
      .from('deal_payments')
      .select(`
        id, payment_moment, payment_pct, amount,
        network_amount, agency_amount, partner_amount,
        is_signed, signed_date, date_type,
        is_received, received_date,
        is_reported, reported_date,
        agency_invoice_number, agency_invoice_date,
        agency_invoice_recipient, agency_invoice_recipient_nif,
        agency_invoice_amount_net, agency_invoice_amount_gross,
        network_invoice_number, network_invoice_date,
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

    const splits = payment.deal_payment_splits || []
    if (splits.length === 0) {
      return NextResponse.json({ error: 'Sem splits de comissão' }, { status: 404 })
    }

    // Pick the "main" split if it exists, otherwise the first.
    const split = splits.find((s: any) => s.role === 'main') || splits[0]
    const dealSharePct = Number(deal.share_pct || 100)
    const referrals = deal.deal_referrals || []

    let sharePctDisplay: number
    if (split.role === 'main') sharePctDisplay = deal.has_share ? dealSharePct : 100
    else if (split.role === 'partner') sharePctDisplay = 100 - dealSharePct
    else {
      const ref = referrals.find((r: any) => r.consultant_id === split.agent_id)
      sharePctDisplay = ref ? Number(ref.referral_pct) : Number(split.split_pct)
    }

    const splitNetworkAmount = Number(payment.network_amount || 0) * (sharePctDisplay / 100)
    const splitAgencyAmount = Number(payment.agency_amount || 0) * (sharePctDisplay / 100)
    const effectiveDate = payment.is_reported && payment.reported_date
      ? payment.reported_date
      : payment.signed_date || deal.deal_date

    const row = {
      deal_id: deal.id,
      reference: deal.reference,
      pv_number: deal.pv_number,
      deal_type: deal.deal_type,
      deal_value: Number(deal.deal_value),
      deal_date: deal.deal_date,
      effective_date: effectiveDate,
      business_type: deal.business_type,
      commission_pct: Number(deal.commission_pct),
      has_share: deal.has_share,
      property: deal.property,
      proc_instance_id: deal.proc_instance_id,
      deal_status: deal.status,
      payment_id: payment.id,
      payment_moment: payment.payment_moment,
      payment_pct: Number(payment.payment_pct),
      payment_amount: Number(payment.amount),
      network_amount: splitNetworkAmount,
      agency_amount: splitAgencyAmount,
      partner_amount: payment.partner_amount ? Number(payment.partner_amount) * (sharePctDisplay / 100) : null,
      is_signed: payment.is_signed ?? false,
      signed_date: payment.signed_date,
      date_type: payment.date_type || 'confirmed',
      is_received: payment.is_received ?? false,
      received_date: payment.received_date,
      is_reported: payment.is_reported ?? false,
      reported_date: payment.reported_date,
      agency_invoice_number: payment.agency_invoice_number,
      agency_invoice_date: payment.agency_invoice_date,
      agency_invoice_recipient: payment.agency_invoice_recipient,
      agency_invoice_recipient_nif: payment.agency_invoice_recipient_nif,
      agency_invoice_amount_net: payment.agency_invoice_amount_net ? Number(payment.agency_invoice_amount_net) : null,
      agency_invoice_amount_gross: payment.agency_invoice_amount_gross ? Number(payment.agency_invoice_amount_gross) : null,
      network_invoice_number: payment.network_invoice_number,
      network_invoice_date: payment.network_invoice_date,
      split_id: split.id,
      agent: split.agent,
      split_role: split.role,
      share_pct: sharePctDisplay,
      tier_pct: Number(split.split_pct),
      split_amount: Number(split.amount),
      consultant_invoice_number: split.consultant_invoice_number,
      consultant_invoice_date: split.consultant_invoice_date,
      consultant_invoice_type: split.consultant_invoice_type,
      consultant_paid: split.consultant_paid ?? false,
      consultant_paid_date: split.consultant_paid_date,
      partner_agency_name: deal.partner_agency_name ?? null,
      payment_notes: payment.notes ?? null,
    }

    return NextResponse.json(row)
  } catch (error) {
    console.error('Erro deal-payments mapa-row:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
