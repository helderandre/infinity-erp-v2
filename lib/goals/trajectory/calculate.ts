import type { FunnelStageStatus } from '@/types/funnel'
import type { TrajectorySummary, TrajectoryWeekPoint } from '@/types/trajectory'

/** Mesma constante usada em `lib/goals/funnel/calculate.ts` — split 50/50 da
 *  comissão entre as duas pontas, à excepção de `pleno_agencia`. */
const CONSULTANT_SIDE_FACTOR = 0.5

export interface GoalRow {
  annual_revenue_target: number | null
  pct_buyers: number | null
  pct_sellers: number | null
  buyers_avg_purchase_value: number | null
  buyers_avg_commission_pct: number | null
  sellers_avg_sale_value: number | null
  sellers_avg_commission_pct: number | null
}

/**
 * Conta de escrituras-equivalentes que correspondem ao objectivo anual em €.
 *
 *   take_buyer  = buyers_avg_purchase_value × buyers_commission_pct/100 × 0.5
 *   take_seller = sellers_avg_sale_value    × sellers_commission_pct/100 × 0.5
 *   take_avg    = (take_buyer × pct_buyers + take_seller × pct_sellers) / 100
 *   target_count = annual_revenue_target / take_avg
 */
export function annualTargetCountForGoal(g: GoalRow): number {
  const annual = Number(g.annual_revenue_target || 0)
  if (annual <= 0) return 0
  const pctB = Number(g.pct_buyers || 50)
  const pctS = Number(g.pct_sellers || 50)
  const buyerTake =
    Number(g.buyers_avg_purchase_value || 0) *
    (Number(g.buyers_avg_commission_pct || 0) / 100) *
    CONSULTANT_SIDE_FACTOR
  const sellerTake =
    Number(g.sellers_avg_sale_value || 0) *
    (Number(g.sellers_avg_commission_pct || 0) / 100) *
    CONSULTANT_SIDE_FACTOR
  const takeAvg = (buyerTake * pctB + sellerTake * pctS) / 100
  if (takeAvg <= 0) return 0
  return annual / takeAvg
}

/**
 * Devolve o início de cada semana ISO do ano em formato YYYY-MM-DD,
 * ancorado a segunda-feira. Inclui semanas que comecem em Dezembro do ano
 * anterior se a primeira segunda-feira do ano cair só em Janeiro 7 (caso ISO).
 */
export function weeksOfYear(year: number): { weekIndex: number; start: Date }[] {
  const weeks: { weekIndex: number; start: Date }[] = []
  // Início = segunda-feira da semana que contém 4 de Janeiro (ISO 8601).
  const jan4 = new Date(Date.UTC(year, 0, 4))
  const jan4Dow = jan4.getUTCDay() // 0=Sun..6=Sat
  const isoDow = jan4Dow === 0 ? 7 : jan4Dow // 1..7
  const firstMonday = new Date(jan4)
  firstMonday.setUTCDate(jan4.getUTCDate() - (isoDow - 1))

  // Vamos até à última semana que ainda começa dentro do ano.
  const yearEnd = new Date(Date.UTC(year, 11, 31))
  const cursor = new Date(firstMonday)
  let i = 0
  while (cursor <= yearEnd) {
    weeks.push({ weekIndex: i, start: new Date(cursor) })
    cursor.setUTCDate(cursor.getUTCDate() + 7)
    i++
  }
  return weeks
}

export function ymd(d: Date): string {
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/**
 * Constrói a série semanal cumulativa.
 *
 * `dealDates` é a lista de YYYY-MM-DD (deal.deal_date) dos deals fechados.
 * Para cada semana, conta quantos deals fecharam ATÉ ao fim dessa semana.
 * A linha de target é uma rampa linear: target × (semana+1) / totalSemanas.
 */
export function buildWeeklyTrajectory(args: {
  year: number
  annualTargetCount: number
  dealDates: string[] // YYYY-MM-DD, podem estar fora do ano (são filtrados)
}): TrajectoryWeekPoint[] {
  const weeks = weeksOfYear(args.year)
  const total = weeks.length
  // Ordenar dealDates ascendentes para iteração linear
  const sorted = [...args.dealDates].sort()
  const points: TrajectoryWeekPoint[] = []
  let cursor = 0
  let cumulative = 0
  for (const w of weeks) {
    const weekEnd = new Date(w.start)
    weekEnd.setUTCDate(weekEnd.getUTCDate() + 6)
    const weekEndYmd = ymd(weekEnd)
    while (cursor < sorted.length && sorted[cursor] <= weekEndYmd) {
      cumulative++
      cursor++
    }
    points.push({
      week_index: w.weekIndex,
      week_start: ymd(w.start),
      realized_cumulative: cumulative,
      target_cumulative:
        total > 0 ? Math.round(((args.annualTargetCount * (w.weekIndex + 1)) / total) * 10) / 10 : 0,
    })
  }
  return points
}

export function statusFromProjection(args: {
  projected: number
  target: number
}): FunnelStageStatus {
  if (args.target <= 0) return 'pending'
  const ratio = args.projected / args.target
  if (ratio >= 1) return 'completed'
  if (ratio >= 0.95) return 'on_track'
  if (ratio >= 0.7) return 'attention'
  return 'late'
}

export function buildHeadline(args: {
  realized: number
  projected: number
  target: number
  status: FunnelStageStatus
  scope: 'consultant' | 'team'
}): { headline: string; action_hint: string | null } {
  const subject = args.scope === 'team' ? 'A equipa fecha' : 'Ao ritmo actual fechas'
  const projectedRounded = Math.round(args.projected)
  const targetRounded = Math.round(args.target)
  const headline = `${subject} ~${projectedRounded} de ${targetRounded} escrituras este ano.`

  if (args.target <= 0) return { headline, action_hint: null }
  const gap = args.target - args.projected

  if (args.status === 'completed') {
    return {
      headline,
      action_hint:
        args.projected > args.target
          ? `Acima do objectivo em ~${Math.round(args.projected - args.target)} escrituras.`
          : 'No objectivo.',
    }
  }
  if (args.status === 'on_track') {
    return { headline, action_hint: 'No bom caminho — falta pouco para o objectivo.' }
  }

  // attention / late
  const extraNeeded = Math.max(1, Math.ceil(gap))
  const noun = extraNeeded === 1 ? 'escritura' : 'escrituras'
  return {
    headline,
    action_hint: `Para chegar ao objectivo precisas de fechar mais ${extraNeeded} ${noun} além do ritmo actual.`,
  }
}

/**
 * Junta tudo: dado o conjunto de goals + datas de deals fechados, devolve o
 * summary + série semanal pronta para o gráfico.
 */
export function buildTrajectory(args: {
  year: number
  today: Date
  goals: GoalRow[]
  dealDatesYtd: string[] // YYYY-MM-DD dos deals fechados (deal_date)
  realizedEurYtd: number
  scope: 'consultant' | 'team'
}): { summary: TrajectorySummary; weekly: TrajectoryWeekPoint[]; weeksInYear: number; weeksElapsed: number } {
  const annualTargetEur = args.goals.reduce((acc, g) => acc + Number(g.annual_revenue_target || 0), 0)
  const annualTargetCount = args.goals.reduce((acc, g) => acc + annualTargetCountForGoal(g), 0)

  const weeks = weeksOfYear(args.year)
  const todayYmd = ymd(args.today)
  const weeksElapsed = Math.max(
    1,
    weeks.filter((w) => ymd(w.start) <= todayYmd).length,
  )
  const weeksInYear = weeks.length

  const realizedYtd = args.dealDatesYtd.filter((d) => d <= todayYmd).length
  const pace = realizedYtd / weeksElapsed
  const weeksRemaining = Math.max(0, weeksInYear - weeksElapsed)
  const projected = realizedYtd + pace * weeksRemaining
  const status = statusFromProjection({ projected, target: annualTargetCount })
  const { headline, action_hint } = buildHeadline({
    realized: realizedYtd,
    projected,
    target: annualTargetCount,
    status,
    scope: args.scope,
  })

  const weekly = buildWeeklyTrajectory({
    year: args.year,
    annualTargetCount,
    dealDates: args.dealDatesYtd,
  })

  return {
    summary: {
      annual_target_count: Math.round(annualTargetCount * 10) / 10,
      annual_target_eur: Math.round(annualTargetEur),
      realized_count_ytd: realizedYtd,
      realized_eur_ytd: Math.round(args.realizedEurYtd),
      pace_per_week: Math.round(pace * 100) / 100,
      projected_year_end_count: Math.round(projected * 10) / 10,
      status,
      headline,
      action_hint,
    },
    weekly,
    weeksInYear,
    weeksElapsed,
  }
}
