/**
 * deriveFaturaTarget — destinatário + valor da fatura de comissão da agência,
 * derivados do cenário do negócio (`deal_type`).
 *
 * Modelo fiscal (memory `fecho-faturacao-scenarios`; CLAUDE.md PROC-NEG):
 *  - Angariação nossa (`pleno` / `pleno_agencia` / `comprador_externo`):
 *      fatura → PROPRIETÁRIO (contacto principal do imóvel), comissão TOTAL do
 *      momento = `deal_payments.amount`.
 *  - Angariação externa (`angariacao_externa`):
 *      fatura → AGÊNCIA PARCEIRA (`deals.partner_agency_name`/`_nif`), só a
 *      NOSSA parte = `deal_payments.agency_amount`.
 *
 * ⚠ Os montantes verdadeiros vivem em `deal_payments` por momento
 * (`amount` = fatia total; `agency_amount` = a nossa margem) — NUNCA em
 * `deals.agency_net` (vazio na prática; ver auditoria 2026-06-23).
 *
 * Alimenta `issueMoloniDraft(paymentId, { recipient, recipient_nif, amount_net })`.
 */

import type { SupabaseClient } from '@supabase/supabase-js'

export type FaturaSource = 'owner' | 'partner_agency'

export interface FaturaTarget {
  recipientName: string | null
  nif: string | null
  amountNet: number | null
  source: FaturaSource
  /** Há dados suficientes para emitir (destinatário + NIF + valor). */
  ready: boolean
  /** Motivo quando `!ready` (UI mostra aviso e bloqueia a emissão). */
  blockedReason?: string
}

const NOSSA_ANGARIACAO = new Set(['pleno', 'pleno_agencia', 'comprador_externo'])

/**
 * Decisão pura — dado o cenário + dados já resolvidos, calcula o alvo da
 * fatura. Sem IO (testável). O `deriveFaturaTarget` faz os lookups e delega.
 */
export function computeFaturaTarget(input: {
  dealType: string
  partnerAgencyName: string | null
  partnerAgencyNif: string | null
  ownerName: string | null
  ownerNif: string | null
  paymentAmount: number | null
  paymentAgencyAmount: number | null
}): FaturaTarget {
  if (input.dealType === 'angariacao_externa') {
    const missing: string[] = []
    if (!input.partnerAgencyName) missing.push('nome da agência parceira')
    if (!input.partnerAgencyNif) missing.push('NIF da agência parceira')
    if (input.paymentAgencyAmount == null) missing.push('valor da nossa parte')
    return {
      recipientName: input.partnerAgencyName,
      nif: input.partnerAgencyNif,
      amountNet: input.paymentAgencyAmount,
      source: 'partner_agency',
      ready: missing.length === 0,
      blockedReason: missing.length ? `Em falta: ${missing.join(', ')}.` : undefined,
    }
  }

  if (!NOSSA_ANGARIACAO.has(input.dealType)) {
    return {
      recipientName: null,
      nif: null,
      amountNet: null,
      source: 'owner',
      ready: false,
      blockedReason: `deal_type desconhecido: "${input.dealType}".`,
    }
  }

  const missing: string[] = []
  if (!input.ownerName) missing.push('nome do proprietário')
  if (!input.ownerNif) missing.push('NIF do proprietário')
  if (input.paymentAmount == null) missing.push('valor da comissão')
  return {
    recipientName: input.ownerName,
    nif: input.ownerNif,
    amountNet: input.paymentAmount,
    source: 'owner',
    ready: missing.length === 0,
    blockedReason: missing.length ? `Em falta: ${missing.join(', ')}.` : undefined,
  }
}

/**
 * Resolve o alvo da fatura a partir de um `deal_payment`: faz os lookups
 * (payment → deal → proprietário contacto principal) e delega em
 * `computeFaturaTarget`. NÃO escreve nada — o caller decide pré-preencher
 * `agency_invoice_recipient`/`_nif`.
 */
export async function deriveFaturaTarget(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: SupabaseClient<any>,
  dealPaymentId: string
): Promise<FaturaTarget> {
  const blocked = (reason: string): FaturaTarget => ({
    recipientName: null,
    nif: null,
    amountNet: null,
    source: 'owner',
    ready: false,
    blockedReason: reason,
  })

  const { data: payRaw } = await admin
    .from('deal_payments')
    .select('id, deal_id, payment_moment, amount, agency_amount, amount_override, agency_amount_override')
    .eq('id', dealPaymentId)
    .maybeSingle()
  const payment = payRaw as {
    deal_id: string
    amount: number | null
    agency_amount: number | null
    amount_override: number | null
    agency_amount_override: number | null
  } | null
  if (!payment) return blocked('Pagamento não encontrado.')

  // Override pattern: o valor manual prevalece sobre o calculado.
  const effAmount = payment.amount_override != null ? Number(payment.amount_override) : payment.amount
  const effAgencyAmount = payment.agency_amount_override != null
    ? Number(payment.agency_amount_override)
    : payment.agency_amount

  const { data: dealRaw } = await admin
    .from('deals')
    .select('id, deal_type, property_id, partner_agency_name, partner_agency_nif')
    .eq('id', payment.deal_id)
    .maybeSingle()
  const deal = dealRaw as {
    deal_type: string | null
    property_id: string | null
    partner_agency_name: string | null
    partner_agency_nif: string | null
  } | null
  if (!deal) return blocked('Negócio não encontrado.')

  // Proprietário contacto principal — só para angariação nossa.
  let ownerName: string | null = null
  let ownerNif: string | null = null
  if (deal.deal_type !== 'angariacao_externa' && deal.property_id) {
    const { data: poRaw } = await admin
      .from('property_owners')
      .select('is_main_contact, owners(name, nif)')
      .eq('property_id', deal.property_id)
    type OwnerEmbed = { name: string | null; nif: string | null }
    const rows = (poRaw ?? []) as unknown as Array<{
      is_main_contact: boolean | null
      owners: OwnerEmbed | OwnerEmbed[] | null
    }>
    const main = rows.find((r) => r.is_main_contact) ?? rows[0] ?? null
    // PostgREST devolve o embed to-one como objecto, mas os tipos gerados
    // inferem array — normalizar defensivamente.
    const ownerObj = Array.isArray(main?.owners) ? main?.owners[0] : main?.owners
    ownerName = ownerObj?.name ?? null
    ownerNif = ownerObj?.nif ?? null
  }

  return computeFaturaTarget({
    dealType: deal.deal_type ?? '',
    partnerAgencyName: deal.partner_agency_name,
    partnerAgencyNif: deal.partner_agency_nif,
    ownerName,
    ownerNif,
    paymentAmount: effAmount,
    paymentAgencyAmount: effAgencyAmount,
  })
}
