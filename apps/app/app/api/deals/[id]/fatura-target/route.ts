import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/permissions'
import { createAdminClient } from '@/lib/supabase/admin'
import { deriveFaturaTarget } from '@/lib/processes/neg/derive-fatura-target'

/**
 * GET /api/deals/[id]/fatura-target?moment=cpcv|escritura
 *
 * Resolve o `deal_payment` do momento + o destinatário/valor da fatura de
 * comissão da agência (via `deriveFaturaTarget`). Alimenta o card
 * `moloni_invoice` do passo "Pedido de fatura" do fecho de negócio: o card
 * mostra o alvo derivado e passa-o como overrides ao `issueMoloniDraft`.
 *
 * `moment='escritura'` casa `payment_moment IN ('escritura','single')`
 * (single = arrendamento/trespasse). `moment='cpcv'` casa `'cpcv'`.
 *
 * Read-only (admin client para os lookups cross-table; a EMISSÃO continua
 * gated a `financial` na server action). Devolve `{ payment, target }` com
 * `payment=null` quando ainda não há pagamento para o momento.
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
      .select(
        `id, payment_moment, amount, agency_amount,
         moloni_status, moloni_error, moloni_document_id,
         moloni_receipt_id, moloni_creditnote_number, moloni_email_sent_to,
         agency_invoice_number, agency_invoice_date,
         agency_invoice_recipient, agency_invoice_recipient_nif,
         agency_invoice_amount_net, agency_invoice_amount_gross,
         agency_invoice_vat_pct, is_signed`
      )
      .eq('deal_id', id)
      .in('payment_moment', wanted)
      .order('created_at', { ascending: true })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const payment = (payments ?? [])[0] ?? null
    if (!payment) {
      return NextResponse.json({ payment: null, target: null })
    }

    const target = await deriveFaturaTarget(admin, payment.id)
    return NextResponse.json({ payment, target })
  } catch {
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
