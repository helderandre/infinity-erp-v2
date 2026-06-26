import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/permissions'
import { buildMapaRowsFromPayment } from '@/lib/financial/build-mapa-rows'

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
    // Admin client — same reason as the parent drilldown route: RLS on `deals`
    // blocks staff. requirePermission('financial') above gates the access.
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
        agency_invoice_number, agency_invoice_date,
        agency_invoice_recipient, agency_invoice_recipient_nif,
        agency_invoice_amount_net, agency_invoice_amount_gross,
        agency_invoice_vat_pct,
        network_invoice_number, network_invoice_date,
        moloni_document_id, moloni_document_type, moloni_status,
        moloni_pdf_url, moloni_pdf_r2_url, moloni_synced_at, moloni_error,
        moloni_creditnote_id, moloni_creditnote_number, moloni_creditnote_issued_at,
        moloni_receipt_id, moloni_receipt_issued_at,
        moloni_email_sent_at, moloni_email_sent_to,
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

    const splits = payment.deal_payment_splits || []
    if (splits.length === 0) {
      return NextResponse.json({ error: 'Sem splits de comissão' }, { status: 404 })
    }

    // Build one row per split via the canonical helper, then pick the "main"
    // split (or the first) — same behaviour as before, no duplicated maths.
    const rows = buildMapaRowsFromPayment({ ...payment, deal_payment_splits: splits }, deal)
    const row = rows.find((r) => r.split_role === 'main') ?? rows[0]

    return NextResponse.json(row)
  } catch (error) {
    console.error('Erro deal-payments mapa-row:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
