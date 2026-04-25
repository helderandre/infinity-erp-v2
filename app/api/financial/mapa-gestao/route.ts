import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/permissions'

// Determine which month a payment belongs to:
// - If reported → reported_date
// - Else if signed → signed_date
// - Else → deal_date (fallback)
function getEffectiveDate(payment: any, dealDate: string): string {
  if (payment.is_reported && payment.reported_date) return payment.reported_date
  if (payment.signed_date) return payment.signed_date
  return dealDate
}

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

    const supabase = await createClient() as any

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
          is_signed, signed_date, date_type,
          is_received, received_date,
          is_reported, reported_date,
          agency_invoice_number, agency_invoice_date,
          agency_invoice_recipient, agency_invoice_recipient_nif,
          agency_invoice_amount_net, agency_invoice_amount_gross,
          network_invoice_number, network_invoice_date,
          notes,
          deal_payment_splits(
            id, agent_id, role, split_pct, amount,
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

        const splits = payment.deal_payment_splits || []
        const dealSharePct = Number(deal.share_pct || 100)
        const referrals = deal.deal_referrals || []

        for (const split of splits) {
          // Compute the share % for display
          let sharePctDisplay: number
          if (split.role === 'main') {
            sharePctDisplay = deal.has_share ? dealSharePct : 100
          } else if (split.role === 'partner') {
            sharePctDisplay = 100 - dealSharePct
          } else {
            // referral — find their referral_pct
            const ref = referrals.find((r: any) => r.consultant_id === split.agent_id)
            sharePctDisplay = ref ? Number(ref.referral_pct) : Number(split.split_pct)
          }

          // Proportional Convictus and Margem for this split
          const totalConsultantAmount = Number(payment.amount) - Number(payment.network_amount || 0) - Number(payment.agency_amount || 0) - Number(payment.partner_amount || 0)
          const allSplitsAmount = splits.reduce((s: number, sp: any) => s + Number(sp.amount), 0)
          const splitRatio = allSplitsAmount > 0 ? Number(split.amount) / allSplitsAmount : 0
          const splitNetworkAmount = Number(payment.network_amount || 0) * (sharePctDisplay / 100)
          const splitAgencyAmount = Number(payment.agency_amount || 0) * (sharePctDisplay / 100)

          rows.push({
            // Deal info
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
            // Payment moment (deal-level)
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
            // Split (per-agent)
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
            // Partner / share / notes
            partner_agency_name: deal.partner_agency_name ?? null,
            payment_notes: payment.notes ?? null,
          })
        }
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
