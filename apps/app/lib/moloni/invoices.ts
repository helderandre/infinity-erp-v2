// ─── Moloni invoices ─────────────────────────────────────────────────────────
// Create (draft or closed), delete a draft, and download the PDF.
//
// ⚠ status: 1 (closed) is IRREVERSIBLE — it is reported to the AT (Portuguese
// Tax Authority) and becomes a permanent fiscal document. Drafts (status: 0)
// can be deleted freely.

import { moloniPost } from './client'
import { MoloniError } from './types'
import type { MoloniInvoiceResult } from './types'

export interface CreateInvoiceParams {
  customerId: number
  documentSetId: number
  date: string // YYYY-MM-DD
  expirationDate: string // YYYY-MM-DD
  description: string
  amount: number // net (excl. tax)
  taxId: number
  taxValue: number
  productId: number
  reference?: string // our own reference
  close: boolean // true = report to AT (status 1), false = draft (status 0)
}

export async function createInvoice(params: CreateInvoiceParams): Promise<MoloniInvoiceResult> {
  return moloniPost<MoloniInvoiceResult>('invoices/insert', {
    date: params.date,
    expiration_date: params.expirationDate,
    document_set_id: params.documentSetId,
    customer_id: params.customerId,
    our_reference: params.reference,
    products: [
      {
        product_id: params.productId,
        name: params.description,
        qty: 1,
        price: params.amount,
        taxes: [{ tax_id: params.taxId, value: params.taxValue, order: 1, cumulative: 0 }],
      },
    ],
    status: params.close ? 1 : 0,
  })
}

/** Delete a DRAFT invoice (status 0). Closed invoices cannot be deleted — cancel/credit-note instead. */
export async function deleteDraftInvoice(documentId: number): Promise<void> {
  await moloniPost('invoices/delete', { document_id: documentId })
}

export interface MoloniInvoiceLine {
  document_product_id: number // ← per-line id needed for credit notes (NOT document_id)
  product_id: number
  name: string
  qty: number
  price: number
  taxes: Array<{ tax_id: number; value: number; order: number; cumulative: number }>
}

export interface MoloniInvoiceDetail {
  document_id: number
  customer_id?: number
  number?: string | number
  date?: string
  status?: number
  our_reference?: string | null
  entity_name?: string
  entity_vat?: string
  entity_address?: string
  entity_city?: string
  entity_zip_code?: string
  // ⚠ Moloni naming is inverted: gross_value = base (excl. IVA), net_value = total (incl. IVA).
  net_value?: number
  taxes_value?: number
  gross_value?: number
  products: MoloniInvoiceLine[]
}

/** Fetch a closed invoice with its line items (each carrying document_product_id). */
export async function getInvoice(documentId: number): Promise<MoloniInvoiceDetail> {
  return moloniPost<MoloniInvoiceDetail>('invoices/getOne', { document_id: documentId })
}

export interface ClosedInvoiceMatch {
  documentId: number
  number: string | null
  customerId: number
  netValue: number
  taxesValue: number
  grossValue: number
}

/**
 * Find an already-CLOSED invoice (status 1) carrying `reference` as its
 * our_reference, for the given customer + document set. Dedupe guard so that a
 * finalize retry after a lost response does NOT emit a second AT document.
 * Best-effort: returns null on any error so the caller proceeds to emit.
 */
export async function findClosedInvoiceByReference(params: {
  reference: string
  customerId: number
  documentSetId: number
  excludeDocumentId?: number
}): Promise<ClosedInvoiceMatch | null> {
  try {
    const list = await moloniPost<any[]>('invoices/getAll', {
      customer_id: params.customerId,
      document_set_id: params.documentSetId,
      offset: 0,
      qty: 50,
    })
    if (!Array.isArray(list)) return null
    const match = list.find((d) => {
      const ref = d?.our_reference ?? d?.your_reference
      const docId = Number(d?.document_id)
      if (!docId || ref !== params.reference) return false
      if (params.excludeDocumentId && docId === params.excludeDocumentId) return false
      // Prefer a closed (status 1) document; if status is absent, accept the match.
      if (d?.status != null && Number(d.status) !== 1) return false
      return true
    })
    if (!match) return null
    return {
      documentId: Number(match.document_id),
      number: match.number ?? null,
      customerId: params.customerId,
      // Moloni inverted naming: gross_value = base (líquido), net_value = total (bruto).
      netValue: Number(match.gross_value) || 0,
      taxesValue: Number(match.taxes_value) || 0,
      grossValue: Number(match.net_value) || 0,
    }
  } catch {
    return null
  }
}

/** Cancel (anular) a closed document. It remains in SAF-T, marked annulled. */
export async function cancelDocument(documentId: number): Promise<void> {
  await moloniPost('documents/documentCancel', { document_id: documentId })
}

/**
 * Resolve the real PDF download URL. `documents/getPDFLink` returns a URL whose
 * body is an HTML page with a <meta refresh> pointing at the actual file.
 */
export async function getPdfDownloadUrl(documentId: number): Promise<string> {
  const resp = await moloniPost<{ url?: string; valid?: number }>('documents/getPDFLink', {
    document_id: documentId,
  })
  const url = resp?.url
  // Drafts (status 0) have no PDF — Moloni returns { valid: 0 } with no url.
  if (!url) {
    throw new MoloniError([
      { code: 404, description: 'O Moloni não tem PDF para este documento (os rascunhos só geram PDF após finalizar).' },
    ])
  }
  try {
    const htmlRes = await fetch(url)
    const html = await htmlRes.text()
    const match = html.match(/content="URL=([^"]+)"/)
    if (match) {
      const base = new URL(url)
      return `${base.origin}/downloads/${match[1]}`
    }
  } catch {
    // fall through to the raw link
  }
  return url
}

/** Download the document PDF as a Buffer (parses the meta-refresh wrapper). */
export async function downloadDocumentPDF(documentId: number): Promise<Buffer> {
  const downloadUrl = await getPdfDownloadUrl(documentId)
  const res = await fetch(downloadUrl)
  const buffer = Buffer.from(await res.arrayBuffer())
  return buffer
}
