import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { createVisitSchema } from '@/lib/validations/visit'

const VISIT_SELECT = `
  *,
  property:dev_properties!property_id(id, title, external_ref, city, zone, address_street, slug),
  consultant:dev_users!consultant_id(id, commercial_name),
  lead:leads!lead_id(id, full_name, telemovel, email)
`

export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const consultant_id = searchParams.get('consultant_id')
    const property_id = searchParams.get('property_id')
    const lead_id = searchParams.get('lead_id')
    const date_from = searchParams.get('date_from')
    const date_to = searchParams.get('date_to')
    const search = searchParams.get('search')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const upcoming = searchParams.get('upcoming')

    const admin = createAdminClient() as any
    let query = admin.from('visits').select(VISIT_SELECT, { count: 'exact' })

    if (status) query = query.eq('status', status)
    if (consultant_id) query = query.eq('consultant_id', consultant_id)
    if (property_id) query = query.eq('property_id', property_id)
    if (lead_id) query = query.eq('lead_id', lead_id)
    if (date_from) query = query.gte('visit_date', date_from)
    if (date_to) query = query.lte('visit_date', date_to)

    if (upcoming === 'true') {
      const today = new Date().toISOString().split('T')[0]
      query = query
        .gte('visit_date', today)
        .in('status', ['scheduled', 'confirmed'])
        .order('visit_date', { ascending: true })
        .order('visit_time', { ascending: true })
    } else {
      query = query
        .order('visit_date', { ascending: false })
        .order('visit_time', { ascending: false })
    }

    if (search) {
      query = query.or(
        `client_name.ilike.%${search}%,notes.ilike.%${search}%`
      )
    }

    const offset = (page - 1) * limit
    query = query.range(offset, offset + limit - 1)

    const { data, error, count } = await query

    if (error) {
      console.error('[visits GET]', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      data: data || [],
      total: count || 0,
      page,
      limit,
      totalPages: Math.ceil((count || 0) / limit),
    })
  } catch (err) {
    console.error('[visits GET]', err)
    return NextResponse.json({ error: 'Erro interno ao carregar visitas.' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
    }

    const body = await request.json()
    const parsed = createVisitSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Dados inválidos.', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const admin = createAdminClient() as any
    const visitData = {
      ...parsed.data,
      client_email: parsed.data.client_email || null,
      created_by: user.id,
    }

    // Create calendar event for the visit
    const startDate = `${parsed.data.visit_date}T${parsed.data.visit_time}`
    const endMinutes = parsed.data.duration_minutes || 30
    const endDate = new Date(new Date(startDate).getTime() + endMinutes * 60000).toISOString()

    // Get property title for calendar event title
    const { data: property } = await admin
      .from('dev_properties')
      .select('title, external_ref')
      .eq('id', parsed.data.property_id)
      .single()

    // Get client name (from lead or manual input)
    let clientName = parsed.data.client_name
    if (parsed.data.lead_id && !clientName) {
      const { data: lead } = await admin
        .from('leads')
        .select('name')
        .eq('id', parsed.data.lead_id)
        .single()
      clientName = lead?.full_name
    }

    const calendarTitle = `Visita: ${property?.title || 'Imóvel'} — ${clientName || 'Cliente'}`

    const { data: calendarEvent } = await admin
      .from('calendar_events')
      .insert({
        title: calendarTitle,
        description: parsed.data.notes || null,
        category: 'meeting',
        start_date: startDate,
        end_date: endDate,
        all_day: false,
        user_id: parsed.data.consultant_id,
        property_id: parsed.data.property_id,
        lead_id: parsed.data.lead_id || null,
        created_by: user.id,
        visibility: 'all',
        color: '#6366f1',
      })
      .select('id')
      .single()

    if (calendarEvent) {
      (visitData as any).calendar_event_id = calendarEvent.id
    }

    const { data, error } = await admin
      .from('visits')
      .insert(visitData)
      .select(VISIT_SELECT)
      .single()

    if (error) {
      console.error('[visits POST]', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data }, { status: 201 })
  } catch (err) {
    console.error('[visits POST]', err)
    return NextResponse.json({ error: 'Erro interno ao criar visita.' }, { status: 500 })
  }
}
