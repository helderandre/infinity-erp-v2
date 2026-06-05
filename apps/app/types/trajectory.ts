// Trajectória anual — north-star da página /dashboard/objetivos.
// Responde: "ao ritmo actual fecho X de Y escrituras este ano?"

import type { FunnelStageStatus } from './funnel'

export type TrajectoryScope = 'consultant' | 'team'

export interface TrajectoryWeekPoint {
  /** 0-indexed semana ISO do ano (0 = primeira semana). */
  week_index: number
  /** Início da semana (segunda-feira) em formato YYYY-MM-DD. */
  week_start: string
  /** Cumulativo de escrituras realizadas até ao fim desta semana. */
  realized_cumulative: number
  /** Linha de ritmo necessário: target_anual × (week_index+1) / total_weeks. */
  target_cumulative: number
}

export interface TrajectorySummary {
  /** Quantas escrituras é preciso fazer este ano para bater o objectivo €. */
  annual_target_count: number
  /** Objectivo anual em € (somado em scope=team). */
  annual_target_eur: number
  /** Escrituras já fechadas YTD. */
  realized_count_ytd: number
  /** € já realizado YTD (na perspectiva do consultor — split CPCV/escritura). */
  realized_eur_ytd: number
  /** Ritmo médio: realized / semanas_decorridas. */
  pace_per_week: number
  /** Projecção: realized + pace × semanas_restantes. */
  projected_year_end_count: number
  /** Status agregado consoante a projecção vs target. */
  status: FunnelStageStatus
  /** Mensagem PT-PT pronta a renderizar. Ex.: "Em risco de não atingir o objectivo". */
  headline: string
  /** Sentença de acção, opcional. Ex.: "Precisas de fechar mais 2 escrituras nas próximas 8 semanas para chegar ao objectivo." */
  action_hint: string | null
}

export interface TrajectoryResponse {
  scope: TrajectoryScope
  year: number
  today: string // YYYY-MM-DD
  weeks_in_year: number
  weeks_elapsed: number
  consultant: {
    id: string
    commercial_name: string
    profile_photo_url: string | null
  } | null
  team_member_count?: number
  summary: TrajectorySummary
  /** Série semanal Jan→Dez para o gráfico. */
  weekly: TrajectoryWeekPoint[]
}
