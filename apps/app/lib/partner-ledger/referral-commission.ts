// Referral-commission computation for the partner ledger.
//
// Single source of truth mirrored from the kanban totals
// (app/api/crm/kanban/[pipelineType]/route.ts):
//   sale   (comprador / vendedor):        value × 0.05 × 0.5
//   rental (arrendatário / senhorio / arrendador): value × 1.5 × 0.5
// The referrer's slice is that base × (referral_pct / 100), falling back to
// the agency default (temp_agency_settings.default_referral_pct, 25%).

export type CommissionNegocio = {
  tipo?: string | null
  expected_value?: number | string | null
  preco_venda?: number | string | null
  orcamento?: number | string | null
  orcamento_max?: number | string | null
  renda_pretendida?: number | string | null
  renda_max_mensal?: number | string | null
  referral_pct?: number | string | null
}

const RENTAL_TIPOS = new Set(['Arrendatário', 'Senhorio', 'Arrendador'])

export function isRentalTipo(tipo: string | null | undefined): boolean {
  return !!tipo && RENTAL_TIPOS.has(tipo)
}

function num(v: number | string | null | undefined): number {
  const n = typeof v === 'number' ? v : v != null ? parseFloat(String(v)) : 0
  return Number.isFinite(n) ? n : 0
}

/** Gross deal value used as the commission base. */
export function negocioGrossValue(n: CommissionNegocio, isRental: boolean): number {
  const expected = num(n.expected_value)
  if (expected > 0) return expected
  if (isRental) return num(n.renda_pretendida) || num(n.renda_max_mensal)
  return num(n.preco_venda) || num(n.orcamento_max) || num(n.orcamento)
}

/**
 * Referrer's commission slice in € for a négocio.
 * @param defaultPctFraction agency default referral fraction (e.g. 0.25) used
 *   when the deal has no explicit referral_pct.
 */
export function computeReferralCommission(
  n: CommissionNegocio,
  opts?: { isRental?: boolean; defaultPctFraction?: number },
): number {
  const isRental = opts?.isRental ?? isRentalTipo(n.tipo)
  const commissionFactor = isRental ? 1.5 * 0.5 : 0.05 * 0.5
  const base = negocioGrossValue(n, isRental) * commissionFactor
  const pct = num(n.referral_pct)
  const pctFraction = pct > 0 ? pct / 100 : (opts?.defaultPctFraction ?? 0.25)
  return Math.round(base * pctFraction * 100) / 100
}
