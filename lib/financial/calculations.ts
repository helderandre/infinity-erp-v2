import type { CommissionTier } from '@/types/financial'
import type { PaymentMoment, PaymentStructure, DealCommissionPreview } from '@/types/deal'

export interface DealCalculationInput {
  deal_value: number
  commission_pct: number
  has_share: boolean
  share_pct: number         // % that is ours (ex: 50)
  network_pct: number       // % for network (ex: 8)
  consultant_pct: number    // % for consultant from tier (ex: 50)
  payment_structure: PaymentStructure
  cpcv_pct: number          // % paid at CPCV (ex: 30)
  escritura_pct: number     // % paid at Escritura (ex: 70)
  deal_type: string
}

export function calculateDealCommission(input: DealCalculationInput): DealCommissionPreview {
  // 1. Commission total
  const commission_total = input.deal_value * (input.commission_pct / 100)

  // 2. Share
  const share_amount = input.has_share
    ? commission_total * (input.share_pct / 100)
    : commission_total
  const partner_amount = commission_total - share_amount

  // 3. Network
  const network_amount = share_amount * (input.network_pct / 100)

  // 4. Agency margin
  const agency_margin = share_amount - network_amount

  // 5. Consultant
  const consultant_amount = agency_margin * (input.consultant_pct / 100)

  // 6. Agency net
  const agency_net = agency_margin - consultant_amount

  // 7. Generate payment moments
  const payments: DealCommissionPreview['payments'] = []

  if (input.deal_type === 'arrendamento') {
    payments.push({
      moment: 'single',
      pct: 100,
      amount: commission_total,
      network: network_amount,
      agency: agency_net,
      consultant: consultant_amount,
      partner: partner_amount,
    })
  } else if (input.payment_structure === 'cpcv_only') {
    payments.push({
      moment: 'cpcv', pct: 100, amount: commission_total,
      network: network_amount, agency: agency_net,
      consultant: consultant_amount, partner: partner_amount,
    })
  } else if (input.payment_structure === 'escritura_only') {
    payments.push({
      moment: 'escritura', pct: 100, amount: commission_total,
      network: network_amount, agency: agency_net,
      consultant: consultant_amount, partner: partner_amount,
    })
  } else {
    // Split
    const cpcvRatio = input.cpcv_pct / 100
    const escrituraRatio = input.escritura_pct / 100
    payments.push(
      {
        moment: 'cpcv', pct: input.cpcv_pct,
        amount: commission_total * cpcvRatio,
        network: network_amount * cpcvRatio,
        agency: agency_net * cpcvRatio,
        consultant: consultant_amount * cpcvRatio,
        partner: partner_amount * cpcvRatio,
      },
      {
        moment: 'escritura', pct: input.escritura_pct,
        amount: commission_total * escrituraRatio,
        network: network_amount * escrituraRatio,
        agency: agency_net * escrituraRatio,
        consultant: consultant_amount * escrituraRatio,
        partner: partner_amount * escrituraRatio,
      }
    )
  }

  return {
    commission_total,
    share_amount,
    partner_amount,
    network_amount,
    agency_margin,
    consultant_amount,
    agency_net,
    tier_name: null,
    payments,
  }
}

export function getApplicableTier(
  dealValue: number,
  dealType: string,
  tiers: CommissionTier[]
): CommissionTier | null {
  const applicable = tiers
    .filter(t => t.business_type === dealType && t.is_active)
    .sort((a, b) => a.order_index - b.order_index)

  return applicable.find(t =>
    dealValue >= t.min_value &&
    (t.max_value === null || t.max_value === undefined || dealValue < t.max_value)
  ) || null
}

export function calculateInvoiceWithVat(amountNet: number, vatPct: number): { net: number; gross: number; vat: number } {
  const vat = amountNet * (vatPct / 100)
  return { net: amountNet, gross: amountNet + vat, vat }
}
