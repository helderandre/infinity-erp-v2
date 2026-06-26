// @ts-nocheck
'use server'

// ─── Moloni server actions (agency commission invoices) ──────────────────────
// Consumed by <MapaRowSheet>. Three explicit, safe steps:
//   1. issueMoloniDraft   → creates a DRAFT in Moloni (status 0, deletable)
//   2. finalizeMoloniInvoice → issues the closed fiscal doc (status 1, AT) +
//                              removes the old draft + fetches the PDF
//   3. deleteMoloniDraft  → removes a draft and resets local state
//
// Gated by requirePermission('financial'). Every Moloni call is wrapped in the
// idempotency layer so a double-click never emits twice.

import { createAdminClient } from '@/lib/supabase/admin'
import { requirePermission } from '@/lib/auth/permissions'
import { issueAgencyInvoice } from '@/lib/moloni/issue-agency-invoice'
import {
  deleteDraftInvoice, getPdfDownloadUrl, downloadDocumentPDF, cancelDocument,
  findClosedInvoiceByReference,
} from '@/lib/moloni/invoices'
import { getDocumentSets } from '@/lib/moloni/catalog'
import { creditInvoice } from '@/lib/moloni/credit-notes'
import { issueReceipt } from '@/lib/moloni/receipts'
import { archiveInvoicePdf } from '@/lib/moloni/archive-pdf'
import { sendInvoiceEmail } from '@/lib/moloni/send-invoice-email'
import { withIdempotency, clearIdempotency } from '@/lib/moloni/idempotency'
import { getAgencyInvoiceVatPct, DEFAULT_VAT_PCT } from '@/lib/financial/vat-settings'

type ActionResult = {
  success: boolean
  error: string | null
  number?: string | null
  status?: number | null
  creditnote_number?: string | null
  receipt_id?: number | null
  emailed_to?: string | null
  pdf_url?: string | null
}

const MOMENT_LABEL: Record<string, string> = {
  cpcv: 'CPCV',
  escritura: 'Escritura',
  single: 'Contrato',
}

const PRODUCT_NAME = 'Comissão de intermediação imobiliária'

function todayLisbon(): string {
  // en-CA gives YYYY-MM-DD; pin to Europe/Lisbon for fiscal correctness.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Lisbon',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

async function loadPaymentAndDeal(admin: any, paymentId: string) {
  const { data: payment, error } = await admin
    .from('deal_payments')
    .select(
      `id, deal_id, payment_moment, amount, agency_amount,
       agency_invoice_recipient, agency_invoice_recipient_nif,
       agency_invoice_amount_net, agency_invoice_amount_gross,
       agency_invoice_vat_pct,
       agency_invoice_number, agency_invoice_date,
       moloni_document_id, moloni_status, moloni_customer_id,
       moloni_pdf_r2_url, moloni_pdf_r2_path, moloni_reissue_count,
       moloni_creditnote_id, moloni_receipt_id, moloni_email_sent_at,
       deals:deal_id ( id, reference, pv_number, business_type, negocio_id )`,
    )
    .eq('id', paymentId)
    .single()
  if (error || !payment) throw new Error('Pagamento não encontrado')
  return payment
}

/** Best-effort: PDF bytes for an emitted invoice — prefer the durable R2 copy. */
async function fetchInvoicePdf(payment: any): Promise<Buffer> {
  if (payment.moloni_pdf_r2_url) {
    const res = await fetch(payment.moloni_pdf_r2_url)
    if (res.ok) {
      const buf = Buffer.from(await res.arrayBuffer())
      if (buf.slice(0, 5).toString() === '%PDF-') return buf
    }
  }
  return downloadDocumentPDF(payment.moloni_document_id)
}

/** Default email recipient: the deal's lead, if resolvable. */
async function resolveLeadEmail(admin: any, payment: any): Promise<string | null> {
  const negocioId = payment?.deals?.negocio_id
  if (!negocioId) return null
  const { data: neg } = await admin.from('negocios').select('lead_id').eq('id', negocioId).maybeSingle()
  if (!neg?.lead_id) return null
  const { data: lead } = await admin.from('leads').select('email').eq('id', neg.lead_id).maybeSingle()
  return lead?.email ?? null
}

function buildInvoiceMeta(payment: any, recipientName: string) {
  const deal = payment.deals
  const momentLabel = MOMENT_LABEL[payment.payment_moment] ?? payment.payment_moment
  const ref = deal?.reference || deal?.pv_number || payment.deal_id
  // Each re-emission cycle gets a unique our_reference (R2, R3, …) so the
  // finalize dedupe guard never adopts a previous (already-credited) invoice.
  const seq = Number(payment.moloni_reissue_count || 0)
  const suffix = seq > 0 ? ` · R${seq + 1}` : ''
  return {
    reference: `${ref} · ${payment.payment_moment}${suffix}`,
    description: `Comissão de intermediação imobiliária — ${ref} — ${momentLabel}${seq > 0 ? ` (reemissão ${seq + 1})` : ''}`,
    recipientName,
  }
}

/** Append-only history ledger of every Moloni fiscal document for a payment. */
async function recordMoloniDocument(
  admin: any,
  payment: any,
  createdBy: string | undefined,
  row: {
    kind: 'invoice' | 'creditnote' | 'receipt'
    moloni_document_id: number
    moloni_status?: number | null
    number?: string | null
    recipient?: string | null
    recipient_nif?: string | null
    amount_net?: number | null
    amount_gross?: number | null
    pdf_r2_url?: string | null
    pdf_r2_path?: string | null
    related_moloni_document_id?: number | null
  },
): Promise<void> {
  try {
    // Idempotent: a retry must not duplicate the ledger row for the same document.
    const { data: existing } = await admin
      .from('deal_payment_moloni_documents')
      .select('id')
      .eq('deal_payment_id', payment.id)
      .eq('moloni_document_id', row.moloni_document_id)
      .eq('kind', row.kind)
      .maybeSingle()
    if (existing) return

    await admin.from('deal_payment_moloni_documents').insert({
      deal_payment_id: payment.id,
      reissue_seq: Number(payment.moloni_reissue_count || 0),
      created_by: createdBy ?? null,
      ...row,
    })
  } catch (e) {
    console.error('[moloni] history record failed (non-fatal):', e)
  }
}

// ─── 1. Issue draft ──────────────────────────────────────────────────────────

export async function issueMoloniDraft(
  paymentId: string,
  overrides?: {
    recipient?: string
    recipient_nif?: string
    amount_net?: number
    tax_rate?: number
  },
): Promise<ActionResult> {
  try {
    const auth = await requirePermission('financial')
    if (!auth.authorized) return { success: false, error: 'Sem permissão (financial)' }

    const admin = createAdminClient() as any
    const payment = await loadPaymentAndDeal(admin, paymentId)

    // Already issued? Don't re-create — surface the existing state.
    if (payment.moloni_document_id) {
      return {
        success: true,
        error: null,
        number: null,
        status: payment.moloni_status ?? 0,
      }
    }

    const recipientName = (overrides?.recipient ?? payment.agency_invoice_recipient ?? '').trim()
    if (!recipientName) {
      return { success: false, error: 'Defina o destinatário (cliente) da factura antes de emitir.' }
    }
    const nif = (overrides?.recipient_nif ?? payment.agency_invoice_recipient_nif ?? '').trim() || null
    const amountNet = Number(
      overrides?.amount_net ?? payment.agency_invoice_amount_net ?? payment.agency_amount ?? payment.amount ?? 0,
    )
    if (!amountNet || amountNet <= 0) {
      return { success: false, error: 'Valor líquido da factura inválido.' }
    }
    // IVA da fatura: override explícito → snapshot já existente neste pagamento →
    // definição financeira corrente. Snapshotted abaixo para que alterações
    // futuras à definição não afectem esta fatura.
    const taxRate = Number(
      overrides?.tax_rate ?? payment.agency_invoice_vat_pct ?? (await getAgencyInvoiceVatPct(admin)),
    )
    const date = todayLisbon()
    const meta = buildInvoiceMeta(payment, recipientName)

    const result = await withIdempotency(
      `moloni:issue_draft:${paymentId}`,
      'issue_draft',
      // Stable input → once Moloni creates the draft it is never re-created
      // for this payment until the key is cleared (delete_draft / finalize).
      // Failed attempts still retry (status='failed' resets to pending).
      { paymentId },
      () =>
        issueAgencyInvoice({
          recipientName,
          nif,
          amountNet,
          taxRate,
          productName: PRODUCT_NAME,
          reference: meta.reference,
          description: meta.description,
          date,
          expirationDate: date,
          close: false,
        }),
    )

    const { error: upErr } = await admin
      .from('deal_payments')
      .update({
        moloni_document_id: result.documentId,
        moloni_document_type: 'invoice',
        moloni_status: 0,
        moloni_customer_id: result.customerId,
        moloni_synced_at: new Date().toISOString(),
        moloni_error: null,
        agency_invoice_number: result.number ?? null,
        agency_invoice_date: date,
        agency_invoice_recipient: recipientName,
        agency_invoice_recipient_nif: nif,
        agency_invoice_amount_net: result.netValue,
        agency_invoice_amount_gross: result.grossValue,
        agency_invoice_vat_pct: taxRate,
        updated_at: new Date().toISOString(),
      })
      .eq('id', paymentId)
    if (upErr) return { success: false, error: `Rascunho criado no Moloni mas falhou a gravação local: ${upErr.message}` }

    return { success: true, error: null, number: result.number, status: 0 }
  } catch (e: any) {
    await markError(paymentId, e?.message)
    return { success: false, error: e?.message ?? 'Erro ao emitir rascunho no Moloni' }
  }
}

// ─── 2. Finalize (report to AT) ──────────────────────────────────────────────

export async function finalizeMoloniInvoice(paymentId: string): Promise<ActionResult> {
  try {
    const auth = await requirePermission('financial')
    if (!auth.authorized) return { success: false, error: 'Sem permissão (financial)' }

    const admin = createAdminClient() as any
    const payment = await loadPaymentAndDeal(admin, paymentId)

    if (!payment.moloni_document_id) {
      return { success: false, error: 'Emita primeiro um rascunho antes de finalizar.' }
    }
    if (payment.moloni_status === 1) {
      return { success: true, error: null, number: payment.agency_invoice_number ?? null, status: 1 }
    }

    const recipientName = (payment.agency_invoice_recipient ?? '').trim()
    const nif = (payment.agency_invoice_recipient_nif ?? '').trim() || null
    const amountNet = Number(payment.agency_invoice_amount_net ?? payment.agency_amount ?? payment.amount ?? 0)
    // Mesma taxa com que o rascunho foi emitido (snapshot); fallback à definição.
    const taxRate = Number(payment.agency_invoice_vat_pct ?? (await getAgencyInvoiceVatPct(admin)))
    const date = todayLisbon()
    const meta = buildInvoiceMeta(payment, recipientName)
    const oldDraftId = payment.moloni_document_id

    const result = await withIdempotency(
      `moloni:finalize:${paymentId}`,
      'finalize',
      // Stable input → critical for fiscal safety: once the closed AT document
      // is created it is NEVER re-created for this payment, even if the local
      // persist fails and the amount is later edited (use a credit note to fix).
      { paymentId },
      async () => {
        // Dedupe guard (fiscal safety): if a CLOSED invoice with this reference
        // already exists — e.g. a prior finalize reported to the AT but its
        // response was lost and the idempotency key reset to 'failed' — adopt it
        // instead of emitting a SECOND irreversible AT document.
        let closed: any = null
        try {
          const customerId = payment.moloni_customer_id
          const documentSetId = (await getDocumentSets())[0]?.document_set_id
          if (customerId && documentSetId) {
            closed = await findClosedInvoiceByReference({
              reference: meta.reference,
              customerId,
              documentSetId,
              excludeDocumentId: oldDraftId,
            })
          }
        } catch {
          closed = null
        }

        // No existing closed doc → emit the real one (status 1, reported to AT).
        if (!closed) {
          closed = await issueAgencyInvoice({
            recipientName,
            nif,
            amountNet,
            taxRate,
            productName: PRODUCT_NAME,
            reference: meta.reference,
            description: meta.description,
            date,
            expirationDate: date,
            close: true,
          })
        }

        try {
          await deleteDraftInvoice(oldDraftId)
        } catch (delErr) {
          console.error('[moloni] draft cleanup failed (orphan left in Moloni):', delErr)
        }
        let pdfUrl: string | null = null
        try {
          pdfUrl = await getPdfDownloadUrl(closed.documentId)
        } catch {
          pdfUrl = null
        }
        return { ...closed, pdfUrl }
      },
    )

    // Archive a durable PDF copy in R2 (best-effort; the Moloni link is ephemeral).
    let r2: { url: string; key: string } | null = null
    try {
      r2 = await archiveInvoicePdf(result.documentId, paymentId, result.number)
    } catch (archiveErr) {
      console.error('[moloni] PDF archive failed (falls back to live fetch):', archiveErr)
    }

    const { error: upErr } = await admin
      .from('deal_payments')
      .update({
        moloni_document_id: result.documentId,
        moloni_document_type: 'invoice',
        moloni_status: 1,
        moloni_pdf_url: result.pdfUrl,
        moloni_pdf_r2_url: r2?.url ?? null,
        moloni_pdf_r2_path: r2?.key ?? null,
        moloni_synced_at: new Date().toISOString(),
        moloni_error: null,
        agency_invoice_number: result.number ?? payment.agency_invoice_number ?? null,
        agency_invoice_date: date,
        // Coalesce: on the dedupe-adopt path the catalog amounts may be absent —
        // keep the values already persisted from the draft.
        agency_invoice_amount_net: result.netValue || payment.agency_invoice_amount_net,
        agency_invoice_amount_gross: result.grossValue || payment.agency_invoice_amount_gross,
        agency_invoice_vat_pct: payment.agency_invoice_vat_pct ?? taxRate,
        updated_at: new Date().toISOString(),
      })
      .eq('id', paymentId)
    if (upErr) {
      return {
        success: false,
        error: `Factura emitida na AT (#${result.number ?? result.documentId}) mas falhou a gravação local: ${upErr.message}`,
      }
    }

    // Record in the history ledger (audit trail of every fiscal document).
    await recordMoloniDocument(admin, payment, auth.user.id, {
      kind: 'invoice',
      moloni_document_id: result.documentId,
      moloni_status: 1,
      number: result.number,
      recipient: payment.agency_invoice_recipient,
      recipient_nif: payment.agency_invoice_recipient_nif,
      amount_net: result.netValue || payment.agency_invoice_amount_net,
      amount_gross: result.grossValue || payment.agency_invoice_amount_gross,
      pdf_r2_url: r2?.url ?? null,
      pdf_r2_path: r2?.key ?? null,
    })

    // A finalized doc consumes the draft slot — drop the issue_draft key.
    await clearIdempotency(`moloni:issue_draft:${paymentId}`)

    return { success: true, error: null, number: result.number, status: 1 }
  } catch (e: any) {
    await markError(paymentId, e?.message)
    return { success: false, error: e?.message ?? 'Erro ao finalizar a factura no Moloni' }
  }
}

// ─── 3. Delete draft ─────────────────────────────────────────────────────────

export async function deleteMoloniDraft(paymentId: string): Promise<ActionResult> {
  try {
    const auth = await requirePermission('financial')
    if (!auth.authorized) return { success: false, error: 'Sem permissão (financial)' }

    const admin = createAdminClient() as any
    const payment = await loadPaymentAndDeal(admin, paymentId)

    if (!payment.moloni_document_id) return { success: true, error: null, status: null }
    if (payment.moloni_status === 1) {
      return { success: false, error: 'Já foi reportada à AT — use nota de crédito para reverter.' }
    }

    await deleteDraftInvoice(payment.moloni_document_id)

    await admin
      .from('deal_payments')
      .update({
        moloni_document_id: null,
        moloni_document_type: null,
        moloni_status: null,
        moloni_pdf_url: null,
        moloni_synced_at: null,
        moloni_error: null,
        agency_invoice_number: null,
        agency_invoice_date: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', paymentId)

    await clearIdempotency(`moloni:issue_draft:${paymentId}`)

    return { success: true, error: null, status: null }
  } catch (e: any) {
    return { success: false, error: e?.message ?? 'Erro ao eliminar o rascunho no Moloni' }
  }
}

// ─── 4. Arquivar PDF no sistema (R2) ─────────────────────────────────────────

export async function archiveMoloniInvoicePdf(paymentId: string): Promise<ActionResult> {
  try {
    const auth = await requirePermission('financial')
    if (!auth.authorized) return { success: false, error: 'Sem permissão (financial)' }

    const admin = createAdminClient() as any
    const payment = await loadPaymentAndDeal(admin, paymentId)
    if (!payment.moloni_document_id) return { success: false, error: 'Sem fatura emitida para arquivar.' }

    const r2 = await archiveInvoicePdf(payment.moloni_document_id, paymentId, payment.agency_invoice_number)
    await admin
      .from('deal_payments')
      .update({ moloni_pdf_r2_url: r2.url, moloni_pdf_r2_path: r2.key, updated_at: new Date().toISOString() })
      .eq('id', paymentId)

    return { success: true, error: null, pdf_url: r2.url }
  } catch (e: any) {
    return { success: false, error: e?.message ?? 'Erro ao arquivar o PDF da fatura' }
  }
}

// ─── 5. Nota de crédito ──────────────────────────────────────────────────────

export async function issueMoloniCreditNote(paymentId: string, reason?: string): Promise<ActionResult> {
  try {
    const auth = await requirePermission('financial')
    if (!auth.authorized) return { success: false, error: 'Sem permissão (financial)' }

    const admin = createAdminClient() as any
    const payment = await loadPaymentAndDeal(admin, paymentId)

    if (payment.moloni_status !== 1 || !payment.moloni_document_id) {
      return { success: false, error: 'Só pode emitir nota de crédito sobre uma fatura emitida à AT.' }
    }
    if (payment.moloni_creditnote_id) {
      return { success: true, error: null, status: 2 }
    }
    if (!payment.moloni_customer_id) {
      return { success: false, error: 'Cliente Moloni em falta — re-emita a fatura.' }
    }

    const date = todayLisbon()
    const invoiceDocId = payment.moloni_document_id
    const customerId = payment.moloni_customer_id

    const result = await withIdempotency(
      `moloni:creditnote:${paymentId}`,
      'creditnote',
      { paymentId, invoiceDocId },
      () => creditInvoice({
        invoiceDocumentId: invoiceDocId,
        customerId,
        date,
        reason: reason || 'Anulação de comissão',
        vatPct: Number(payment.agency_invoice_vat_pct ?? DEFAULT_VAT_PCT),
      }),
    )

    const { error: upErr } = await admin
      .from('deal_payments')
      .update({
        moloni_creditnote_id: result.documentId,
        moloni_creditnote_number: result.number,
        moloni_creditnote_issued_at: new Date().toISOString(),
        moloni_status: 2,
        moloni_synced_at: new Date().toISOString(),
        moloni_error: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', paymentId)
    if (upErr) {
      return {
        success: false,
        error: `Nota de crédito emitida (#${result.number ?? result.documentId}) mas falhou a gravação local: ${upErr.message}`,
      }
    }

    // History: record the credit note + mark the credited invoice row.
    await recordMoloniDocument(admin, payment, auth.user.id, {
      kind: 'creditnote',
      moloni_document_id: result.documentId,
      moloni_status: 1,
      number: result.number,
      amount_gross: result.grossValue,
      related_moloni_document_id: invoiceDocId,
    })
    await admin
      .from('deal_payment_moloni_documents')
      .update({ moloni_status: 2 })
      .eq('deal_payment_id', paymentId)
      .eq('kind', 'invoice')
      .eq('moloni_document_id', invoiceDocId)

    return { success: true, error: null, creditnote_number: result.number, status: 2 }
  } catch (e: any) {
    await markError(paymentId, e?.message)
    return { success: false, error: e?.message ?? 'Erro ao emitir a nota de crédito' }
  }
}

// ─── 6. Anular documento (documentCancel) ────────────────────────────────────

export async function cancelMoloniDocument(paymentId: string): Promise<ActionResult> {
  try {
    const auth = await requirePermission('financial')
    if (!auth.authorized) return { success: false, error: 'Sem permissão (financial)' }

    const admin = createAdminClient() as any
    const payment = await loadPaymentAndDeal(admin, paymentId)

    if (payment.moloni_status !== 1 || !payment.moloni_document_id) {
      return { success: false, error: 'Só pode anular uma fatura emitida à AT.' }
    }
    const docId = payment.moloni_document_id

    await withIdempotency(`moloni:cancel:${paymentId}`, 'cancel', { paymentId, docId }, async () => {
      await cancelDocument(docId)
      return { ok: true }
    })

    await admin
      .from('deal_payments')
      .update({ moloni_status: 2, moloni_synced_at: new Date().toISOString(), moloni_error: null, updated_at: new Date().toISOString() })
      .eq('id', paymentId)

    await admin
      .from('deal_payment_moloni_documents')
      .update({ moloni_status: 2 })
      .eq('deal_payment_id', paymentId)
      .eq('kind', 'invoice')
      .eq('moloni_document_id', docId)

    return { success: true, error: null, status: 2 }
  } catch (e: any) {
    await markError(paymentId, e?.message)
    return { success: false, error: e?.message ?? 'Erro ao anular o documento no Moloni' }
  }
}

// ─── 7. Recibo (marcar como pago) ────────────────────────────────────────────

export async function issueMoloniReceipt(paymentId: string): Promise<ActionResult> {
  try {
    const auth = await requirePermission('financial')
    if (!auth.authorized) return { success: false, error: 'Sem permissão (financial)' }

    const admin = createAdminClient() as any
    const payment = await loadPaymentAndDeal(admin, paymentId)

    if (payment.moloni_status !== 1 || !payment.moloni_document_id) {
      return { success: false, error: 'Só pode emitir recibo sobre uma fatura emitida à AT.' }
    }
    if (payment.moloni_receipt_id) {
      return { success: true, error: null, receipt_id: payment.moloni_receipt_id }
    }
    if (!payment.moloni_customer_id) {
      return { success: false, error: 'Cliente Moloni em falta — re-emita a fatura.' }
    }

    const vatPct = Number(payment.agency_invoice_vat_pct ?? (await getAgencyInvoiceVatPct(admin)))
    const amount =
      Number(payment.agency_invoice_amount_gross ?? 0) ||
      Math.round(Number(payment.agency_invoice_amount_net ?? 0) * (1 + vatPct / 100) * 100) / 100
    if (!amount || amount <= 0) return { success: false, error: 'Valor do recibo inválido.' }

    const date = todayLisbon()
    const invoiceDocId = payment.moloni_document_id
    const customerId = payment.moloni_customer_id

    const result = await withIdempotency(
      `moloni:receipt:${paymentId}`,
      'receipt',
      { paymentId, invoiceDocId },
      () => issueReceipt({ invoiceDocumentId: invoiceDocId, customerId, date, amount }),
    )

    const { error: upErr } = await admin
      .from('deal_payments')
      .update({
        moloni_receipt_id: result.documentId,
        moloni_receipt_issued_at: new Date().toISOString(),
        moloni_synced_at: new Date().toISOString(),
        moloni_error: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', paymentId)
    if (upErr) {
      return { success: false, error: `Recibo emitido (#${result.number ?? result.documentId}) mas falhou a gravação local: ${upErr.message}` }
    }

    await recordMoloniDocument(admin, payment, auth.user.id, {
      kind: 'receipt',
      moloni_document_id: result.documentId,
      moloni_status: 1,
      number: result.number,
      amount_gross: amount,
      related_moloni_document_id: invoiceDocId,
    })

    return { success: true, error: null, receipt_id: result.documentId }
  } catch (e: any) {
    await markError(paymentId, e?.message)
    return { success: false, error: e?.message ?? 'Erro ao emitir o recibo no Moloni' }
  }
}

// ─── 8. Enviar fatura por email ──────────────────────────────────────────────

export async function sendMoloniInvoiceEmail(
  paymentId: string,
  opts?: { to?: string; subject?: string; message?: string },
): Promise<ActionResult> {
  try {
    const auth = await requirePermission('financial')
    if (!auth.authorized) return { success: false, error: 'Sem permissão (financial)' }

    const admin = createAdminClient() as any
    const payment = await loadPaymentAndDeal(admin, paymentId)

    if (!payment.moloni_document_id || payment.moloni_status === 0) {
      return { success: false, error: 'Finalize a fatura (reportar à AT) antes de enviar por email.' }
    }

    const to = ((opts?.to ?? '').trim() || (await resolveLeadEmail(admin, payment)) || '').trim()
    if (!to || !/.+@.+\..+/.test(to)) {
      return { success: false, error: 'Indique um email de destino válido.' }
    }

    const number = payment.agency_invoice_number ?? String(payment.moloni_document_id)
    const meta = buildInvoiceMeta(payment, payment.agency_invoice_recipient ?? '')
    const pdf = await fetchInvoicePdf(payment)

    const subject = opts?.subject?.trim() || `Fatura ${number} — Infinity Group`
    const bodyHtml = opts?.message?.trim()
      ? opts.message.replace(/\n/g, '<br/>')
      : `<p>Olá,</p><p>Segue em anexo a fatura <strong>${number}</strong> referente a ${meta.description}.</p><p>Com os melhores cumprimentos,<br/>Infinity Group</p>`

    const res = await sendInvoiceEmail({
      to,
      subject,
      bodyHtml,
      pdfBuffer: pdf,
      filename: `fatura-${number.replace(/[^a-zA-Z0-9-]/g, '_')}.pdf`,
    })
    if (!res.ok) return { success: false, error: res.error ?? 'Falha no envio do email' }

    await admin
      .from('deal_payments')
      .update({ moloni_email_sent_at: new Date().toISOString(), moloni_email_sent_to: to, updated_at: new Date().toISOString() })
      .eq('id', paymentId)

    return { success: true, error: null, emailed_to: to }
  } catch (e: any) {
    return { success: false, error: e?.message ?? 'Erro ao enviar a fatura por email' }
  }
}

// ─── 9. Re-emitir (novo ciclo após nota de crédito/anulação) ─────────────────

export async function reissueMoloniInvoice(paymentId: string): Promise<ActionResult> {
  try {
    const auth = await requirePermission('financial')
    if (!auth.authorized) return { success: false, error: 'Sem permissão (financial)' }

    const admin = createAdminClient() as any
    const payment = await loadPaymentAndDeal(admin, paymentId)

    if (payment.moloni_status !== 2) {
      return { success: false, error: 'Só pode emitir nova fatura depois de creditar/anular a anterior.' }
    }

    // The prior invoice(s) stay in the history ledger but are no longer current.
    await admin
      .from('deal_payment_moloni_documents')
      .update({ is_current: false })
      .eq('deal_payment_id', paymentId)
      .eq('kind', 'invoice')

    // Bump the cycle counter (→ unique our_reference next time) and reset the
    // current-document pointers so the payment goes back to "Por emitir".
    // Keep recipient + NIF for one-click re-emit; the ledger keeps the history.
    const { error: upErr } = await admin
      .from('deal_payments')
      .update({
        moloni_reissue_count: Number(payment.moloni_reissue_count || 0) + 1,
        moloni_document_id: null,
        moloni_document_type: null,
        moloni_status: null,
        moloni_customer_id: null,
        moloni_pdf_url: null,
        moloni_pdf_r2_url: null,
        moloni_pdf_r2_path: null,
        moloni_synced_at: null,
        moloni_error: null,
        moloni_creditnote_id: null,
        moloni_creditnote_number: null,
        moloni_creditnote_issued_at: null,
        moloni_receipt_id: null,
        moloni_receipt_issued_at: null,
        agency_invoice_number: null,
        agency_invoice_date: null,
        agency_invoice_amount_net: null,
        agency_invoice_amount_gross: null,
        // Novo ciclo → re-snapshot a IVA corrente na próxima emissão.
        agency_invoice_vat_pct: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', paymentId)
    if (upErr) return { success: false, error: upErr.message }

    // Fresh idempotency for the new cycle.
    await clearIdempotency(`moloni:issue_draft:${paymentId}`)
    await clearIdempotency(`moloni:finalize:${paymentId}`)
    await clearIdempotency(`moloni:creditnote:${paymentId}`)
    await clearIdempotency(`moloni:receipt:${paymentId}`)
    await clearIdempotency(`moloni:cancel:${paymentId}`)

    return { success: true, error: null, status: null }
  } catch (e: any) {
    return { success: false, error: e?.message ?? 'Erro ao reabrir o ciclo de faturação' }
  }
}

// ─── helpers ─────────────────────────────────────────────────────────────────

async function markError(paymentId: string, message?: string): Promise<void> {
  try {
    const admin = createAdminClient() as any
    await admin
      .from('deal_payments')
      .update({ moloni_error: message ?? 'Erro desconhecido', updated_at: new Date().toISOString() })
      .eq('id', paymentId)
  } catch {
    /* best-effort */
  }
}
