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

  const windowStartISO = windowStart.toISOString()
  const windowEndISO = windowEnd.toISOString()
  const startDateOnly = windowStartISO.slice(0, 10)
  const endDateOnly = windowEndISO.slice(0, 10)

  // Fetch events the consultant owns or was tagged on. Recurring events whose
  // anchor date falls before the window are included unconditionally so the
  // subscriber can expand them.
  const [
    manualRes,
    visitsRes,
    procTasksRes,
    procSubtasksRes,
    leadExpiryRes,
    contractExpiryRes,
  ] = await Promise.all([
    // Manual events
    supabase
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
          `start_date.gte.${windowStartISO}`,
        ].join(','),
      )
      .lte('start_date', windowEndISO)
      .order('start_date', { ascending: true })
      .limit(1000),

    // Visits where consultor is buyer or seller agent
    supabase
      .from('visits')
      .select(
        'id, visit_date, visit_time, duration_minutes, status, notes, client_name, lead:leads(nome), property:dev_properties(title), created_at',
      )
      .or(`consultant_id.eq.${consultantId},seller_consultant_id.eq.${consultantId}`)
      .not('status', 'in', '("rejected","cancelled")')
      .gte('visit_date', startDateOnly)
      .lte('visit_date', endDateOnly)
      .limit(500),

    // Proc tasks assigned to consultor, in active processes
    supabase
      .from('proc_tasks')
      .select(
        'id, title, due_date, status, stage_name, created_at, proc_instances!inner(external_ref, current_status, deleted_at, dev_properties(title))',
      )
      .eq('assigned_to', consultantId)
      .not('status', 'in', '("completed","skipped")')
      .not('due_date', 'is', null)
      .is('proc_instances.deleted_at', null)
      .in('proc_instances.current_status', ['active', 'on_hold'])
      .gte('due_date', windowStartISO)
      .lte('due_date', windowEndISO)
      .limit(500),

    // Proc subtasks
    supabase
      .from('proc_subtasks')
      .select(
        'id, title, due_date, is_completed, created_at, proc_tasks!inner(stage_name, title, proc_instances!inner(external_ref, current_status, deleted_at, dev_properties(title))), owners(name)',
      )
      .eq('assigned_to', consultantId)
      .eq('is_completed', false)
      .not('due_date', 'is', null)
      .is('proc_tasks.proc_instances.deleted_at', null)
      .in('proc_tasks.proc_instances.current_status', ['active', 'on_hold'])
      .gte('due_date', windowStartISO)
      .lte('due_date', windowEndISO)
      .limit(500),

    // Lead expiry — leads assigned to consultor
    supabase
      .from('leads')
      .select('id, nome, expires_at')
      .eq('agent_id', consultantId)
      .not('expires_at', 'is', null)
      .gte('expires_at', windowStartISO)
      .lte('expires_at', windowEndISO)
      .limit(500),

    // Contract expiry — properties where consultor is responsible
    supabase
      .from('dev_property_internal')
      .select(
        'property_id, contract_expiry, dev_properties!inner(id, title, consultant_id)',
      )
      .not('contract_expiry', 'is', null)
      .gte('contract_expiry', windowStartISO)
      .lte('contract_expiry', windowEndISO)
      .eq('dev_properties.consultant_id', consultantId)
      .limit(500),
  ])

  const rows: CalendarEventRow[] = (manualRes.data ?? []) as CalendarEventRow[]

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

  // ── Auto events ────────────────────────────────────────────────────────────
  // Stable UIDs prefixed by source so they don't clash with calendar_events.

  // Visits
  for (const v of (visitsRes.data ?? []) as any[]) {
    const date = String(v.visit_date)
    const time = String(v.visit_time ?? '00:00:00')
    const startLocal = new Date(`${date}T${time}`)
    if (Number.isNaN(startLocal.getTime())) continue
    const dur = Number(v.duration_minutes) || 30
    const endLocal = new Date(startLocal.getTime() + dur * 60 * 1000)
    const title = `Visita: ${v.property?.title ?? 'Imóvel'} — ${v.lead?.nome ?? v.client_name ?? 'Cliente'}`
    const prefix = v.status === 'proposal' ? '[Proposta] ' : ''

    lines.push('BEGIN:VEVENT')
    lines.push(`UID:visit-${v.id}@infinity-erp`)
    lines.push(`DTSTAMP:${dtstamp}`)
    if (v.created_at) lines.push(`CREATED:${fmtUtc(new Date(v.created_at))}`)
    lines.push(`DTSTART:${fmtUtc(startLocal)}`)
    lines.push(`DTEND:${fmtUtc(endLocal)}`)
    lines.push(foldLine(`SUMMARY:${icsEscape(prefix + title)}`))
    if (v.notes) lines.push(foldLine(`DESCRIPTION:${icsEscape(v.notes)}`))
    lines.push(foldLine('CATEGORIES:visit'))
    lines.push(foldLine(`URL:${baseUrl}/dashboard/calendario?event=visit:${v.id}`))
    lines.push('END:VEVENT')
  }

  // Proc tasks (all-day on due_date)
  for (const t of (procTasksRes.data ?? []) as any[]) {
    if (!t.due_date) continue
    const due = new Date(t.due_date)
    if (Number.isNaN(due.getTime())) continue
    const proc = t.proc_instances
    const property = proc?.dev_properties
    const desc = `${proc?.external_ref ?? ''}${t.stage_name ? ` · ${t.stage_name}` : ''}${property?.title ? ` · ${property.title}` : ''}`

    lines.push('BEGIN:VEVENT')
    lines.push(`UID:proc-task-${t.id}@infinity-erp`)
    lines.push(`DTSTAMP:${dtstamp}`)
    if (t.created_at) lines.push(`CREATED:${fmtUtc(new Date(t.created_at))}`)
    lines.push(`DTSTART;VALUE=DATE:${fmtDate(due)}`)
    lines.push(`DTEND;VALUE=DATE:${fmtDate(new Date(due.getTime() + 24 * 60 * 60 * 1000))}`)
    lines.push(foldLine(`SUMMARY:${icsEscape(t.title || '(Tarefa)')}`))
    if (desc.trim()) lines.push(foldLine(`DESCRIPTION:${icsEscape(desc.trim())}`))
    lines.push(foldLine('CATEGORIES:process_task'))
    lines.push('END:VEVENT')
  }

  // Proc subtasks (all-day)
  for (const s of (procSubtasksRes.data ?? []) as any[]) {
    if (!s.due_date) continue
    const due = new Date(s.due_date)
    if (Number.isNaN(due.getTime())) continue
    const parent = s.proc_tasks
    const proc = parent?.proc_instances
    const property = proc?.dev_properties
    const ownerSuffix = s.owners?.name ? ` (${s.owners.name})` : ''
    const desc = `${proc?.external_ref ?? ''}${parent?.stage_name ? ` · ${parent.stage_name}` : ''}${parent?.title ? ` · ${parent.title}` : ''}${property?.title ? ` · ${property.title}` : ''}`

    lines.push('BEGIN:VEVENT')
    lines.push(`UID:proc-subtask-${s.id}@infinity-erp`)
    lines.push(`DTSTAMP:${dtstamp}`)
    if (s.created_at) lines.push(`CREATED:${fmtUtc(new Date(s.created_at))}`)
    lines.push(`DTSTART;VALUE=DATE:${fmtDate(due)}`)
    lines.push(`DTEND;VALUE=DATE:${fmtDate(new Date(due.getTime() + 24 * 60 * 60 * 1000))}`)
    lines.push(foldLine(`SUMMARY:${icsEscape((s.title || '(Subtarefa)') + ownerSuffix)}`))
    if (desc.trim()) lines.push(foldLine(`DESCRIPTION:${icsEscape(desc.trim())}`))
    lines.push(foldLine('CATEGORIES:process_subtask'))
    lines.push('END:VEVENT')
  }

  // Lead expiry (all-day)
  for (const l of (leadExpiryRes.data ?? []) as any[]) {
    const expDate = new Date(l.expires_at)
    if (Number.isNaN(expDate.getTime())) continue
    lines.push('BEGIN:VEVENT')
    lines.push(`UID:lead-exp-${l.id}@infinity-erp`)
    lines.push(`DTSTAMP:${dtstamp}`)
    lines.push(`DTSTART;VALUE=DATE:${fmtDate(expDate)}`)
    lines.push(`DTEND;VALUE=DATE:${fmtDate(new Date(expDate.getTime() + 24 * 60 * 60 * 1000))}`)
    lines.push(foldLine(`SUMMARY:${icsEscape(`Lead expira: ${l.nome ?? ''}`.trim())}`))
    lines.push(foldLine('CATEGORIES:lead_expiry'))
    lines.push('END:VEVENT')
  }

  // Contract expiry (all-day)
  for (const c of (contractExpiryRes.data ?? []) as any[]) {
    if (!c.contract_expiry) continue
    const expDate = new Date(c.contract_expiry)
    if (Number.isNaN(expDate.getTime())) continue
    const property = c.dev_properties
    lines.push('BEGIN:VEVENT')
    lines.push(`UID:contract-exp-${c.property_id}@infinity-erp`)
    lines.push(`DTSTAMP:${dtstamp}`)
    lines.push(`DTSTART;VALUE=DATE:${fmtDate(expDate)}`)
    lines.push(`DTEND;VALUE=DATE:${fmtDate(new Date(expDate.getTime() + 24 * 60 * 60 * 1000))}`)
    lines.push(foldLine(`SUMMARY:${icsEscape(`Contrato expira: ${property?.title ?? c.property_id}`)}`))
    lines.push(foldLine('CATEGORIES:contract_expiry'))
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
