import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/permissions'
import { buildMapaRowsFromPayment, getEffectiveDate } from '@/lib/financial/build-mapa-rows'

function isInMonth(dateStr: string, startDate: string, endDate: string): boolean {
  return dateStr >= startDate && dateStr < endDate
}

export async function GET(request: Request) {
  try {
    const auth = await requirePermission('financial')
    if (!auth.authorized) return auth.response

    const { searchParams } = new URL(request.url)
    const month = parseInt(searchParams.get('month') || String(new Date().getMonth() + 1))
    const year = parseInt(searchParams.get('year') || String(new Date().getFullYear()))
    const consultantId = searchParams.get('consultant_id')
    const dealType = searchParams.get('deal_type')
    const businessType = searchParams.get('business_type')

    const startDate = `${year}-${String(month).padStart(2, '0')}-01`
    const endMonth = month === 12 ? 1 : month + 1
    const endYear = month === 12 ? year + 1 : year
    const endDate = `${endYear}-${String(endMonth).padStart(2, '0')}-01`

    // Authorization is enforced by requirePermission('financial') above. The
    // admin client bypasses RLS — necessary because `deals` has a policy that
    // only lets property owners read their own rows, blocking staff who need
    // the full pipeline (broker, gestora, financial team).
    const supabase = createAdminClient() as any

    // Fetch deals broadly — we filter per-payment by effective date below.
    // Include deals where deal_date, any signed_date, or any reported_date could fall in this month.
    // We use a wide window: 3 months back from start (a CPCV signed 3 months ago could be reported now)
    const wideStart = new Date(year, month - 4, 1).toISOString().slice(0, 10)

    let query = supabase
      .from('deals')
      .select(`
        id, reference, pv_number,
        deal_type, deal_value, deal_date, business_type,
        commission_pct, commission_total,
        has_share, share_type, share_pct,
        network_amount, agency_margin, agency_net,
        partner_amount, partner_agency_name,
        status, proc_instance_id,
        property:dev_properties!deals_property_id_fkey(id, title, external_ref),
        consultant_id,
        internal_colleague_id,
        deal_payments(
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
          deal_payment_splits(
            id, agent_id, role, split_pct, amount,
            amount_override, split_pct_override, is_manual, is_deleted, manual_label, override_reason,
            consultant_invoice_number, consultant_invoice_date, consultant_invoice_type,
            consultant_paid, consultant_paid_date,
            agent:dev_users!deal_payment_splits_agent_id_fkey(id, commercial_name)
          )
        ),
        deal_referrals(
          consultant_id, referral_pct, side
        )
      `)
      .in('status', ['submitted', 'active', 'completed'])
      .gte('deal_date', wideStart)
      .lt('deal_date', endDate)

    if (dealType) query = query.eq('deal_type', dealType)
    if (businessType) query = query.eq('business_type', businessType)

    const { data: deals, error } = await query.order('deal_date', { ascending: true })

    if (error) {
      console.error('Erro mapa gestão:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Build rows: one row per split, filtered by effective date in the selected month
    const momentOrder: Record<string, number> = { cpcv: 0, escritura: 1, single: 2 }
    const rows: any[] = []

    for (const deal of (deals || [])) {
      const payments = (deal.deal_payments || []).sort(
        (a: any, b: any) => (momentOrder[a.payment_moment] ?? 9) - (momentOrder[b.payment_moment] ?? 9)
      )

      for (const payment of payments) {
        // Check if this payment belongs to this month
        const effectiveDate = getEffectiveDate(payment, deal.deal_date)
        if (!isInMonth(effectiveDate, startDate, endDate)) continue

        // One row per split — canonical "who gets what" computation.
        rows.push(...buildMapaRowsFromPayment(payment, deal))
      }
    }

    // Filter by consultant if requested
    const filteredRows = consultantId
      ? rows.filter((r: any) => r.agent?.id === consultantId)
      : rows

    // Compute totals
    const totals = {
      split_total: filteredRows.reduce((s: number, r: any) => s + r.split_amount, 0),
      network_total: filteredRows.reduce((s: number, r: any) => s + (r.network_amount || 0), 0),
      agency_total: filteredRows.reduce((s: number, r: any) => s + (r.agency_amount || 0), 0),
      partner_total: filteredRows.reduce((s: number, r: any) => s + (r.partner_amount || 0), 0),
      row_count: filteredRows.length,
    }

    return NextResponse.json({ rows: filteredRows, totals })
  } catch (error) {
    console.error('Erro mapa gestão:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
