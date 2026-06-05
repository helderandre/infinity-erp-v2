import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAuth } from '@/lib/auth/permissions'

/**
 * GET /api/tasks/marketing-moments-due
 *
 * Surfaces deal_events scheduled for today (or in the recent past) that
 * still don't have a corresponding `deal_marketing_moments` row — i.e.,
 * tasks for the consultor to take photos + write a caption.
 *
 * Filter:
 *   - deal_events.scheduled_at::date BETWEEN (today - 30) AND (today + 1)
 *   - status NOT IN ('cancelled', 'no_show')
 *   - NO `deal_marketing_moments` exists for the same (deal_id, moment_type)
 *   - deals.consultant_id = auth.user.id (admins/brokers see all via
 *     `?all=true` if they have the `pipeline` permission)
 *
 * Returns array of items shaped for UI rendering — each has the deal
 * context needed to open the marketing card directly.
 */
export async function GET(request: Request) {
  try {
    const auth = await requireAuth()
    if (!auth.authorized) return auth.response

    const url = new URL(request.url)
    const showAll = url.searchParams.get('all') === 'true'
    const canSeeAll = auth.permissions.pipeline === true || auth.permissions.users === true

    const admin = createAdminClient()
    const adminDb = admin as unknown as { from: (t: string) => ReturnType<typeof admin.from> }

    // Fetch upcoming/recent deal_events. We filter by consultant in TS
    // after the JOIN to keep the query simple.
    const today = new Date()
    const minDate = new Date(today)
    minDate.setDate(minDate.getDate() - 30)
    const maxDate = new Date(today)
    maxDate.setDate(maxDate.getDate() + 1)

    const { data: events, error: eventsErr } = await adminDb
      .from('deal_events')
      .select(`
        id, event_type, scheduled_at, occurred_at, status, deal_id,
        deal:deals!deal_events_deal_id_fkey(
          id, reference, business_type, consultant_id,
          property:dev_properties!deals_property_id_fkey(
            id, address_street, city, slug
          ),
          negocio:negocios!deals_negocio_id_fkey(
            id, lead:leads!negocios_lead_id_fkey(id, nome)
          )
        )
      `)
      .gte('scheduled_at', minDate.toISOString())
      .lte('scheduled_at', maxDate.toISOString())
      .not('status', 'in', '("cancelled","no_show")')
      .order('scheduled_at', { ascending: true })

    if (eventsErr) {
      return NextResponse.json({ error: eventsErr.message }, { status: 500 })
    }

    type EventRow = {
      id: string
      event_type: string
      scheduled_at: string
      occurred_at: string | null
      status: string
      deal_id: string
      deal?: {
        id: string
        reference: string | null
        business_type: string | null
        consultant_id: string | null
        property?: { id: string; address_street: string | null; city: string | null; slug: string | null } | null
        negocio?: { id: string; lead?: { id: string; nome: string | null } | null } | null
      } | null
    }

    const rows = (events ?? []) as EventRow[]

    // Filter by consultant ownership unless admin asked for "all"
    const scoped = (showAll && canSeeAll)
      ? rows
      : rows.filter((r) => r.deal?.consultant_id === auth.user.id)

    if (scoped.length === 0) {
      return NextResponse.json({ data: [] })
    }

    // Lookup which (deal_id, moment_type) pairs already have a marketing moment
    const dealIds = Array.from(new Set(scoped.map((r) => r.deal_id)))
    const { data: existingMoments } = await adminDb
      .from('deal_marketing_moments')
      .select('deal_id, moment_type')
      .in('deal_id', dealIds)

    const existingSet = new Set(
      (existingMoments ?? []).map(
        (m: { deal_id: string; moment_type: string }) => `${m.deal_id}::${m.moment_type}`,
      ),
    )

    // event_type → moment_type (1:1 mapping for now)
    const eventTypeToMomentType = (eventType: string): string => eventType

    const items = scoped
      .map((r) => {
        const momentType = eventTypeToMomentType(r.event_type)
        // Only marketing-relevant event types
        if (!['cpcv', 'escritura', 'contrato_arrendamento', 'entrega_chaves'].includes(momentType)) {
          return null
        }
        if (existingSet.has(`${r.deal_id}::${momentType}`)) return null

        return {
          event_id: r.id,
          event_type: r.event_type,
          scheduled_at: r.scheduled_at,
          occurred_at: r.occurred_at,
          status: r.status,
          deal_id: r.deal_id,
          deal_reference: r.deal?.reference ?? null,
          business_type: r.deal?.business_type ?? null,
          property_address: r.deal?.property
            ? [r.deal.property.address_street, r.deal.property.city].filter(Boolean).join(', ') || null
            : null,
          property_slug: r.deal?.property?.slug ?? null,
          negocio_id: r.deal?.negocio?.id ?? null,
          lead_id: r.deal?.negocio?.lead?.id ?? null,
          lead_name: r.deal?.negocio?.lead?.nome ?? null,
        }
      })
      .filter((x) => x !== null)

    return NextResponse.json({ data: items })
  } catch (err) {
    console.error('[marketing-moments-due]', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
