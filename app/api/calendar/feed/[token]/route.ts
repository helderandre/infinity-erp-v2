/**
 * Public iCalendar (.ics) feed for a single consultant.
 *
 * Authorisation: the URL token in `dev_consultant_profiles.calendar_feed_token`
 * is the only secret. Rotating it (via /api/calendar/feed/token POST) invalidates
 * existing subscriptions. The endpoint runs with the admin client so it can
 * read the consultant's events without an authenticated session — Google's
 * polling agent has no cookies.
 *
 * Compatible with Google Calendar, Apple Calendar, Outlook, Thunderbird —
 * any RFC 5545 reader.
 */
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

// Window: 90 days back through 365 days forward keeps the file small while
// covering reasonable look-back/ahead. Recurring events are emitted with
// RRULE so the subscriber handles expansion across the whole year.
const PAST_DAYS = 90
const FUTURE_DAYS = 365

interface CalendarEventRow {
  id: string
  title: string
  description: string | null
  category: string | null
  start_date: string
  end_date: string | null
  all_day: boolean
  is_recurring: boolean
  recurrence_rule: string | null
  location: string | null
  created_at: string
  updated_at: string
}

// ── ICS helpers ─────────────────────────────────────────────────────────────

/** Escape a text value per RFC 5545 §3.3.11 */
function icsEscape(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;')
}

/** Format a Date as ICS UTC timestamp `YYYYMMDDTHHmmssZ` */
function fmtUtc(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return (
    date.getUTCFullYear().toString() +
    pad(date.getUTCMonth() + 1) +
    pad(date.getUTCDate()) +
    'T' +
    pad(date.getUTCHours()) +
    pad(date.getUTCMinutes()) +
    pad(date.getUTCSeconds()) +
    'Z'
  )
}

/** Format a Date as ICS all-day date `YYYYMMDD` (UTC for stability) */
function fmtDate(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return (
    date.getUTCFullYear().toString() +
    pad(date.getUTCMonth() + 1) +
    pad(date.getUTCDate())
  )
}

/**
 * Fold lines longer than 75 octets per RFC 5545 §3.1. Strict readers (e.g.
 * Outlook on Windows) reject longer lines; lenient ones (Google) tolerate
 * them but we fold for portability.
 */
function foldLine(line: string): string {
  if (line.length <= 75) return line
  const chunks: string[] = []
  let i = 0
  while (i < line.length) {
    chunks.push(line.slice(i, i + 75))
    i += 75
  }
  return chunks.join('\r\n ')
}

function mapRrule(rule: string | null): string | null {
  if (!rule) return null
  const r = rule.toLowerCase()
  if (r === 'yearly') return 'FREQ=YEARLY'
  if (r === 'monthly') return 'FREQ=MONTHLY'
  if (r === 'weekly') return 'FREQ=WEEKLY'
  // Already an RRULE prop list (e.g. "FREQ=DAILY;INTERVAL=2") — pass through.
  if (r.includes('freq=')) return rule
  return null
}

// ── Route handler ───────────────────────────────────────────────────────────

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token: rawToken } = await params
  // Strip a trailing `.ics` if a subscriber appended one (some clients require
  // the extension when typing the URL).
  const token = rawToken.replace(/\.ics$/i, '').trim()
  if (!token || token.length < 16) {
    return new NextResponse('Token inválido', { status: 400 })
  }

  const supabase = createAdminClient() as ReturnType<typeof createAdminClient> & {
    from: (table: string) => any
  }

  // Resolve token → consultant
  const { data: profile, error: profileError } = await supabase
    .from('dev_consultant_profiles')
    .select('user_id')
    .eq('calendar_feed_token', token)
    .maybeSingle()

  if (profileError || !profile?.user_id) {
    return new NextResponse('Calendário não encontrado', { status: 404 })
  }

  const consultantId: string = profile.user_id

  // Lookup consultant's display name for X-WR-CALNAME
  const { data: consultantUser } = await supabase
    .from('dev_users')
    .select('commercial_name')
    .eq('id', consultantId)
    .maybeSingle()
  const consultantName: string = consultantUser?.commercial_name || 'Consultor'

  // Window: events overlapping [now-90d, now+365d]
  const now = new Date()
  const windowStart = new Date(now)
  windowStart.setDate(windowStart.getDate() - PAST_DAYS)
  const windowEnd = new Date(now)
  windowEnd.setDate(windowEnd.getDate() + FUTURE_DAYS)

  // Fetch events the consultant owns or was tagged on. Recurring events whose
  // anchor date falls before the window are included unconditionally so the
  // subscriber can expand them.
  const { data: events } = await supabase
    .from('calendar_events')
    .select(
      'id, title, description, category, start_date, end_date, all_day, is_recurring, recurrence_rule, location, created_at, updated_at',
    )
    .or(
      [
        `user_id.eq.${consultantId}`,
        `created_by.eq.${consultantId}`,
        `owner_ids.cs.{${consultantId}}`,
      ].join(','),
    )
    .or(
      [
        'is_recurring.eq.true',
        `start_date.gte.${windowStart.toISOString()}`,
      ].join(','),
    )
    .lte('start_date', windowEnd.toISOString())
    .order('start_date', { ascending: true })
    .limit(1000)

  const rows: CalendarEventRow[] = (events ?? []) as CalendarEventRow[]

  // Build ICS body
  const lines: string[] = []
  lines.push('BEGIN:VCALENDAR')
  lines.push('VERSION:2.0')
  lines.push('PRODID:-//Infinity Group//ERP Calendar Feed//PT')
  lines.push('CALSCALE:GREGORIAN')
  lines.push('METHOD:PUBLISH')
  lines.push(`X-WR-CALNAME:Infinity ERP — ${icsEscape(consultantName)}`)
  lines.push('X-WR-TIMEZONE:Europe/Lisbon')
  lines.push('X-PUBLISHED-TTL:PT1H')

  const dtstamp = fmtUtc(now)
  const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || 'https://app.infinitygroup.pt').replace(/\/$/, '')

  for (const ev of rows) {
    const start = new Date(ev.start_date)
    if (Number.isNaN(start.getTime())) continue
    const end = ev.end_date ? new Date(ev.end_date) : null

    lines.push('BEGIN:VEVENT')
    lines.push(`UID:${ev.id}@infinity-erp`)
    lines.push(`DTSTAMP:${dtstamp}`)
    lines.push(`CREATED:${fmtUtc(new Date(ev.created_at))}`)
    lines.push(`LAST-MODIFIED:${fmtUtc(new Date(ev.updated_at))}`)

    if (ev.all_day) {
      lines.push(`DTSTART;VALUE=DATE:${fmtDate(start)}`)
      // For all-day, ICS DTEND is exclusive — add a day if missing.
      const endDate = end ?? new Date(start.getTime() + 24 * 60 * 60 * 1000)
      const exclusiveEnd = end
        ? new Date(endDate.getTime() + 24 * 60 * 60 * 1000)
        : endDate
      lines.push(`DTEND;VALUE=DATE:${fmtDate(exclusiveEnd)}`)
    } else {
      lines.push(`DTSTART:${fmtUtc(start)}`)
      if (end && !Number.isNaN(end.getTime())) {
        lines.push(`DTEND:${fmtUtc(end)}`)
      } else {
        // Default 30-min duration when no end_date is set (typical for tasks).
        const fallbackEnd = new Date(start.getTime() + 30 * 60 * 1000)
        lines.push(`DTEND:${fmtUtc(fallbackEnd)}`)
      }
    }

    lines.push(foldLine(`SUMMARY:${icsEscape(ev.title || '(Sem título)')}`))
    if (ev.description) {
      lines.push(foldLine(`DESCRIPTION:${icsEscape(ev.description)}`))
    }
    if (ev.location) {
      lines.push(foldLine(`LOCATION:${icsEscape(ev.location)}`))
    }
    if (ev.category) {
      lines.push(foldLine(`CATEGORIES:${icsEscape(ev.category)}`))
    }
    lines.push(foldLine(`URL:${baseUrl}/dashboard/calendario?event=${ev.id}`))

    if (ev.is_recurring) {
      const rrule = mapRrule(ev.recurrence_rule)
      if (rrule) lines.push(`RRULE:${rrule}`)
    }

    lines.push('END:VEVENT')
  }

  lines.push('END:VCALENDAR')

  // RFC 5545: lines must be CRLF-terminated
  const body = lines.join('\r\n') + '\r\n'

  return new NextResponse(body, {
    status: 200,
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      // Suggest filename for clients that download
      'Content-Disposition': `inline; filename="infinity-${consultantId}.ics"`,
      // Google Calendar polls every few hours regardless, but a short TTL
      // keeps Apple/Outlook subscriptions reasonably fresh.
      'Cache-Control': 'public, max-age=300, s-maxage=300',
    },
  })
}
