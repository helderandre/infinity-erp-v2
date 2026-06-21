// ─── Durable PDF archive ─────────────────────────────────────────────────────
// Moloni's PDF link is ephemeral. On finalize we fetch the bytes and store a
// permanent copy in our R2 bucket so "ver / guardar a fatura no sistema" works
// independently of Moloni.

import { uploadToR2 } from '@/lib/r2/upload'
import { downloadDocumentPDF } from './invoices'
import { MoloniError } from './types'

export interface ArchivedPdf {
  url: string
  key: string
}

/**
 * Download the Moloni document PDF and store it in R2. Stable key so re-runs
 * overwrite the same object rather than piling up copies.
 */
export async function archiveInvoicePdf(
  documentId: number,
  paymentId: string,
  invoiceNumber?: string | null,
): Promise<ArchivedPdf> {
  const pdf = await downloadDocumentPDF(documentId)
  if (pdf.slice(0, 5).toString() !== '%PDF-') {
    throw new MoloniError([{ code: 502, description: 'O PDF devolvido pelo Moloni é inválido' }])
  }

  const safeNumber = (invoiceNumber ?? String(documentId)).replace(/[^a-zA-Z0-9-]/g, '_')
  const key = `moloni/faturas/${paymentId}/${documentId}-${safeNumber}.pdf`

  const { url } = await uploadToR2({
    key,
    body: pdf,
    contentType: 'application/pdf',
    cacheControl: 'private, max-age=31536000',
  })

  return { url, key }
}
