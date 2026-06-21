// ─── Moloni receipts (recibos / marcar como pago) ────────────────────────────
// Associates a payment with a closed invoice → the invoice shows as paid and a
// Recibo fiscal document is generated. Both net_value and expiration_date are
// required by Moloni even though the docs imply otherwise.

import { moloniPost } from './client'
import { getDocumentSets, pickPaymentMethodId } from './catalog'
import { MoloniError } from './types'

export interface ReceiptInput {
  invoiceDocumentId: number // the closed invoice being paid off
  customerId: number
  date: string // YYYY-MM-DD payment date
  amount: number // amount actually received (gross, or total − withholding)
  notes?: string
}

export interface ReceiptResult {
  documentId: number
  number: string | null
}

export async function issueReceipt(input: ReceiptInput): Promise<ReceiptResult> {
  if (!input.amount || input.amount <= 0) {
    throw new MoloniError([{ code: 400, description: 'Valor do recibo inválido' }])
  }

  const [sets, paymentMethodId] = await Promise.all([getDocumentSets(), pickPaymentMethodId()])
  if (!sets.length) {
    throw new MoloniError([{ code: 404, description: 'Nenhuma série de documentos configurada no Moloni' }])
  }

  const doc = await moloniPost<{ document_id: number; number?: string }>('receipts/insert', {
    document_set_id: sets[0].document_set_id,
    customer_id: input.customerId,
    date: input.date,
    net_value: input.amount, // amount actually received
    expiration_date: input.date, // required
    status: 1,
    ...(input.notes ? { notes: input.notes } : {}),
    associated_documents: [{ associated_id: input.invoiceDocumentId, value: input.amount }],
    payments: [{ payment_method_id: paymentMethodId, date: input.date, value: input.amount }],
  })

  return { documentId: doc.document_id, number: doc.number ?? null }
}
