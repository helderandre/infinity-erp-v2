// ─── Moloni credit notes (notas de crédito) ──────────────────────────────────
// Reverses a closed (AT-reported) invoice. The trap: each credit-note line must
// reference the original invoice line via related_id = document_product_id
// (NOT the invoice's document_id), fetched from invoices/getOne.

import { moloniPost } from './client'
import { getDocumentSets } from './catalog'
import { getInvoice } from './invoices'
import { MoloniError } from './types'

export interface CreditInvoiceInput {
  invoiceDocumentId: number // the closed invoice to reverse
  customerId: number
  date: string // YYYY-MM-DD
  reason?: string
}

export interface CreditNoteResult {
  documentId: number
  number: string | null
  grossValue: number | null
}

/**
 * Issue a full credit note against an invoice (status 1, reported to AT).
 * Mirrors every line of the original invoice.
 */
export async function creditInvoice(input: CreditInvoiceInput): Promise<CreditNoteResult> {
  const original = await getInvoice(input.invoiceDocumentId)
  if (!original?.products?.length) {
    throw new MoloniError([{ code: 404, description: 'Fatura original não encontrada ou sem linhas' }])
  }

  const sets = await getDocumentSets()
  if (!sets.length) {
    throw new MoloniError([{ code: 404, description: 'Nenhuma série de documentos configurada no Moloni' }])
  }

  // The associated value offsets the invoice in full → use the document TOTAL
  // (incl. IVA). Moloni's net_value IS that total (its gross_value is the base).
  const total = Number(
    original.net_value ??
      original.products.reduce((s, p) => s + Number(p.price) * Number(p.qty) * 1.23, 0),
  )

  const doc = await moloniPost<{ document_id: number; number?: string; gross_value?: number }>(
    'creditNotes/insert',
    {
      document_set_id: sets[0].document_set_id,
      customer_id: input.customerId,
      date: input.date,
      expiration_date: input.date,
      status: 1, // closed — reported to AT
      ...(input.reason ? { notes: input.reason } : {}),
      associated_documents: [{ associated_id: original.document_id, value: total }],
      products: original.products.map((p) => ({
        product_id: p.product_id,
        related_id: p.document_product_id, // ← the fix: per-line, not document_id
        name: p.name,
        qty: p.qty,
        price: p.price,
        taxes: p.taxes,
      })),
    },
  )

  return {
    documentId: doc.document_id,
    number: doc.number ?? null,
    grossValue: doc.gross_value != null ? Number(doc.gross_value) : total,
  }
}
