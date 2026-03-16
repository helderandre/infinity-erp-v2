import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { updateVisitSchema } from '@/lib/validations/visit'

const VISIT_SELECT = `
  *,
  property:dev_properties!property_id(id, title, external_ref, city, zone, address_street, slug),
  consultant:dev_users!consultant_id(id, commercial_name),
  lead:leads!lead_id(id, full_name, phone_primary, email)
`

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
    }

    const admin = createAdminClient() as any
    const { data, error } = await admin
      .from('temp_visits')
      .select(VISIT_SELECT)
      .eq('id', id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Visita não encontrada.' }, { status: 404 })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data })
  } catch (err) {
    console.error('[visits/[id] GET]', err)
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
    }

    const body = await request.json()
    const parsed = updateVisitSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Dados inválidos.', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const admin = createAdminClient() as any

    // If confirming, set confirmed_at
    const updateData: any = { ...parsed.data }
    if (parsed.data.status === 'confirmed' && !updateData.confirmed_at) {
      updateData.confirmed_at = new Date().toISOString()
    }

    const { data, error } = await admin
      .from('temp_visits')
      .update(updateData)
      .eq('id', id)
      .select(VISIT_SELECT)
      .single()

    if (error) {
      console.error('[visits/[id] PUT]', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Sync calendar event dates if date/time changed
    if ((parsed.data.visit_date || parsed.data.visit_time) && data?.calendar_event_id) {
      const visitDate = parsed.data.visit_date || data.visit_date
      const visitTime = parsed.data.visit_time || data.visit_time
      const duration = parsed.data.duration_minutes || data.duration_minutes || 30
      const startDate = `${visitDate}T${visitTime}`
      const endDate = new Date(new Date(startDate).getTime() + duration * 60000).toISOString()

      await admin
        .from('temp_calendar_events')
        .update({ start_date: startDate, end_date: endDate })
        .eq('id', data.calendar_event_id)
    }

    return NextResponse.json({ data })
  } catch (err) {
    console.error('[visits/[id] PUT]', err)
    return NextResponse.json({ error: 'Erro interno ao actualizar visita.' }, { status: 500 })
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
    }

    const admin = createAdminClient() as any

    // Get visit to check calendar event
    const { data: visit } = await admin
      .from('temp_visits')
      .select('calendar_event_id')
      .eq('id', id)
      .single()

    // Delete calendar event if exists
    if (visit?.calendar_event_id) {
      await admin
        .from('temp_calendar_events')
        .delete()
        .eq('id', visit.calendar_event_id)
    }

    const { error } = await admin
      .from('temp_visits')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('[visits/[id] DELETE]', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[visits/[id] DELETE]', err)
    return NextResponse.json({ error: 'Erro interno ao eliminar visita.' }, { status: 500 })
  }
}
