import type { MapaGestaoRow } from '@/types/financial'

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Cálculo canónico de "quem recebe o quê" por pagamento de um negócio.
 *
 * Extraído de `app/api/financial/mapa-gestao/route.ts` (uma linha por split) e
 * de `…/deal-payments/[id]/mapa-row/route.ts` (linha única) para ser a ÚNICA
 * fonte da repartição. Reutilizado pelo passo "Pagar às partes" do fecho de
 * negócio (`/api/deals/[id]/payout-breakdown`) para que os montantes batam
 * exactamente com o mapa de gestão.
 *
 * `payment` deve trazer `deal_payment_splits(… agent)`; `deal` deve trazer
 * `has_share`, `share_pct`, `partner_amount`, `partner_agency_name`,
 * `deal_referrals`, `property`, etc.
 */

/** Data efectiva do pagamento: reportado → reported_date; senão signed_date; senão deal_date. */
export function getEffectiveDate(payment: any, dealDate: string): string {
  if (payment.is_reported && payment.reported_date) return payment.reported_date
  if (payment.signed_date) return payment.signed_date
  return dealDate
}

export type MapaRowWithDate = MapaGestaoRow & { effective_date: string }

/** override ?? automático — `null`/`undefined` no override = usar o calculado. */
function eff(override: any, auto: any): number {
  return override != null ? Number(override) : Number(auto ?? 0)
}

/**
 * Constrói uma `MapaGestaoRow` por cada split do pagamento.
 *
 * Padrão "calcular por defeito, editar como um Excel": cada montante é
 * `override ?? automático` (ver `/overridable-computed-values-portable-spec.md`).
 * Splits com `is_deleted=true` são ignorados. Cada linha expõe também o valor
 * automático (`*_auto`) e flags `*_is_override` para a UI mostrar o calculado
 * esbatido + badge de override.
 */
export function buildMapaRowsFromPayment(payment: any, deal: any): MapaRowWithDate[] {
  const splits = (payment.deal_payment_splits || []).filter((s: any) => !s.is_deleted)
  const dealSharePct = Number(deal.share_pct || 100)
  const referrals = deal.deal_referrals || []
  const effectiveDate = getEffectiveDate(payment, deal.deal_date)

  // Bases do pagamento (override ?? automático), depois escaladas pela partilha.
  const paymentAmountEff = eff(payment.amount_override, payment.amount)
  const paymentAmountAuto = Number(payment.amount ?? 0)
  const networkBaseEff = eff(payment.network_amount_override, payment.network_amount)
  const networkBaseAuto = Number(payment.network_amount ?? 0)
  const agencyBaseEff = eff(payment.agency_amount_override, payment.agency_amount)
  const agencyBaseAuto = Number(payment.agency_amount ?? 0)
  const partnerBaseEff = payment.partner_amount_override != null
    ? Number(payment.partner_amount_override)
    : (payment.partner_amount != null ? Number(payment.partner_amount) : null)
  const partnerBaseAuto = payment.partner_amount != null ? Number(payment.partner_amount) : null

  return splits.map((split: any): MapaRowWithDate => {
    // % de partilha para display
    let sharePctDisplay: number
    if (split.role === 'main') {
      sharePctDisplay = deal.has_share ? dealSharePct : 100
    } else if (split.role === 'partner') {
      sharePctDisplay = 100 - dealSharePct
    } else {
      const ref = referrals.find((r: any) => r.consultant_id === split.agent_id)
      sharePctDisplay = ref ? Number(ref.referral_pct) : Number(split.split_pct_override ?? split.split_pct)
    }
    const shareFactor = sharePctDisplay / 100

    // Convictus (rede) e margem da agência proporcionais a este split
    const splitNetworkAmount = networkBaseEff * shareFactor
    const splitAgencyAmount = agencyBaseEff * shareFactor

    // Split (per-agent) — valores efectivos vs automáticos
    const splitAmountEff = eff(split.amount_override, split.amount)
    const splitAmountAuto = Number(split.amount ?? 0)
    const tierPctEff = eff(split.split_pct_override, split.split_pct)
    const tierPctAuto = Number(split.split_pct ?? 0)

    return {
      // Deal info
      deal_id: deal.id,
      reference: deal.reference,
      pv_number: deal.pv_number,
      deal_type: deal.deal_type,
      deal_value: Number(deal.deal_value),
      deal_date: deal.deal_date,
      effective_date: effectiveDate,
      business_type: deal.business_type,
      commission_pct: Number(deal.commission_pct),
      has_share: deal.has_share,
      property: deal.property,
      proc_instance_id: deal.proc_instance_id,
      deal_status: deal.status,
      // Payment moment (deal-level)
      payment_id: payment.id,
      payment_moment: payment.payment_moment,
      payment_pct: Number(payment.payment_pct),
      payment_amount: paymentAmountEff,
      network_amount: splitNetworkAmount,
      agency_amount: splitAgencyAmount,
      partner_amount: partnerBaseEff != null ? partnerBaseEff * shareFactor : null,
      is_signed: payment.is_signed ?? false,
      signed_date: payment.signed_date,
      date_type: payment.date_type || 'confirmed',
      is_received: payment.is_received ?? false,
      received_date: payment.received_date,
      is_reported: payment.is_reported ?? false,
      reported_date: payment.reported_date,
      agency_invoice_number: payment.agency_invoice_number,
      agency_invoice_date: payment.agency_invoice_date,
      agency_invoice_recipient: payment.agency_invoice_recipient,
      agency_invoice_recipient_nif: payment.agency_invoice_recipient_nif,
      agency_invoice_amount_net: payment.agency_invoice_amount_net ? Number(payment.agency_invoice_amount_net) : null,
      agency_invoice_amount_gross: payment.agency_invoice_amount_gross ? Number(payment.agency_invoice_amount_gross) : null,
      agency_invoice_vat_pct: payment.agency_invoice_vat_pct != null ? Number(payment.agency_invoice_vat_pct) : null,
      network_invoice_number: payment.network_invoice_number,
      network_invoice_date: payment.network_invoice_date,
      moloni_document_id: payment.moloni_document_id ?? null,
      moloni_document_type: payment.moloni_document_type ?? null,
      moloni_status: payment.moloni_status ?? null,
      moloni_pdf_url: payment.moloni_pdf_url ?? null,
      moloni_pdf_r2_url: payment.moloni_pdf_r2_url ?? null,
      moloni_synced_at: payment.moloni_synced_at ?? null,
      moloni_error: payment.moloni_error ?? null,
      moloni_creditnote_id: payment.moloni_creditnote_id ?? null,
      moloni_creditnote_number: payment.moloni_creditnote_number ?? null,
      moloni_creditnote_issued_at: payment.moloni_creditnote_issued_at ?? null,
      moloni_receipt_id: payment.moloni_receipt_id ?? null,
      moloni_receipt_issued_at: payment.moloni_receipt_issued_at ?? null,
      moloni_email_sent_at: payment.moloni_email_sent_at ?? null,
      moloni_email_sent_to: payment.moloni_email_sent_to ?? null,
      // Split (per-agent)
      split_id: split.id,
      agent: split.agent ?? null,
      split_role: split.role,
      share_pct: sharePctDisplay,
      tier_pct: tierPctEff,
      split_amount: splitAmountEff,
      consultant_invoice_number: split.consultant_invoice_number,
      consultant_invoice_date: split.consultant_invoice_date,
      consultant_invoice_type: split.consultant_invoice_type,
      consultant_paid: split.consultant_paid ?? false,
      consultant_paid_date: split.consultant_paid_date,
      // Partner / notes
      partner_agency_name: deal.partner_agency_name ?? null,
      payment_notes: payment.notes ?? null,
      // Override / automação
      amounts_locked: payment.amounts_locked ?? false,
      override_reason: split.override_reason ?? payment.override_reason ?? null,
      split_is_manual: split.is_manual ?? false,
      manual_label: split.manual_label ?? null,
      payment_amount_auto: paymentAmountAuto,
      network_amount_auto: networkBaseAuto * shareFactor,
      agency_amount_auto: agencyBaseAuto * shareFactor,
      partner_amount_auto: partnerBaseAuto != null ? partnerBaseAuto * shareFactor : null,
      split_amount_auto: splitAmountAuto,
      tier_pct_auto: tierPctAuto,
      payment_amount_is_override: payment.amount_override != null,
      network_amount_is_override: payment.network_amount_override != null,
      agency_amount_is_override: payment.agency_amount_override != null,
      partner_amount_is_override: payment.partner_amount_override != null,
      split_amount_is_override: split.amount_override != null,
      split_pct_is_override: split.split_pct_override != null,
      // Bases ao nível do pagamento (full, não escaladas) — para editar os totais
      // do momento a partir do sheet.
      payment_agency_amount: agencyBaseEff,
      payment_network_amount: networkBaseEff,
      payment_partner_amount: partnerBaseEff,
      payment_agency_amount_auto: agencyBaseAuto,
      payment_network_amount_auto: networkBaseAuto,
      payment_partner_amount_auto: partnerBaseAuto,
    }
  })
}
