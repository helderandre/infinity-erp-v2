import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requirePermission } from '@/lib/auth/permissions'

/**
 * Agregador de eventos relacionados com um negócio.
 *
 * Junta:
 *  • Visitas em `visits` linkadas ao lead do negócio
 *  • Eventos em `calendar_events` cujo `lead_id` é o lead do negócio OU cujo
 *    `property_id` está no dossier do negócio
 *
 * Devolve uma lista unificada com `source` ('visit' | 'calendar') ordenada por
 * data descendente. Não inclui eventos cancelados/rejeitados.
 */

interface AgendaItem {
  /** id agregado: prefixo v_/e_ para garantir unicidade na lista. */
  id: string
  source: 'visit' | 'calendar'
  /** id real na tabela de origem (sem prefixo). */
  source_id: string
  title: string
  /** ISO datetime — combina visit_date+visit_time para visitas, start_date para eventos. */
  start_at: string
  /** Duração em minutos quando disponível. */
  duration_minutes: number | null
  /** Estado, quando aplicável (visitas). */
  status: string | null
  /** Categoria do evento de calendário. */
  category: string | null
  notes: string | null
  property: { id: string; title: string | null; slug: string | null } | null
  /** URL para abrir/editar o item na origem. */
  href: string
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requirePermission('leads')
    if (!auth.authorized) return auth.response

    const { id } = await params
    const admin = createAdminClient() as any

    // 1. Negócio → lead_id
    const { data: negocio, error: negErr } = await admin
      .from('negocios')
      .select('lead_id')
      .eq('id', id)
      .single()
    if (negErr || !negocio) {
      return NextResponse.json({ error: 'Negócio não encontrado' }, { status: 404 })
    }
    const leadId = negocio.lead_id as string

    // 2. Property IDs no dossier
    const { data: dossier } = await admin
      .from('negocio_properties')
      .select('property_id')
      .eq('negocio_id', id)
      .not('property_id', 'is', null)
    const propertyIds: string[] = (dossier || [])
      .map((d: any) => d.property_id)
      .filter(Boolean)

    // 3. Visitas (linkadas ao lead — o canal canónico de visitas)
    const { data: visitsRaw } = await admin
      .from('visits')
      .select(`
        id, visit_date, visit_time, duration_minutes, status, notes,
        property_id,
        property:dev_properties!visits_property_id_fkey(id, title, slug)
      `)
      .eq('lead_id', leadId)
      .not('status', 'in', '("cancelled","rejected")')
      .order('visit_date', { ascending: false })
      .limit(200)

    // 4. Eventos de calendário (lead_id ou property_id no dossier)
    let calQuery = admin
      .from('calendar_events')
      .select(`
        id, title, description, category, item_type,
        start_date, end_date, all_day, location,
        lead_id, property_id,
        property:dev_properties!calendar_events_property_id_fkey(id, title, slug)
      `)
      .order('start_date', { ascending: false })
      .limit(200)

    if (propertyIds.length > 0) {
      // Postgres: lead_id.eq.X,property_id.in.(a,b,c)
      const propList = propertyIds.join(',')
      calQuery = calQuery.or(`lead_id.eq.${leadId},property_id.in.(${propList})`)
    } else {
      calQuery = calQuery.eq('lead_id', leadId)
    }

    const { data: eventsRaw } = await calQuery

    // 5. Mapear para shape unificada
    const items: AgendaItem[] = []

    for (const v of visitsRaw || []) {
      const date = v.visit_date as string
      const time = (v.visit_time as string | null) || '00:00:00'
      const startAt = new Date(`${date}T${time}`).toISOString()
      items.push({
        id: `v_${v.id}`,
        source: 'visit',
        source_id: v.id,
        title: v.property?.title ? `Visita · ${v.property.title}` : 'Visita',
        start_at: startAt,
        duration_minutes: v.duration_minutes ?? null,
        status: v.status ?? null,
        category: null,
        notes: v.notes ?? null,
        property: v.property
          ? { id: v.property.id, title: v.property.title, slug: v.property.slug }
          : null,
        href: `/dashboard/calendario?event=visit:${v.id}&date=${date}`,
      })
    }

    for (const e of eventsRaw || []) {
      items.push({
        id: `e_${e.id}`,
        source: 'calendar',
        source_id: e.id,
        title: e.title || 'Evento',
        start_at: e.start_date,
        duration_minutes: null,
        status: null,
        category: e.category || null,
        notes: e.description ?? null,
        property: e.property
          ? { id: e.property.id, title: e.property.title, slug: e.property.slug }
          : null,
        href: `/dashboard/calendario?event=${e.id}&date=${(e.start_date || '').slice(0, 10)}`,
      })
    }

    // 6. Sort: futuros primeiro (próximos no topo), depois passados decrescente
    const now = Date.now()
    items.sort((a, b) => {
      const ta = new Date(a.start_at).getTime()
      const tb = new Date(b.start_at).getTime()
      const aFuture = ta >= now
      const bFuture = tb >= now
      if (aFuture && !bFuture) return -1
      if (!aFuture && bFuture) return 1
      // ambos futuros → mais próximos primeiro (asc)
      // ambos passados → mais recentes primeiro (desc)
      return aFuture ? ta - tb : tb - ta
    })

    return NextResponse.json({ data: items })
  } catch (err) {
    console.error('[negocios/[id]/agenda GET]', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
