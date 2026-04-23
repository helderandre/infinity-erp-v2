import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { createPartnerSchema } from '@/lib/validations/partner'
import { isPartnersStaff } from '@/lib/auth/partners-staff'
import { PARTNER_CATEGORY_OPTIONS } from '@/lib/constants'

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
    const statusParam = searchParams.get('status') // 'pending' | 'approved' | 'rejected' | 'all'
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')

    const admin = createAdminClient() as any
    const isStaff = await isPartnersStaff(user.id)
    const canSeePrivate = isStaff

    let query = admin
      .from('temp_partners')
      .select('*', { count: 'exact' })

    // Visibility filtering based on role
    if (!canSeePrivate) {
      query = query.eq('visibility', 'public')
    } else if (visibility) {
      query = query.eq('visibility', visibility)
    }

    // Status filtering — default: only approved; staff can request 'pending' | 'rejected' | 'all'
    // Non-staff can only request their own pending/rejected via 'mine' via submitted_by filter below
    const effectiveStatus = statusParam || 'approved'

    if (effectiveStatus === 'all') {
      if (!isStaff) {
        // Non-staff: approved OR own proposals (any status)
        query = query.or(`status.eq.approved,submitted_by.eq.${user.id}`)
      }
      // staff with 'all' gets everything, no status filter applied
    } else if (effectiveStatus === 'pending' || effectiveStatus === 'rejected') {
      if (!isStaff) {
        // Non-staff can only see their own pending/rejected
        query = query.eq('status', effectiveStatus).eq('submitted_by', user.id)
      } else {
        query = query.eq('status', effectiveStatus)
      }
    } else {
      // 'approved'
      query = query.eq('status', 'approved')
    }

    if (category) query = query.eq('category', category)
    if (is_active !== null && is_active !== undefined) {
      query = query.eq('is_active', is_active === 'true')
    }
    if (is_recommended === 'true') query = query.eq('is_recommended', true)
    if (search) {
      // Resolve category labels → slugs so free-text searches like
      // "advogado" also match partners with category='lawyer' (the DB only
      // stores the slug, never the PT label). Substring match keeps things
      // forgiving ("arquit" hits "Arquitecto").
      const needle = search.toLowerCase()
      const matchedCategorySlugs = PARTNER_CATEGORY_OPTIONS
        .filter((opt) => opt.label.toLowerCase().includes(needle))
        .map((opt) => opt.value)

      const conditions = [
        `name.ilike.%${search}%`,
        `city.ilike.%${search}%`,
      ]
      if (matchedCategorySlugs.length > 0) {
        conditions.push(`category.in.(${matchedCategorySlugs.join(',')})`)
      }
      query = query.or(conditions.join(','))
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

    // Counts by status — only staff see the pending count (used to badge the tab);
    // non-staff get the count of their own pending proposals.
    let pendingCount = 0
    if (isStaff) {
      const { count: c } = await admin
        .from('temp_partners')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'pending')
      pendingCount = c || 0
    } else {
      const { count: c } = await admin
        .from('temp_partners')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'pending')
        .eq('submitted_by', user.id)
      pendingCount = c || 0
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
      isStaff,
      pendingCount,
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
    const isStaff = await isPartnersStaff(user.id)

    // Validate category slug against partner_categories
    const { data: catRow } = await admin
      .from('partner_categories')
      .select('slug, is_active')
      .eq('slug', parsed.data.category)
      .single()
    if (!catRow) {
      return NextResponse.json({ error: 'Categoria inválida.' }, { status: 400 })
    }
    if (!catRow.is_active) {
      return NextResponse.json({ error: 'Categoria inactiva.' }, { status: 400 })
    }

    const partnerData: Record<string, any> = {
      ...parsed.data,
      nif: parsed.data.nif || null,
      email: parsed.data.email || null,
      created_by: user.id,
      submitted_by: user.id,
      status: isStaff ? 'approved' : 'pending',
    }

    // Non-staff proposals cannot set internal-only fields
    if (!isStaff) {
      partnerData.internal_notes = null
      partnerData.commercial_conditions = null
      partnerData.is_recommended = false
      partnerData.visibility = 'public'
    }

    if (isStaff) {
      partnerData.reviewed_by = user.id
      partnerData.reviewed_at = new Date().toISOString()
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

    return NextResponse.json({ data, isProposal: !isStaff }, { status: 201 })
  } catch (err) {
    console.error('[partners POST]', err)
    return NextResponse.json({ error: 'Erro interno ao criar parceiro.' }, { status: 500 })
  }
}
