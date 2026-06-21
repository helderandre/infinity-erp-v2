import { NextResponse } from 'next/server'
import { GetObjectCommand } from '@aws-sdk/client-s3'
import { requirePermission } from '@/lib/auth/permissions'
import { createAdminClient } from '@/lib/supabase/admin'
import { getR2Client, R2_BUCKET } from '@/lib/r2/client'
import { downloadDocumentPDF } from '@/lib/moloni/invoices'

export const runtime = 'nodejs'

/**
 * GET /api/financial/moloni/deal-payments/[id]/pdf?kind=invoice|creditnote
 * Streams a Moloni document PDF behind requirePermission('financial').
 *   • kind=invoice (default): the agency fatura — prefers the durable R2 copy
 *     (archived on finalize), streamed through this route (never a public URL).
 *   • kind=creditnote: the nota de crédito (always fetched live from Moloni).
 * Served inline so the UI can embed it in an <iframe> preview.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requirePermission('financial')
    if (!auth.authorized) return auth.response

    const { id } = await params
    const sp = new URL(request.url).searchParams
    const kind = sp.get('kind') === 'creditnote' ? 'creditnote' : 'invoice'
    const moloniDocIdParam = sp.get('moloni_doc_id')
    const admin = createAdminClient() as any

    const { data: payment, error } = await admin
      .from('deal_payments')
      .select(
        'id, moloni_document_id, moloni_pdf_r2_path, agency_invoice_number, moloni_creditnote_id, moloni_creditnote_number, moloni_receipt_id',
      )
      .eq('id', id)
      .single()

    if (error || !payment) {
      return NextResponse.json({ error: 'Pagamento não encontrado' }, { status: 404 })
    }

    const streamPdf = (bytes: Uint8Array<ArrayBuffer>, name: string) =>
      new NextResponse(bytes, {
        status: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `inline; filename="${name}"`,
          'Cache-Control': 'private, max-age=60',
        },
      })

    const safe = (v: unknown) => String(v).replace(/[^a-zA-Z0-9-]/g, '_')

    // ── Documento específico do histórico (validado contra este pagamento) ────
    if (moloniDocIdParam) {
      const wanted = Number(moloniDocIdParam)
      if (!Number.isFinite(wanted)) {
        return NextResponse.json({ error: 'Documento inválido' }, { status: 400 })
      }
      let owned =
        wanted === payment.moloni_document_id ||
        wanted === payment.moloni_creditnote_id ||
        wanted === payment.moloni_receipt_id
      if (!owned) {
        const { data: h } = await admin
          .from('deal_payment_moloni_documents')
          .select('moloni_document_id')
          .eq('deal_payment_id', id)
          .eq('moloni_document_id', wanted)
          .maybeSingle()
        owned = !!h
      }
      if (!owned) {
        return NextResponse.json({ error: 'Documento não pertence a este pagamento' }, { status: 403 })
      }
      const pdf = await downloadDocumentPDF(wanted)
      if (pdf.slice(0, 5).toString() !== '%PDF-') {
        return NextResponse.json({ error: 'Não foi possível obter o PDF do documento' }, { status: 502 })
      }
      return streamPdf(new Uint8Array(pdf), `documento-${safe(wanted)}.pdf`)
    }

    // ── Nota de crédito ──────────────────────────────────────────────────────
    if (kind === 'creditnote') {
      if (!payment.moloni_creditnote_id) {
        return NextResponse.json({ error: 'Sem nota de crédito para este pagamento' }, { status: 404 })
      }
      const pdf = await downloadDocumentPDF(payment.moloni_creditnote_id)
      if (pdf.slice(0, 5).toString() !== '%PDF-') {
        return NextResponse.json({ error: 'Não foi possível obter o PDF da nota de crédito' }, { status: 502 })
      }
      return streamPdf(
        new Uint8Array(pdf),
        `nota-credito-${safe(payment.moloni_creditnote_number ?? payment.moloni_creditnote_id)}.pdf`,
      )
    }

    // ── Fatura ───────────────────────────────────────────────────────────────
    if (!payment.moloni_document_id) {
      return NextResponse.json({ error: 'Sem factura Moloni para este pagamento' }, { status: 404 })
    }
    const fileName = `fatura-${safe(payment.agency_invoice_number ?? payment.moloni_document_id)}.pdf`

    // Durable R2 copy — stream the bytes through this auth-gated route.
    if (payment.moloni_pdf_r2_path) {
      try {
        const r2 = getR2Client()
        const res = await r2.send(new GetObjectCommand({ Bucket: R2_BUCKET, Key: payment.moloni_pdf_r2_path }))
        if (res.Body) {
          const bytes = await (res.Body as any).transformToByteArray()
          return streamPdf(new Uint8Array(bytes), fileName)
        }
      } catch (r2Err) {
        console.error('[moloni] R2 PDF read failed, falling back to Moloni:', r2Err)
      }
    }

    // Fallback: fetch fresh from Moloni.
    const pdf = await downloadDocumentPDF(payment.moloni_document_id)
    if (pdf.slice(0, 5).toString() !== '%PDF-') {
      return NextResponse.json({ error: 'Não foi possível obter o PDF do Moloni' }, { status: 502 })
    }
    return streamPdf(new Uint8Array(pdf), fileName)
  } catch (error: any) {
    console.error('Erro PDF Moloni:', error)
    return NextResponse.json({ error: error?.message ?? 'Erro interno' }, { status: 500 })
  }
}
