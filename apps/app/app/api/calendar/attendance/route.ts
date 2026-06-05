import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

// GET — Attendance analytics across all RSVP events
// Query params: ?from=ISO&to=ISO&agent_id=UUID
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const from = searchParams.get('from')
    const to = searchParams.get('to')
    const agentId = searchParams.get('agent_id')

    const admin = createAdminClient() as any

    // Get all events that require RSVP in the period
    let eventsQuery = admin
      .from('calendar_events')
      .select('id, title, category, start_date, requires_rsvp')
      .eq('requires_rsvp', true)

    if (from) eventsQuery = eventsQuery.gte('start_date', from)
    if (to) eventsQuery = eventsQuery.lte('start_date', to)

    const { data: events, error: evError } = await eventsQuery.order('start_date', { ascending: false })

    if (evError) {
      return NextResponse.json({ error: evError.message }, { status: 500 })
    }

    if (!events || events.length === 0) {
      return NextResponse.json({ events: [], agents: [], summary: { total_events: 0 } })
    }

    const eventIds = events.map((e: any) => e.id)

    // Get all RSVPs for these events
    let rsvpQuery = admin
      .from('calendar_event_rsvp')
      .select('*, user:dev_users!calendar_event_rsvp_user_id_fkey(id, commercial_name)')
      .in('event_id', eventIds)

    if (agentId) rsvpQuery = rsvpQuery.eq('user_id', agentId)

    const { data: rsvps, error: rsvpError } = await rsvpQuery

    if (rsvpError) {
      return NextResponse.json({ error: rsvpError.message }, { status: 500 })
    }

    // Build per-agent stats
    const agentMap = new Map<string, {
      id: string
      name: string
      total_events: number
      going: number
      not_going: number
      pending: number
      reasons: string[]
    }>()

    // Build event lookup for titles/dates
    const eventMap = new Map<string, { title: string; start_date: string }>()
    for (const ev of (events ?? [])) {
      eventMap.set(ev.id, { title: ev.title, start_date: ev.start_date })
    }

    for (const rsvp of (rsvps ?? [])) {
      const user = rsvp.user as { id: string; commercial_name: string } | null
      if (!user) continue

      if (!agentMap.has(user.id)) {
        agentMap.set(user.id, {
          id: user.id,
          name: user.commercial_name ?? 'Sem nome',
          total_events: 0,
          going: 0,
          not_going: 0,
          pending: 0,
          reasons: [],
          absences: [],
        })
      }

      const agent = agentMap.get(user.id)!
      agent.total_events++
      if (rsvp.status === 'going') agent.going++
      else if (rsvp.status === 'not_going') {
        agent.not_going++
        if (rsvp.reason) agent.reasons.push(rsvp.reason)
        const ev = eventMap.get(rsvp.event_id)
        agent.absences.push({
          event_id: rsvp.event_id,
          event_title: ev?.title ?? 'Evento',
          event_date: ev?.start_date ?? '',
          reason: rsvp.reason ?? null,
        })
      }
      else agent.pending++
    }

    const agents = Array.from(agentMap.values())
      .map((a) => ({
        ...a,
        attendance_rate: a.total_events > 0
          ? Math.round((a.going / a.total_events) * 100)
          : null,
      }))
      .sort((a, b) => (b.attendance_rate ?? 0) - (a.attendance_rate ?? 0))

    // Per-event breakdown
    const eventBreakdown = events.map((ev: any) => {
      const evRsvps = (rsvps ?? []).filter((r: any) => r.event_id === ev.id)
      return {
        id: ev.id,
        title: ev.title,
        category: ev.category,
        start_date: ev.start_date,
        going: evRsvps.filter((r: any) => r.status === 'going').length,
        not_going: evRsvps.filter((r: any) => r.status === 'not_going').length,
        pending: evRsvps.filter((r: any) => r.status === 'pending').length,
        total: evRsvps.length,
      }
    })

    return NextResponse.json({
      events: eventBreakdown,
      agents,
      summary: {
        total_events: events.length,
        total_agents: agents.length,
        avg_attendance: agents.length > 0
          ? Math.round(agents.reduce((s, a) => s + (a.attendance_rate ?? 0), 0) / agents.length)
          : null,
      },
    })
  } catch (err) {
    console.error('[calendar/attendance GET]', err)
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}
