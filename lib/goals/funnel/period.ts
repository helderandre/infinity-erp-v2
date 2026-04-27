import type { FunnelPeriod } from '@/types/funnel'

export interface PeriodBounds {
  start: Date
  end: Date
  /** Year used for goal lookup (always the year of `start`). */
  year: number
}

/**
 * Resolves a period (daily/weekly/monthly/annual) anchored to a reference date
 * into [start, end] inclusive bounds.
 *   - weekly: ISO week starting Monday
 *   - monthly: calendar month
 *   - annual: calendar year
 */
export function resolvePeriodBounds(period: FunnelPeriod, ref: Date): PeriodBounds {
  const d = new Date(ref)
  // Normalise to local midnight to avoid TZ drift in date math
  d.setHours(0, 0, 0, 0)

  if (period === 'daily') {
    const start = new Date(d)
    const end = new Date(d)
    end.setHours(23, 59, 59, 999)
    return { start, end, year: start.getFullYear() }
  }

  if (period === 'weekly') {
    // ISO week: Monday = 1, Sunday = 7
    const dow = d.getDay() === 0 ? 7 : d.getDay()
    const start = new Date(d)
    start.setDate(d.getDate() - (dow - 1))
    const end = new Date(start)
    end.setDate(start.getDate() + 6)
    end.setHours(23, 59, 59, 999)
    return { start, end, year: start.getFullYear() }
  }

  if (period === 'monthly') {
    const start = new Date(d.getFullYear(), d.getMonth(), 1)
    const end = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999)
    return { start, end, year: start.getFullYear() }
  }

  // annual
  const start = new Date(d.getFullYear(), 0, 1)
  const end = new Date(d.getFullYear(), 11, 31, 23, 59, 59, 999)
  return { start, end, year: start.getFullYear() }
}

export function formatYmd(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/**
 * € target for the given period, derived from the annual revenue target.
 * Uses working_weeks_year / working_days_week from the consultant goal.
 */
export function periodEuroTarget(
  period: FunnelPeriod,
  annualRevenue: number,
  workingWeeksYear: number,
  workingDaysWeek: number,
): number {
  if (annualRevenue <= 0) return 0
  switch (period) {
    case 'annual':
      return annualRevenue
    case 'monthly':
      return annualRevenue / 12
    case 'weekly':
      return workingWeeksYear > 0 ? annualRevenue / workingWeeksYear : 0
    case 'daily': {
      const weekly = workingWeeksYear > 0 ? annualRevenue / workingWeeksYear : 0
      return workingDaysWeek > 0 ? weekly / workingDaysWeek : 0
    }
  }
}
