import type { AvailabilityRule } from '@/lib/booking/slot-generator'

/**
 * Quando um consultor ainda não configurou disponibilidade (nem ao nível do
 * imóvel nem ao nível pessoal), assumimos que todos os dias da semana têm
 * uma janela útil. Mantém a UX "marca já" zero-config — o consultor pode
 * depois apertar a janela quando quiser.
 *
 * Janela default: 09:00 → 19:00, segunda a domingo. Os 7 dias estão
 * cobertos para que a navegação no calendário não tenha "ilhas" vazias.
 */
export const DEFAULT_AVAILABILITY_WINDOW = {
  start_time: '09:00',
  end_time: '19:00',
} as const

export function getDefaultAvailabilityRules(): AvailabilityRule[] {
  return [0, 1, 2, 3, 4, 5, 6].map((day_of_week) => ({
    day_of_week,
    start_time: DEFAULT_AVAILABILITY_WINDOW.start_time,
    end_time: DEFAULT_AVAILABILITY_WINDOW.end_time,
    active: true,
  }))
}
