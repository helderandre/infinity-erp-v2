import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/permissions'
import { createAdminClient } from '@/lib/supabase/admin'
import { buildMapaRowsFromPayment } from '@/lib/financial/build-mapa-rows'

/**
 * GET /api/deals/[id]/payout-breakdown?moment=cpcv|escritura
 *
 * Repartição "quem recebe o quê" do pagamento de um momento — MESMO cálculo do
 * mapa de gestão (`buildMapaRowsFromPayment`). Alimenta o card `pay_parties` do
 * passo "Pagar às partes" do fecho de negócio: total do pagamento, parte de cada
 * consultor (com estado Pago), Convictus (rede), margem da agência e agência
 * parceira.
 *
 * `moment='escritura'` casa `payment_moment IN ('escritura','single')`
 * (single = arrendamento/trespasse). `moment='cpcv'` casa `'cpcv'`.
 *
 * Read-only (admin client p/ lookups cross-table; o flip de "Pago" continua na
 * server action `updateSplitPaid`, gated na UI a `financial`). Devolve
 * `{ found:false }` quando ainda não há pagamento para o momento.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth()
    if (!auth.authorized) return auth.response

    const { id } = await params
    const moment = new URL(request.url).searchParams.get('moment') ?? 'cpcv'
    const wanted = moment === 'escritura' ? ['escritura', 'single'] : ['cpcv']

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const admin = createAdminClient() as any

    const { data: payments, error } = await admin
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
      .eq('deal_id', id)
      .in('payment_moment', wanted)
      .order('created_at', { ascending: true })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const payment = (payments ?? [])[0] ?? null
    if (!payment || !payment.deals) {
      return NextResponse.json({ found: false, moment })
    }

    const deal = payment.deals
    const rows = buildMapaRowsFromPayment(payment, deal)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const parties = rows.map((r: any) => ({
      split_id: r.split_id,
      agent_id: r.agent?.id ?? null,
      agent_name: r.agent?.commercial_name ?? r.manual_label ?? 'Consultor',
      role: r.split_role as 'main' | 'partner' | 'referral',
      share_pct: r.share_pct,
      amount: r.split_amount,
      amount_auto: r.split_amount_auto,
      amount_is_override: r.split_amount_is_override,
      is_manual: r.split_is_manual,
      manual_label: r.manual_label,
      paid: r.consultant_paid,
      paid_date: r.consultant_paid_date,
    }))

    return NextResponse.json({
      found: true,
      moment,
      deal_type: deal.deal_type,
      summary: {
        payment_id: payment.id,
        payment_moment: payment.payment_moment,
        amount: payment.amount_override != null ? Number(payment.amount_override) : Number(payment.amount),
        network_amount: payment.network_amount_override != null
          ? Number(payment.network_amount_override)
          : (payment.network_amount != null ? Number(payment.network_amount) : 0),
        agency_amount: payment.agency_amount_override != null
          ? Number(payment.agency_amount_override)
          : (payment.agency_amount != null ? Number(payment.agency_amount) : 0),
        partner_amount: payment.partner_amount_override != null
          ? Number(payment.partner_amount_override)
          : (payment.partner_amount != null ? Number(payment.partner_amount) : 0),
        partner_agency_name: deal.partner_agency_name ?? null,
        is_received: payment.is_received ?? false,
        received_date: payment.received_date ?? null,
        moloni_status: payment.moloni_status ?? null,
      },
      parties,
    })
  } catch {
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
