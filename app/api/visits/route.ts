import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { createVisitSchema } from '@/lib/validations/visit'
import { notifyProposalCreated } from '@/lib/visits/notifications'

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

    // Determinar o estado inicial da visita:
    // - Se o consultor da angariação é o mesmo do comprador → 'scheduled' directo
    //   (não faz sentido pedir confirmação a si próprio)
    // - Caso contrário → 'proposal', aguarda resposta do seller agent
    //
    // O `seller_consultant_id` é populado automaticamente pelo trigger
    // `trg_visits_snapshot_seller_consultant` no momento do INSERT, mas
    // precisamos do valor *agora* para decidir o status. Por isso fazemos
    // um lookup explícito antes do insert.
    const { data: property } = await admin
      .from('dev_properties')
      .select('consultant_id')
      .eq('id', parsed.data.property_id)
      .single()

    const sellerConsultantId = property?.consultant_id ?? null
    const isSameAgent = sellerConsultantId && sellerConsultantId === parsed.data.consultant_id
    const initialStatus: 'proposal' | 'scheduled' = isSameAgent ? 'scheduled' : 'proposal'

    const visitData = {
      ...parsed.data,
      status: initialStatus,
      client_email: parsed.data.client_email || null,
      created_by: user.id,
    }

    // Note: o calendário lê directamente da tabela `visits` em /api/calendar/events
    // (projecta uma visita = um evento), por isso não há nada a inserir em
    // `calendar_events` aqui.
    const { data, error } = await admin
      .from('visits')
      .insert(visitData)
      .select(VISIT_SELECT)
      .single()

    if (error) {
      console.error('[visits POST]', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Push: se ficou em estado proposal, notificar o seller agent.
    // Não bloqueamos a resposta nem fazemos rollback se a notificação falhar.
    if (initialStatus === 'proposal' && sellerConsultantId) {
      void notifyProposalCreated(admin, sellerConsultantId, {
        id: data.id,
        property_title: data.property?.title ?? null,
        client_name: data.lead?.full_name ?? data.client_name ?? null,
        visit_date: data.visit_date,
        visit_time: data.visit_time,
      })
    }

    return NextResponse.json({ data }, { status: 201 })
  } catch (err) {
    console.error('[visits POST]', err)
    return NextResponse.json({ error: 'Erro interno ao criar visita.' }, { status: 500 })
  }
}
