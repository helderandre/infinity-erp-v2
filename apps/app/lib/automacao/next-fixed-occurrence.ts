import { TZDate } from "@date-fns/tz"

export type FixedEventType = "aniversario_contacto" | "natal" | "ano_novo"

export interface NextFixedOccurrenceArgs {
  eventType: FixedEventType
  birthday?: string | null // ISO yyyy-mm-dd (required for aniversario_contacto)
  sendHour?: number
  timezone?: string
  now?: Date
}

function lastDayOfMonth(year: number, month1to12: number): number {
  return new Date(Date.UTC(year, month1to12, 0)).getUTCDate()
}

function buildZoned(
  year: number,
  month1to12: number,
  day: number,
  hour: number,
  timezone: string,
): TZDate {
  const safeDay = Math.min(day, lastDayOfMonth(year, month1to12))
  return new TZDate(year, month1to12 - 1, safeDay, hour, 0, 0, 0, timezone)
}

function parseMonthDay(iso: string): { month: number; day: number } | null {
  const [y, m, d] = iso.split("T")[0].split("-").map(Number)
  if (!y || !m || !d) return null
  return { month: m, day: d }
}

/**
 * Compute the next trigger_at for one of the three fixed event types.
 * Returns null when the event cannot be computed (e.g. birthday missing).
 *
 * Semantics:
 * - aniversario_contacto: birthday's month/day at sendHour local TZ; if already past, next year.
 * - natal: 25/12 at sendHour; if past, next year.
 * - ano_novo: 31/12 at sendHour; if past, next year.
 * - Feb 29 birthdays fall back to Feb 28 on non-leap years (Math.min via lastDayOfMonth).
 */
export function computeNextFixedOccurrence(args: NextFixedOccurrenceArgs): Date | null {
  const timezone = args.timezone ?? "Europe/Lisbon"
  const sendHour = typeof args.sendHour === "number" ? args.sendHour : 8
  const ref = args.now ?? new Date()
  const zonedRef = new TZDate(ref, timezone)
  const refYear = zonedRef.getFullYear()

  let month: number
  let day: number

  switch (args.eventType) {
    case "aniversario_contacto": {
      if (!args.birthday) return null
      const parsed = parseMonthDay(args.birthday)
      if (!parsed) return null
      month = parsed.month
      day = parsed.day
      break
    }
    case "natal":
      month = 12
      day = 25
      break
    case "ano_novo":
      month = 12
      day = 31
      break
    default:
      return null
  }

  let candidate = buildZoned(refYear, month, day, sendHour, timezone)
  if (candidate.getTime() <= ref.getTime()) {
    candidate = buildZoned(refYear + 1, month, day, sendHour, timezone)
  }
  return new Date(candidate.getTime())
}
