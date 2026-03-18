import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { createPartnerSchema } from '@/lib/validations/partner'

export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category')
    const visibility = searchParams.get('visibility')
    const is_active = searchParams.get('is_active')
    const is_recommended = searchParams.get('is_recommended')
    const search = searchParams.get('search')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')

    // Check user role for visibility filtering
    const admin = createAdminClient() as any
    const { data: userData } = await admin
      .from('dev_users')
      .select('role_id, roles(name)')
      .eq('id', user.id)
      .single()

    const roleName = (userData as any)?.roles?.name || ''
    const canSeePrivate = [
      'Broker/CEO', 'admin', 'Office Manager', 'Gestora Processual', 'team_leader', 'Team Leader',
    ].includes(roleName)

    let query = admin
      .from('temp_partners')
      .select('*', { count: 'exact' })

    // Visibility filtering based on role
    if (!canSeePrivate) {
      query = query.eq('visibility', 'public')
    } else if (visibility) {
      query = query.eq('visibility', visibility)
    }

    if (category) query = query.eq('category', category)
    if (is_active !== null && is_active !== undefined) {
      query = query.eq('is_active', is_active === 'true')
    }
    if (is_recommended === 'true') query = query.eq('is_recommended', true)
    if (search) {
      query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%,nif.ilike.%${search}%,city.ilike.%${search}%,contact_person.ilike.%${search}%`)
    }

    query = query.order('is_recommended', { ascending: false })
      .order('rating_avg', { ascending: false })
      .order('name', { ascending: true })

    const offset = (page - 1) * limit
    query = query.range(offset, offset + limit - 1)

    const { data, error, count } = await query

    if (error) {
      console.error('[partners GET]', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Strip sensitive fields for non-admin users
    const sanitizedData = canSeePrivate
      ? data
      : (data || []).map((p: any) => {
          const { internal_notes, commercial_conditions, ...rest } = p
          return rest
        })

    return NextResponse.json({
      data: sanitizedData || [],
      total: count || 0,
      page,
      limit,
      totalPages: Math.ceil((count || 0) / limit),
      canSeePrivate,
    })
  } catch (err) {
    console.error('[partners GET]', err)
    return NextResponse.json({ error: 'Erro interno ao carregar parceiros.' }, { status: 500 })
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
    const parsed = createPartnerSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Dados inválidos.', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const admin = createAdminClient() as any

    const partnerData = {
      ...parsed.data,
      nif: parsed.data.nif || null,
      email: parsed.data.email || null,
      created_by: user.id,
    }

    const { data, error } = await admin
      .from('temp_partners')
      .insert(partnerData)
      .select()
      .single()

    if (error) {
      if (error.code === '23505' && error.message.includes('nif')) {
        return NextResponse.json({ error: 'Já existe um parceiro com este NIF.' }, { status: 409 })
      }
      console.error('[partners POST]', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data }, { status: 201 })
  } catch (err) {
    console.error('[partners POST]', err)
    return NextResponse.json({ error: 'Erro interno ao criar parceiro.' }, { status: 500 })
  }
}
