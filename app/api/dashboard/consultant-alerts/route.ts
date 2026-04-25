import { NextResponse } from 'next/server'
import { createCrmAdminClient } from '@/lib/supabase/admin-untyped'
import { requireRoles } from '@/lib/auth/permissions'

export const dynamic = 'force-dynamic'

const CONSULTANT_ROLES = ['Consultor', 'Consultora Executiva', 'Team Leader']

type Severity = 'ok' | 'warning' | 'danger'

type AlertMetric = {
  severity: Severity
  last_at: string | null
  days_since: number | null
}

type ExportEvent = {
  id: string
  created_at: string
  export_type: string
  row_count: number | null
}

type ConsultantAlertRow = {
  consultant_id: string
  commercial_name: string
  profile_photo_url: string | null
  red_count: number
  yellow_count: number
  acquisitions: AlertMetric
  calls: AlertMetric
  leads: AlertMetric
  logins: AlertMetric & { count_this_month: number }
  exports: {
    severity: Severity
    unacknowledged_count: number
    last_event: ExportEvent | null
  }
  login_chart: { date: string; count: number }[]
  unacknowledged_exports: ExportEvent[]
}

// Thresholds (days)
const THRESHOLDS = {
  acquisitions: { warn: 7, danger: 14 },
  calls: { warn: 3, danger: 6 },
  leads: { warn: 5, danger: 10 },
  logins: { warn: 3, danger: 6 },
} as const

function classify(daysSince: number | null, kind: keyof typeof THRESHOLDS): Severity {
  if (daysSince == null) return 'danger' // never happened
  const t = THRESHOLDS[kind]
  if (daysSince >= t.danger) return 'danger'
  if (daysSince >= t.warn) return 'warning'
  return 'ok'
}

function daysBetween(dateIso: string | null | undefined, now: Date): number | null {
  if (!dateIso) return null
  const ms = now.getTime() - new Date(dateIso).getTime()
  return Math.max(0, Math.floor(ms / (1000 * 60 * 60 * 24)))
}

function dateKey(d: Date): string {
  return d.toISOString().slice(0, 10)
}

export async function GET() {
  const auth = await requireRoles(['Broker/CEO', 'admin'])
  if (!auth.authorized) return auth.response

  const db = createCrmAdminClient()
  const now = new Date()
  const thirtyDaysAgo = new Date(now)
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

  // 1. Active consultants (filtered by role)
  const { data: consultantRows, error: consultantsErr } = await db
    .from('dev_users')
    .select(`
      id,
      commercial_name,
      is_active,
      dev_consultant_profiles!user_id(profile_photo_url),
      user_roles!user_roles_user_id_fkey!inner(role:roles!inner(name))
    `)
    .eq('is_active', true)
    .order('commercial_name', { ascending: true })

  if (consultantsErr) {
    return NextResponse.json({ error: consultantsErr.message }, { status: 500 })
  }

  const consultants = (consultantRows ?? []).filter((u: Record<string, unknown>) => {
    const roles = ((u as Record<string, unknown>).user_roles as Array<{ role?: { name?: string } }> | undefined) ?? []
    return roles.some((ur) => ur.role?.name && CONSULTANT_ROLES.includes(ur.role.name))
  })

  const consultantIds = consultants.map((c) => (c as { id: string }).id)

  if (consultantIds.length === 0) {
    return NextResponse.json({ consultants: [] })
  }

  // 2. Latest acquisition per consultant (dev_properties)
  const { data: propRows } = await db
    .from('dev_properties')
    .select('consultant_id, created_at')
    .in('consultant_id', consultantIds)
    .order('created_at', { ascending: false })

  const lastAcquisitionBy = new Map<string, string>()
  for (const row of (propRows as Array<{ consultant_id: string; created_at: string }> | null) ?? []) {
    if (!lastAcquisitionBy.has(row.consultant_id)) lastAcquisitionBy.set(row.consultant_id, row.created_at)
  }

  // 3. Latest lead per consultant (leads.agent_id)
  const { data: leadRows } = await db
    .from('leads')
    .select('agent_id, created_at')
    .in('agent_id', consultantIds)
    .order('created_at', { ascending: false })

  const lastLeadBy = new Map<string, string>()
  for (const row of (leadRows as Array<{ agent_id: string; created_at: string }> | null) ?? []) {
    if (!lastLeadBy.has(row.agent_id)) lastLeadBy.set(row.agent_id, row.created_at)
  }

  // 4. Latest call per consultant (leads_activities.activity_type='call')
  const { data: callRows } = await db
    .from('leads_activities')
    .select('created_by, created_at')
    .eq('activity_type', 'call')
    .in('created_by', consultantIds)
    .order('created_at', { ascending: false })

  const lastCallBy = new Map<string, string>()
  for (const row of (callRows as Array<{ created_by: string; created_at: string }> | null) ?? []) {
    if (!lastCallBy.has(row.created_by)) lastCallBy.set(row.created_by, row.created_at)
  }

  // 5. Logins (last 30d for chart + aggregates)
  const { data: loginRows } = await db
    .from('dev_user_logins')
    .select('user_id, logged_in_at')
    .in('user_id', consultantIds)
    .gte('logged_in_at', thirtyDaysAgo.toISOString())
    .order('logged_in_at', { ascending: false })

  const loginsByUser = new Map<string, string[]>()
  for (const row of (loginRows as Array<{ user_id: string; logged_in_at: string }> | null) ?? []) {
    if (!loginsByUser.has(row.user_id)) loginsByUser.set(row.user_id, [])
    loginsByUser.get(row.user_id)!.push(row.logged_in_at)
  }

  // 6. Unacknowledged export events
  const { data: exportRows } = await db
    .from('consultant_export_events')
    .select('id, user_id, export_type, row_count, created_at, acknowledged_at')
    .in('user_id', consultantIds)
    .is('acknowledged_at', null)
    .order('created_at', { ascending: false })

  const unackExportsBy = new Map<string, ExportEvent[]>()
  for (const row of (exportRows as Array<{ id: string; user_id: string; export_type: string; row_count: number | null; created_at: string }> | null) ?? []) {
    if (!unackExportsBy.has(row.user_id)) unackExportsBy.set(row.user_id, [])
    unackExportsBy.get(row.user_id)!.push({
      id: row.id,
      created_at: row.created_at,
      export_type: row.export_type,
      row_count: row.row_count,
    })
  }

  // 7. Compose per-consultant results
  const results: ConsultantAlertRow[] = consultants.map((c) => {
    const userId = (c as { id: string }).id
    const commercialName = (c as { commercial_name: string }).commercial_name
    const profiles = (c as { dev_consultant_profiles?: Array<{ profile_photo_url: string | null }> }).dev_consultant_profiles
    const profilePhotoUrl = profiles?.[0]?.profile_photo_url ?? null

    const lastAcq = lastAcquisitionBy.get(userId) ?? null
    const acqDays = daysBetween(lastAcq, now)
    const acqSev = classify(acqDays, 'acquisitions')

    const lastLead = lastLeadBy.get(userId) ?? null
    const leadDays = daysBetween(lastLead, now)
    const leadSev = classify(leadDays, 'leads')

    const lastCall = lastCallBy.get(userId) ?? null
    const callDays = daysBetween(lastCall, now)
    const callSev = classify(callDays, 'calls')

    const userLogins = loginsByUser.get(userId) ?? []
    const lastLogin = userLogins[0] ?? null
    const loginDays = daysBetween(lastLogin, now)
    const loginSev = classify(loginDays, 'logins')
    const loginsThisMonth = userLogins.filter((t) => new Date(t) >= monthStart).length

    // Build last-30-days chart (buckets per day)
    const bucket = new Map<string, number>()
    for (let i = 0; i < 30; i++) {
      const d = new Date(now)
      d.setDate(d.getDate() - i)
      bucket.set(dateKey(d), 0)
    }
    for (const iso of userLogins) {
      const k = dateKey(new Date(iso))
      if (bucket.has(k)) bucket.set(k, (bucket.get(k) ?? 0) + 1)
    }
    const loginChart = Array.from(bucket.entries())
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date))

    const unackExports = unackExportsBy.get(userId) ?? []
    const exportSev: Severity = unackExports.length > 0 ? 'danger' : 'ok'

    const severities: Severity[] = [acqSev, leadSev, callSev, loginSev, exportSev]
    const redCount = severities.filter((s) => s === 'danger').length
    const yellowCount = severities.filter((s) => s === 'warning').length

    return {
      consultant_id: userId,
      commercial_name: commercialName,
      profile_photo_url: profilePhotoUrl,
      red_count: redCount,
      yellow_count: yellowCount,
      acquisitions: { severity: acqSev, last_at: lastAcq, days_since: acqDays },
      calls: { severity: callSev, last_at: lastCall, days_since: callDays },
      leads: { severity: leadSev, last_at: lastLead, days_since: leadDays },
      logins: {
        severity: loginSev,
        last_at: lastLogin,
        days_since: loginDays,
        count_this_month: loginsThisMonth,
      },
      exports: {
        severity: exportSev,
        unacknowledged_count: unackExports.length,
        last_event: unackExports[0] ?? null,
      },
      login_chart: loginChart,
      unacknowledged_exports: unackExports,
    }
  })

  results.sort((a, b) => {
    if (b.red_count !== a.red_count) return b.red_count - a.red_count
    if (b.yellow_count !== a.yellow_count) return b.yellow_count - a.yellow_count
    return a.commercial_name.localeCompare(b.commercial_name, 'pt-PT')
  })

  return NextResponse.json({
    consultants: results,
    thresholds: THRESHOLDS,
  }, {
    headers: { 'Cache-Control': 'private, max-age=30' },
  })
}
