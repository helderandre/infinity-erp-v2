/**
 * computeDealFinancials — fórmula ÚNICA da repartição de comissão ao nível do
 * negócio. Partilhada por:
 *   - criação inicial: `POST /api/deals/[id]/submit` (e a server action `createDeal`)
 *   - recálculo automático: `recalcDealPayments` (override pattern)
 *
 * Mantê-las no mesmo sítio impede que divirjam (ver
 * `/overridable-computed-values-portable-spec.md` §6). NÃO faz IO.
 *
 * Cadeia (igual ao submit histórico):
 *   commission_total = deal_value × commission%
 *   share_amount     = has_share ? commission_total × share% : commission_total
 *   partner_amount   = commission_total − share_amount
 *   network_amount   = share_amount × network%        (Convictus/rede)
 *   agency_margin    = share_amount − network_amount
 *   consultant_amount= agency_margin × tier%          (escalão do consultor)
 *   agency_net       = agency_margin − consultant_amount
 */

export interface DealFinancialsInput {
  dealValue: number
  /** Fracção (0–1). Ex.: 5% → 0.05. */
  commissionPctFraction: number
  hasShare: boolean
  /** Percentagem da NOSSA parte quando há partilha (ex.: 50). */
  sharePctValue: number
  /** Fracção (0–1). Ex.: 8% → 0.08. */
  networkPctFraction: number
  /** Fracção (0–1). Ex.: escalão 50% → 0.5. */
  mainTierRateFraction: number
}

export interface DealFinancials {
  commission_total: number
  share_amount: number
  partner_amount: number
  network_amount: number
  agency_margin: number
  consultant_amount: number
  agency_net: number
}

export function computeDealFinancials(i: DealFinancialsInput): DealFinancials {
  const commission_total = i.dealValue * i.commissionPctFraction
  const share_amount = i.hasShare
    ? commission_total * (i.sharePctValue / 100)
    : commission_total
  const partner_amount = commission_total - share_amount
  const network_amount = share_amount * i.networkPctFraction
  const agency_margin = share_amount - network_amount
  const consultant_amount = agency_margin * i.mainTierRateFraction
  const agency_net = agency_margin - consultant_amount

  return {
    commission_total,
    share_amount,
    partner_amount,
    network_amount,
    agency_margin,
    consultant_amount,
    agency_net,
  }
}

/** Montantes de um momento de pagamento (cpcv/escritura/single) dado o seu %. */
export function momentAmounts(f: DealFinancials, momentPct: number) {
  const ratio = momentPct / 100
  return {
    amount: f.commission_total * ratio,
    network_amount: f.network_amount * ratio,
    agency_amount: f.agency_margin * ratio,
    consultant_amount: f.consultant_amount * ratio,
    partner_amount: f.partner_amount * ratio,
  }
}
