// ─── Domain glue: agency commission invoice → Moloni ─────────────────────────
// One function that ties the catalog + customer + product + invoice steps
// together. Used by the server actions for both the draft (close:false) and
// the finalized fiscal document (close:true).

import { syncCustomer } from './customers'
import { getDocumentSets, getVatTax, ensureServiceProduct } from './catalog'
import { createInvoice } from './invoices'
import { MoloniError } from './types'

export interface IssueAgencyInvoiceInput {
  recipientName: string
  nif?: string | null
  email?: string | null
  address?: string | null
  city?: string | null
  zipCode?: string | null
  phone?: string | null
  amountNet: number
  taxRate: number // e.g. 23
  productName: string // human label used as the invoice line + product
  reference?: string // our internal reference (e.g. deal reference + moment)
  description: string // invoice line description
  date: string // YYYY-MM-DD
  expirationDate: string // YYYY-MM-DD
  close: boolean
}

export interface IssueAgencyInvoiceResult {
  documentId: number
  number: string | null
  customerId: number
  netValue: number
  taxesValue: number
  grossValue: number
}

export async function issueAgencyInvoice(
  input: IssueAgencyInvoiceInput,
): Promise<IssueAgencyInvoiceResult> {
  if (!input.recipientName?.trim()) {
    throw new MoloniError([{ code: 400, description: 'Destinatário da factura em falta' }])
  }
  if (!input.amountNet || input.amountNet <= 0) {
    throw new MoloniError([{ code: 400, description: 'Valor da factura inválido' }])
  }

  // 1. Customer (idempotent on NIF).
  const customerId = await syncCustomer({
    name: input.recipientName,
    nif: input.nif,
    email: input.email,
    address: input.address,
    city: input.city,
    zip_code: input.zipCode,
    phone: input.phone,
  })

  // 2. Catalogs.
  const [sets, iva] = await Promise.all([getDocumentSets(), getVatTax(input.taxRate)])
  if (!sets.length) {
    throw new MoloniError([{ code: 404, description: 'Nenhuma série de documentos configurada no Moloni' }])
  }
  const documentSetId = sets[0].document_set_id

  // 3. Product.
  const productId = await ensureServiceProduct(input.productName, input.amountNet, iva.tax_id, iva.value)

  // 4. Invoice.
  const doc = await createInvoice({
    customerId,
    documentSetId,
    date: input.date,
    expirationDate: input.expirationDate,
    description: input.description,
    amount: input.amountNet,
    taxId: iva.tax_id,
    taxValue: iva.value,
    productId,
    reference: input.reference,
    close: input.close,
  })

  // ⚠ Moloni inverts the field names vs. PT intuition:
  //   gross_value = base / líquido (excl. IVA);  net_value = total / bruto (incl. IVA).
  const netValue = Number(doc.gross_value ?? input.amountNet)
  const taxesValue = Number(doc.taxes_value ?? Math.round(input.amountNet * (input.taxRate / 100) * 100) / 100)
  const grossValue = Number(doc.net_value ?? Math.round((netValue + taxesValue) * 100) / 100)

  return {
    documentId: doc.document_id,
    number: doc.number ?? null,
    customerId,
    netValue,
    taxesValue,
    grossValue,
  }
}
