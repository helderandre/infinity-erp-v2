// Week-arithmetic helpers (ISO weeks, Monday-start).

export function isoMondayOf(date: Date): Date {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  const day = d.getDay() // 0 = Sun … 6 = Sat
  const offset = day === 0 ? -6 : 1 - day // shift to Monday
  d.setDate(d.getDate() + offset)
  return d
}

export function nextWeek(monday: Date): Date {
  const d = new Date(monday)
  d.setDate(d.getDate() + 7)
  return d
}

export function prevWeek(monday: Date): Date {
  const d = new Date(monday)
  d.setDate(d.getDate() - 7)
  return d
}

export function endOfWeek(monday: Date): Date {
  const d = new Date(monday)
  d.setDate(d.getDate() + 6)
  d.setHours(23, 59, 59, 999)
  return d
}

export function ymd(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function parseYmd(s: string): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function isCurrentWeek(monday: Date): boolean {
  const today = isoMondayOf(new Date())
  return ymd(monday) === ymd(today)
}

export function isFuture(monday: Date): boolean {
  const today = isoMondayOf(new Date())
  return monday.getTime() > today.getTime()
}
