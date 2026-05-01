// @ts-nocheck
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

/**
 * Calendar items linked to this contact (lead). Pulls from two sources:
 *   - `visits` (visit_date, status, property, consultant)
 *   - `calendar_events` (start_date/end_date, category, location)
 *
 * Both feeds are normalized into a single shape so the UI can render them
 * with one component. Returned ordered by date DESC by default; use
 * `?upcoming=true` to filter to today onwards and order ASC.
 */

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { searchParams } = new URL(request.url)
    const upcoming = searchParams.get('upcoming') === 'true'

    const supabase = await createClient()

    // 1. Visits where this lead is the client
    const { data: visits } = await supabase
      .from('visits')
      .select(`
        id, visit_date, visit_time, duration_minutes, status,
        notes, client_name, client_phone, client_email,
        cancelled_at, cancelled_reason,
        property:dev_properties(id, title, slug, city, address_street),
        negocio_id,
        consultant:dev_users!visits_consultant_id_fkey(id, commercial_name)
      `)
      .eq('lead_id', id)
      .order('visit_date', { ascending: false })
      .limit(100)

    // 2. Manual calendar events that mention this lead
    const { data: calEvents } = await supabase
      .from('calendar_events')
      .select(`
        id, title, description, start_date, end_date, all_day,
        category, color, location, item_type, process_id, property_id,
        creator:dev_users!calendar_events_created_by_fkey(id, commercial_name)
      `)
      .eq('lead_id', id)
      .order('start_date', { ascending: false })
      .limit(100)

    // Normalise both feeds
    const fromVisits = (visits || []).map((v) => {
      const dateStr = v.visit_time
        ? `${v.visit_date}T${v.visit_time}`
        : `${v.visit_date}T09:00:00`
      return {
        id: `visit-${v.id}`,
        kind: 'visit' as const,
        title: v.property?.title
          ? `Visita — ${v.property.title}`
          : 'Visita',
        description: v.notes ?? null,
        start_date: dateStr,
        end_date: null,
        duration_minutes: v.duration_minutes ?? 60,
        status: v.status,
        location: v.property
          ? [v.property.address_street, v.property.city].filter(Boolean).join(', ')
          : null,
        category: 'visit',
        color: null,
        author: v.consultant?.commercial_name ?? null,
        property: v.property ? { id: v.property.id, title: v.property.title, slug: v.property.slug } : null,
        cancelled_at: v.cancelled_at,
        cancelled_reason: v.cancelled_reason,
        raw_id: v.id,
      }
    })

    const fromCal = (calEvents || []).map((e) => ({
      id: `event-${e.id}`,
      kind: 'event' as const,
      title: e.title,
      description: e.description,
      start_date: e.start_date,
      end_date: e.end_date,
      duration_minutes: null,
      status: 'scheduled',
      location: e.location,
      category: e.category,
      color: e.color,
      author: e.creator?.commercial_name ?? null,
      property: null,
      cancelled_at: null,
      cancelled_reason: null,
      raw_id: e.id,
    }))

    let all = [...fromVisits, ...fromCal]

    if (upcoming) {
      const cutoff = new Date()
      cutoff.setHours(0, 0, 0, 0)
      all = all
        .filter((it) => new Date(it.start_date) >= cutoff && it.status !== 'cancelled')
        .sort((a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime())
    } else {
      all = all.sort(
        (a, b) => new Date(b.start_date).getTime() - new Date(a.start_date).getTime(),
      )
    }

    return NextResponse.json({ data: all })
  } catch (err) {
    console.error('Erro ao listar calendário do contacto:', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
