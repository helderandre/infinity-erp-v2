import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/permissions'
import { createAdminClient } from '@/lib/supabase/admin'
import { getInvoice } from '@/lib/moloni/invoices'

export const runtime = 'nodejs'

/**
 * GET /api/financial/moloni/deal-payments/[id]/document
 * Normalized Moloni document data (via invoices/getOne) for the in-app preview
 * sheet. Works for drafts (status 0) AND finalized/credited docs — drafts have
 * no PDF, so this is the only way to "see" a rascunho in the app.
 *
 * NOTE: Moloni's amount fields are inverted vs. PT intuition —
 *   gross_value = base (excl. IVA), net_value = total (incl. IVA).
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requirePermission('financial')
    if (!auth.authorized) return auth.response

    const { id } = await params
    const admin = createAdminClient() as any

    const { data: payment, error } = await admin
      .from('deal_payments')
      .select(
        `id, moloni_document_id, moloni_status, moloni_creditnote_number,
         moloni_receipt_id, moloni_email_sent_to, moloni_email_sent_at`,
      )
      .eq('id', id)
      .single()

    if (error || !payment?.moloni_document_id) {
      return NextResponse.json({ error: 'Sem documento Moloni para este pagamento' }, { status: 404 })
    }

    const doc = await getInvoice(payment.moloni_document_id)
    const num = Number(doc.number)

    return NextResponse.json({
      document_id: doc.document_id,
      number: num > 0 ? String(doc.number) : null,
      status: payment.moloni_status ?? doc.status ?? null,
      date: doc.date ?? null,
      our_reference: doc.our_reference ?? null,
      entity: {
        name: doc.entity_name ?? null,
        vat: doc.entity_vat ?? null,
        address:
          [doc.entity_address, doc.entity_zip_code, doc.entity_city].filter(Boolean).join(', ') || null,
      },
      net: Number(doc.gross_value) || 0, // base, excl. IVA
      taxes: Number(doc.taxes_value) || 0,
      gross: Number(doc.net_value) || 0, // total, incl. IVA
      products: (doc.products ?? []).map((p) => ({
        name: p.name,
        qty: Number(p.qty),
        price: Number(p.price),
      })),
      pdf_available: Number(payment.moloni_status) === 1 || Number(payment.moloni_status) === 2,
      creditnote_number: payment.moloni_creditnote_number ?? null,
      receipt_id: payment.moloni_receipt_id ?? null,
      emailed_to: payment.moloni_email_sent_to ?? null,
    })
  } catch (error: any) {
    console.error('Erro documento Moloni:', error)
    return NextResponse.json({ error: error?.message ?? 'Erro interno' }, { status: 500 })
  }
}
