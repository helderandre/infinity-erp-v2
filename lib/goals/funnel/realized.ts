/**
 * Cálculo de "realized €" para o funil de objetivos.
 *
 * Regra de negócio (PT residencial):
 *   - A comissão de um deal é dividida em 2 tranches: CPCV + Escritura.
 *   - Default 50/50 quando não preenchido. `cpcv_pct + escritura_pct = 100`.
 *   - O consultor só recebe a parte que lhe corresponde do deal (tipicamente
 *     50% da comissão da agência — o resto vai para o agente do outro lado
 *     ou para a agência). O campo `consultant_amount` já reflecte a parte
 *     final que cabe ao consultor depois de todos os splits.
 *
 * Reconhecimento temporal:
 *   - Tranche CPCV é contada na data efectiva (`cpcv_actual_date`) ou na
 *     data prevista (`contract_signing_date`) se a real ainda não existe.
 *   - Tranche Escritura é contada na data efectiva (`escritura_actual_date`)
 *     ou na data prevista (`deal_date`) — mas só **depois** da data passar
 *     (não contamos escrituras futuras como dinheiro recebido).
 */

export interface DealForRealized {
  consultant_id: string | null
  commission_total: number | string | null
  consultant_amount: number | string | null
  cpcv_pct: number | string | null
  escritura_pct: number | string | null
  contract_signing_date: string | null
  cpcv_actual_date: string | null
  deal_date: string | null
  escritura_actual_date: string | null
}

/** Percentagem default que vai para o consultor quando `consultant_amount`
 *  não está preenchido. Equivalente a "uma das duas pontas do negócio". */
const DEFAULT_CONSULTANT_SIDE_FACTOR = 0.5

/** Default cpcv/escritura split quando ambos campos estão NULL. */
const DEFAULT_CPCV_PCT = 50
const DEFAULT_ESCRITURA_PCT = 50

function ymd(value: string | null): string | null {
  if (!value) return null
  return String(value).slice(0, 10)
}

function consultorTakeHome(deal: DealForRealized): number {
  const explicit = Number(deal.consultant_amount)
  if (Number.isFinite(explicit) && explicit > 0) return explicit
  // Fallback: a parte do consultor é metade da comissão da agência.
  const total = Number(deal.commission_total) || 0
  return total * DEFAULT_CONSULTANT_SIDE_FACTOR
}

function tranchePcts(deal: DealForRealized): { cpcv: number; escritura: number } {
  const cpcvRaw = deal.cpcv_pct
  const escRaw = deal.escritura_pct
  const cpcvSet = cpcvRaw !== null && cpcvRaw !== undefined
  const escSet = escRaw !== null && escRaw !== undefined

  if (cpcvSet && escSet) {
    return { cpcv: Number(cpcvRaw) || 0, escritura: Number(escRaw) || 0 }
  }
  if (cpcvSet) {
    const c = Number(cpcvRaw) || 0
    return { cpcv: c, escritura: 100 - c }
  }
  if (escSet) {
    const e = Number(escRaw) || 0
    return { cpcv: 100 - e, escritura: e }
  }
  return { cpcv: DEFAULT_CPCV_PCT, escritura: DEFAULT_ESCRITURA_PCT }
}

function inWindow(dateYmd: string | null, startYmd: string, endYmd: string): boolean {
  if (!dateYmd) return false
  return dateYmd >= startYmd && dateYmd <= endYmd
}

/**
 * Devolve o € que o consultor efectivamente recebeu pelo deal, dado o
 * período [start, end]. Conta CPCV e/ou Escritura conforme cada uma cair
 * dentro da janela.
 *
 * `todayYmd` define o "agora" — escrituras futuras não contam mesmo que
 * `deal_date` caia na janela (e.g., janela = "ano 2026" e deal_date é
 * 2026-12-15 mas hoje é 2026-05-16: escritura ainda não aconteceu).
 */
export function realizedFromDeal(
  deal: DealForRealized,
  startYmd: string,
  endYmd: string,
  todayYmd: string,
): number {
  const takeHome = consultorTakeHome(deal)
  if (takeHome <= 0) return 0

  const { cpcv: cpcvPct, escritura: escrituraPct } = tranchePcts(deal)

  const cpcvDate = ymd(deal.cpcv_actual_date) ?? ymd(deal.contract_signing_date)
  const escrituraDate = ymd(deal.escritura_actual_date) ?? ymd(deal.deal_date)

  let received = 0

  // Tranche CPCV — basta ter acontecido (a data já implica que o consultor
  // recebeu o sinal nesse dia).
  if (cpcvDate && inWindow(cpcvDate, startYmd, endYmd) && cpcvDate <= todayYmd) {
    received += takeHome * (cpcvPct / 100)
  }

  // Tranche Escritura — só se a data já passou (não contar escrituras futuras
  // como receita realizada).
  if (
    escrituraDate &&
    inWindow(escrituraDate, startYmd, endYmd) &&
    escrituraDate <= todayYmd
  ) {
    received += takeHome * (escrituraPct / 100)
  }

  return received
}

/**
 * Agrega o realized por consultor para uma janela.
 * Filtra automaticamente os deals cujas tranches caem fora da janela.
 */
export function aggregateRealizedByConsultant(
  deals: DealForRealized[],
  startYmd: string,
  endYmd: string,
  todayYmd: string,
): Record<string, number> {
  const byConsultor: Record<string, number> = {}
  for (const d of deals) {
    if (!d.consultant_id) continue
    const amount = realizedFromDeal(d, startYmd, endYmd, todayYmd)
    if (amount <= 0) continue
    byConsultor[d.consultant_id] = (byConsultor[d.consultant_id] || 0) + amount
  }
  return byConsultor
}

/**
 * Lista de colunas necessárias para a query a `deals`. Use-as no `.select()`.
 */
export const REALIZED_DEAL_COLUMNS =
  'consultant_id, commission_total, consultant_amount, cpcv_pct, escritura_pct, ' +
  'contract_signing_date, cpcv_actual_date, deal_date, escritura_actual_date'
