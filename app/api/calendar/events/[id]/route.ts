import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { calendarEventSchema } from '@/lib/validations/calendar'

// ---------------------------------------------------------------------------
// GET — Fetch a single manual calendar event
// ---------------------------------------------------------------------------
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params

    if (!id) {
      return NextResponse.json({ error: 'ID é obrigatório.' }, { status: 400 })
    }

    const admin = createAdminClient() as any // temp tables not in generated types

    const { data, error } = await admin
      .from('temp_calendar_events')
      .select('*, creator:dev_users!temp_calendar_events_created_by_fkey(id, commercial_name), linked_user:dev_users!temp_calendar_events_user_id_fkey(id, commercial_name)')
      .eq('id', id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Evento não encontrado.' }, { status: 404 })
      }
      console.error('[calendar/events/[id] GET]', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data })
  } catch (err) {
    console.error('[calendar/events/[id] GET]', err)
    return NextResponse.json(
      { error: 'Erro interno ao carregar evento.' },
      { status: 500 },
    )
  }
}

// ---------------------------------------------------------------------------
// PUT — Update a manual calendar event
// ---------------------------------------------------------------------------
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params

    if (!id) {
      return NextResponse.json({ error: 'ID é obrigatório.' }, { status: 400 })
    }

    const body = await request.json()
    const parsed = calendarEventSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Dados inválidos.', details: parsed.error.flatten().fieldErrors },
        { status: 400 },
      )
    }

    const admin = createAdminClient() as any // temp tables not in generated types

    // Check event exists
    const { data: existing, error: findError } = await admin
      .from('temp_calendar_events')
      .select('id')
      .eq('id', id)
      .single()

    if (findError || !existing) {
      return NextResponse.json({ error: 'Evento não encontrado.' }, { status: 404 })
    }

    const { data, error } = await admin
      .from('temp_calendar_events')
      .update({
        ...parsed.data,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('[calendar/events/[id] PUT]', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data })
  } catch (err) {
    console.error('[calendar/events/[id] PUT]', err)
    return NextResponse.json(
      { error: 'Erro interno ao actualizar evento.' },
      { status: 500 },
    )
  }
}

// ---------------------------------------------------------------------------
// DELETE — Remove a manual calendar event
// ---------------------------------------------------------------------------
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params

    if (!id) {
      return NextResponse.json({ error: 'ID é obrigatório.' }, { status: 400 })
    }

    const admin = createAdminClient() as any // temp tables not in generated types

    // Check event exists
    const { data: existing, error: findError } = await admin
      .from('temp_calendar_events')
      .select('id')
      .eq('id', id)
      .single()

    if (findError || !existing) {
      return NextResponse.json({ error: 'Evento não encontrado.' }, { status: 404 })
    }

    const { error } = await admin
      .from('temp_calendar_events')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('[calendar/events/[id] DELETE]', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[calendar/events/[id] DELETE]', err)
    return NextResponse.json(
      { error: 'Erro interno ao eliminar evento.' },
      { status: 500 },
    )
  }
}
