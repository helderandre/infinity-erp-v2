import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { z } from 'zod'

const rsvpSchema = z.object({
  status: z.enum(['going', 'not_going']),
  reason: z.string().max(500).optional().nullable(),
  // ISO da ocorrência específica (eventos recorrentes). Ausente/null = evento
  // não-recorrente (resposta única).
  occurrence_date: z.string().datetime().optional().nullable(),
})

// POST — Submit or update RSVP for current user
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
    }

    const body = await request.json()
    const parsed = rsvpSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Dados inválidos.' }, { status: 400 })
    }

    const admin = createAdminClient() as any

    // Check event exists and requires RSVP
    const { data: event, error: eventErr } = await admin
      .from('calendar_events')
      .select('id, requires_rsvp')
      .eq('id', id)
      .single()

    if (eventErr || !event) {
      return NextResponse.json({ error: 'Evento não encontrado.' }, { status: 404 })
    }

    if (!event.requires_rsvp) {
      return NextResponse.json({ error: 'Este evento não requer confirmação de presença.' }, { status: 400 })
    }

    const occurrenceDate = parsed.data.occurrence_date ?? null

    // Upsert manual por (event_id, user_id, occurrence_date) — o índice único é
    // funcional (COALESCE no sentinela 'epoch'), por isso o onConflict do
    // PostgREST não serve. Ver migration 20260602_calendar_rsvp_per_occurrence.sql.
    let findQuery = admin
      .from('calendar_event_rsvp')
      .select('id')
      .eq('event_id', id)
      .eq('user_id', user.id)
    findQuery = occurrenceDate === null
      ? findQuery.is('occurrence_date', null)
      : findQuery.eq('occurrence_date', occurrenceDate)
    const { data: existing } = await findQuery.maybeSingle()

    const row = {
      status: parsed.data.status,
      reason: parsed.data.status === 'not_going' ? (parsed.data.reason || null) : null,
      responded_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    const mutation = existing
      ? admin.from('calendar_event_rsvp').update(row).eq('id', existing.id)
      : admin.from('calendar_event_rsvp').insert({
          event_id: id,
          user_id: user.id,
          occurrence_date: occurrenceDate,
          ...row,
        })

    const { data, error } = await mutation.select().single()

    if (error) {
      console.error('[calendar/rsvp POST]', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data })
  } catch (err) {
    console.error('[calendar/rsvp POST]', err)
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}

// GET — Get RSVP list for an event (for managers to see attendance)
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const { searchParams } = new URL(request.url)
    const occurrenceDate = searchParams.get('occurrence_date')
    const admin = createAdminClient() as any

    let query = admin
      .from('calendar_event_rsvp')
      .select('*, user:dev_users!calendar_event_rsvp_user_id_fkey(id, commercial_name)')
      .eq('event_id', id)
    // Filtra pela ocorrência: ?occurrence_date=<iso> para recorrentes, ausente
    // (null) para o evento simples.
    query = occurrenceDate
      ? query.eq('occurrence_date', occurrenceDate)
      : query.is('occurrence_date', null)

    const { data, error } = await query.order('responded_at', { ascending: false })

    if (error) {
      console.error('[calendar/rsvp GET]', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Compute counts
    const counts = {
      going: data.filter((r: any) => r.status === 'going').length,
      not_going: data.filter((r: any) => r.status === 'not_going').length,
      pending: data.filter((r: any) => r.status === 'pending').length,
    }

    return NextResponse.json({ data, counts })
  } catch (err) {
    console.error('[calendar/rsvp GET]', err)
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}
