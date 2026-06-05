/**
 * Calculate business days (dias úteis) between two dates.
 * Excludes weekends (Saturday & Sunday). Does not account for public holidays.
 */
export function businessDaysBetween(start: Date | string, end: Date | string): number {
  const startDate = new Date(start)
  const endDate = new Date(end)

  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) return 0
  if (endDate <= startDate) return 0

  let count = 0
  const current = new Date(startDate)
  current.setHours(0, 0, 0, 0)

  const target = new Date(endDate)
  target.setHours(0, 0, 0, 0)

  while (current < target) {
    current.setDate(current.getDate() + 1)
    const day = current.getDay()
    if (day !== 0 && day !== 6) count++ // Skip Sunday (0) and Saturday (6)
  }

  return count
}

/**
 * Format business days as a readable string.
 */
export function formatBusinessDays(days: number): string {
  if (days === 0) return '< 1 dia útil'
  if (days === 1) return '1 dia útil'
  return `${days} dias úteis`
}
