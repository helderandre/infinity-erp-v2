/**
 * Date-range filtering shared by the CRM → Análise → Meta surfaces (Campanhas +
 * Leads). The client turns a date preset (mirrors the Meta Ads page) into an
 * inclusive `{ from, to }` YYYY-MM-DD range and sends it as query params; the
 * server parses it back and applies it to the insight + lead scans.
 */

export type MetaDatePreset =
  | 'last_7d'
  | 'last_14d'
  | 'last_30d'
  | 'last_90d'
  | 'this_month'
  | 'last_month'
  | 'maximum'

export const META_DATE_PRESETS: { key: MetaDatePreset; label: string }[] = [
  { key: 'last_7d', label: '7 dias' },
  { key: 'last_14d', label: '14 dias' },
  { key: 'last_30d', label: '30 dias' },
  { key: 'last_90d', label: '90 dias' },
  { key: 'this_month', label: 'Este mês' },
  { key: 'last_month', label: 'Último mês' },
  { key: 'maximum', label: 'Tudo' },
]

export function isValidDatePreset(value: string): value is MetaDatePreset {
  return META_DATE_PRESETS.some((p) => p.key === value)
}

/** Inclusive day range, both ends as YYYY-MM-DD. Empty object = no bounds. */
export interface MetaDateRange {
  from?: string
  to?: string
}

function ymd(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/**
 * Convert a preset into an inclusive day range relative to `now`. `maximum`
 * yields no bounds. Pure — safe on client and server.
 */
export function presetToRange(preset: MetaDatePreset, now: Date = new Date()): MetaDateRange {
  const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const daysAgo = (n: number) => new Date(now.getFullYear(), now.getMonth(), now.getDate() - n)

  switch (preset) {
    case 'last_7d':
      return { from: ymd(daysAgo(6)), to: ymd(todayEnd) }
    case 'last_14d':
      return { from: ymd(daysAgo(13)), to: ymd(todayEnd) }
    case 'last_30d':
      return { from: ymd(daysAgo(29)), to: ymd(todayEnd) }
    case 'last_90d':
      return { from: ymd(daysAgo(89)), to: ymd(todayEnd) }
    case 'this_month':
      return { from: ymd(new Date(now.getFullYear(), now.getMonth(), 1)), to: ymd(todayEnd) }
    case 'last_month':
      return {
        from: ymd(new Date(now.getFullYear(), now.getMonth() - 1, 1)),
        to: ymd(new Date(now.getFullYear(), now.getMonth(), 0)),
      }
    case 'maximum':
    default:
      return {}
  }
}

const YMD_RE = /^\d{4}-\d{2}-\d{2}$/

/** Parse + validate `from`/`to` query params into a range (invalid → dropped). */
export function parseDateRange(searchParams: URLSearchParams): MetaDateRange {
  const from = searchParams.get('from')?.trim()
  const to = searchParams.get('to')?.trim()
  const range: MetaDateRange = {}
  if (from && YMD_RE.test(from)) range.from = from
  if (to && YMD_RE.test(to)) range.to = to
  return range
}

/**
 * Timestamp bounds for filtering a timestamptz column (e.g. lead
 * `fb_created_time`) by an inclusive day range. `to` becomes end-of-day.
 */
export function timestampBounds(range: MetaDateRange): { gte?: string; lte?: string } {
  const out: { gte?: string; lte?: string } = {}
  if (range.from) out.gte = `${range.from}T00:00:00.000Z`
  if (range.to) out.lte = `${range.to}T23:59:59.999Z`
  return out
}
