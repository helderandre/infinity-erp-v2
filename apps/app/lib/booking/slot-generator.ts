// Slot generation for public booking.
// Given a consultant's (or property override's) availability rules, their settings,
// and existing visits, compute available slot start-times per date.

export interface AvailabilityRule {
  day_of_week: number       // 0 = Sunday, 6 = Saturday
  start_time: string        // HH:MM or HH:MM:SS
  end_time: string
  active: boolean
}

export interface BookingSettings {
  slot_duration_minutes: number
  buffer_minutes: number
  advance_days: number
  min_notice_hours: number
  public_booking_enabled: boolean
}

export interface ExistingVisit {
  visit_date: string        // YYYY-MM-DD
  visit_time: string        // HH:MM or HH:MM:SS
  duration_minutes: number | null
}

/** Date-range window during which booking is allowed. If any exist for an entity, the date must fall within at least one of them. */
export interface BookingWindow {
  start_date: string        // YYYY-MM-DD (inclusive)
  end_date: string          // YYYY-MM-DD (inclusive)
  active: boolean
}

/** Per-date override. Takes priority over weekly rules for that specific date. */
export interface DateOverride {
  override_date: string     // YYYY-MM-DD
  blocked: boolean
  start_time: string | null // HH:MM or null if blocked
  end_time: string | null
}

export interface SlotMap {
  [dateISO: string]: string[]  // ["09:00", "09:30", ...]
}

const pad = (n: number) => n.toString().padStart(2, '0')

function toMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}

function fromMinutes(mins: number): string {
  return `${pad(Math.floor(mins / 60))}:${pad(mins % 60)}`
}

function dateISO(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/**
 * Generate available slot start-times for every date in [fromDate, toDate].
 * Dates outside the advance/notice window are excluded.
 *
 * Precedence for each date:
 *   1. If a date override exists (property first, then consultant), it replaces the weekly rules for that day.
 *      - If blocked=true → no slots.
 *      - Otherwise use that override's start/end as a single "rule" for the day.
 *   2. Otherwise, use the weekly rules for the day-of-week.
 *
 * Precedence for booking windows (date must be inside at least one window if any exist):
 *   - Property windows (if any) REPLACE consultant windows.
 *   - If neither level has windows, no window restriction.
 *   - If the relevant level has windows but this date is outside all of them → no slots.
 */
export function generateSlots(params: {
  fromDate: Date
  toDate: Date
  rules: AvailabilityRule[]
  settings: BookingSettings
  existingVisits: ExistingVisit[]
  windows?: BookingWindow[]
  overrides?: DateOverride[]
  now?: Date
}): SlotMap {
  const { fromDate, toDate, rules, settings, existingVisits } = params
  const windows = (params.windows ?? []).filter((w) => w.active)
  const overrides = params.overrides ?? []
  const now = params.now ?? new Date()

  if (!settings.public_booking_enabled) return {}

  const activeRules = rules.filter((r) => r.active)

  const slotDur = settings.slot_duration_minutes
  const buffer = settings.buffer_minutes
  const minNoticeMs = settings.min_notice_hours * 60 * 60 * 1000

  const earliest = new Date(now.getTime() + minNoticeMs)
  const maxDate = new Date(now)
  maxDate.setDate(maxDate.getDate() + settings.advance_days)
  maxDate.setHours(23, 59, 59, 999)

  // Pre-index existing visits by date
  const visitsByDate = new Map<string, ExistingVisit[]>()
  for (const v of existingVisits) {
    const list = visitsByDate.get(v.visit_date) ?? []
    list.push(v)
    visitsByDate.set(v.visit_date, list)
  }

  // Pre-index overrides by date
  const overrideByDate = new Map<string, DateOverride>()
  for (const o of overrides) overrideByDate.set(o.override_date, o)

  const isWithinWindows = (iso: string): boolean => {
    if (windows.length === 0) return true
    return windows.some((w) => iso >= w.start_date && iso <= w.end_date)
  }

  const result: SlotMap = {}

  const cursor = new Date(fromDate)
  cursor.setHours(0, 0, 0, 0)
  const end = new Date(toDate)
  end.setHours(23, 59, 59, 999)

  while (cursor <= end) {
    if (cursor > maxDate) break

    const iso = dateISO(cursor)

    // Window check
    if (!isWithinWindows(iso)) {
      cursor.setDate(cursor.getDate() + 1)
      continue
    }

    // Resolve the effective ranges for this date
    let dayRanges: { start: string; end: string }[] = []
    const override = overrideByDate.get(iso)
    if (override) {
      if (override.blocked) {
        cursor.setDate(cursor.getDate() + 1)
        continue
      }
      if (override.start_time && override.end_time) {
        dayRanges = [{ start: override.start_time, end: override.end_time }]
      }
    } else {
      dayRanges = activeRules
        .filter((r) => r.day_of_week === cursor.getDay())
        .map((r) => ({ start: r.start_time, end: r.end_time }))
    }

    if (dayRanges.length > 0) {
      const dayVisits = visitsByDate.get(iso) ?? []
      const slots: string[] = []

      for (const range of dayRanges) {
        const startMin = toMinutes(range.start)
        const endMin = toMinutes(range.end)

        for (let m = startMin; m + slotDur <= endMin; m += slotDur) {
          const slotStart = m
          const slotEnd = m + slotDur

          const slotDateTime = new Date(cursor)
          slotDateTime.setHours(0, 0, 0, 0)
          slotDateTime.setMinutes(slotStart)

          if (slotDateTime < earliest) continue

          const hasConflict = dayVisits.some((v) => {
            const vStart = toMinutes(v.visit_time)
            const vEnd = vStart + (v.duration_minutes ?? slotDur)
            const blockedStart = vStart - buffer
            const blockedEnd = vEnd + buffer
            return slotStart < blockedEnd && slotEnd > blockedStart
          })

          if (!hasConflict) slots.push(fromMinutes(slotStart))
        }
      }

      if (slots.length > 0) result[iso] = slots
    }

    cursor.setDate(cursor.getDate() + 1)
  }

  return result
}

/**
 * Validate that a specific date+time is still a valid slot
 * (used server-side before creating the visit).
 */
export function isValidSlot(params: {
  targetDate: string
  targetTime: string
  rules: AvailabilityRule[]
  settings: BookingSettings
  existingVisits: ExistingVisit[]
  windows?: BookingWindow[]
  overrides?: DateOverride[]
  now?: Date
}): boolean {
  const { targetDate, targetTime } = params
  const map = generateSlots({
    fromDate: new Date(targetDate),
    toDate: new Date(targetDate),
    rules: params.rules,
    settings: params.settings,
    existingVisits: params.existingVisits,
    windows: params.windows,
    overrides: params.overrides,
    now: params.now,
  })
  const slots = map[targetDate] ?? []
  const target = targetTime.length >= 5 ? targetTime.slice(0, 5) : targetTime
  return slots.includes(target)
}
