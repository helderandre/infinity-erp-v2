/**
 * Simple RRULE parser for computing the next occurrence after a given date.
 * Supports: FREQ (DAILY|WEEKLY|MONTHLY|YEARLY), INTERVAL, BYDAY.
 * Does NOT aim to be a full RFC-5545 implementation.
 */

const DAY_MAP: Record<string, number> = {
  SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6,
}

interface RRuleParts {
  freq: string
  interval: number
  byDay: number[] | null
}

function parseRule(rule: string): RRuleParts {
  const parts: Record<string, string> = {}
  rule.replace(/^RRULE:/, '').split(';').forEach((p) => {
    const [k, v] = p.split('=')
    if (k && v) parts[k] = v
  })

  return {
    freq: parts.FREQ || 'DAILY',
    interval: parts.INTERVAL ? parseInt(parts.INTERVAL, 10) : 1,
    byDay: parts.BYDAY
      ? parts.BYDAY.split(',').map((d) => DAY_MAP[d]).filter((n) => n !== undefined)
      : null,
  }
}

/**
 * Given a base date and an RRULE string, return the next occurrence as an ISO string.
 * If the rule can't be parsed, returns null.
 */
export function getNextOccurrence(baseDate: string, rule: string): string | null {
  try {
    const { freq, interval, byDay } = parseRule(rule)
    const base = new Date(baseDate)

    if (isNaN(base.getTime())) return null

    const next = new Date(base)

    switch (freq) {
      case 'DAILY':
        next.setDate(next.getDate() + interval)
        break

      case 'WEEKLY':
        if (byDay && byDay.length > 0) {
          // Find the next matching day of the week
          let found = false
          for (let i = 1; i <= 7 * interval; i++) {
            const candidate = new Date(base)
            candidate.setDate(candidate.getDate() + i)
            if (byDay.includes(candidate.getDay())) {
              next.setTime(candidate.getTime())
              found = true
              break
            }
          }
          if (!found) {
            next.setDate(next.getDate() + 7 * interval)
          }
        } else {
          next.setDate(next.getDate() + 7 * interval)
        }
        break

      case 'MONTHLY':
        next.setMonth(next.getMonth() + interval)
        break

      case 'YEARLY':
        next.setFullYear(next.getFullYear() + interval)
        break

      default:
        return null
    }

    return next.toISOString()
  } catch {
    return null
  }
}
