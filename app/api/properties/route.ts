import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { propertySchema } from '@/lib/validations/property'

export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)

    const search = searchParams.get('search')
    const status = searchParams.get('status')
    const property_type = searchParams.get('property_type')
    const business_type = searchParams.get('business_type')
    const city = searchParams.get('city')
    const consultant_id = searchParams.get('consultant_id')
    const price_min = searchParams.get('price_min')
    const price_max = searchParams.get('price_max')
    const external_ref = searchParams.get('external_ref')
    const property_condition = searchParams.get('property_condition')
    const limit = Math.min(Number(searchParams.get('per_page')) || 20, 100)
    const page = Math.max(Number(searchParams.get('page')) || 1, 1)
    const offset = (page - 1) * limit

    const sortBy = searchParams.get('sort_by')
    const sortDir = searchParams.get('sort_dir')
    const validSortColumns = ['title', 'external_ref', 'status', 'created_at', 'listing_price', 'city']
    const sortColumn = sortBy && validSortColumns.includes(sortBy) ? sortBy : 'created_at'
    const sortAscending = sortDir === 'asc'

    let query = supabase
      .from('dev_properties')
      .select(
        '*, dev_property_specifications(*), dev_property_media(id, url, is_cover, order_index), consultant:dev_users!consultant_id(id, commercial_name)',
        { count: 'exact' }
      )
      .order(sortColumn, { ascending: sortAscending })
      .range(offset, offset + limit - 1)

    if (search) {
      query = query.or(
        `title.ilike.%${search}%,city.ilike.%${search}%,zone.ilike.%${search}%,external_ref.ilike.%${search}%`
      )
    }
    if (status) {
      const statuses = status.split(',').filter(Boolean)
      if (statuses.length === 1) {
        query = query.eq('status', statuses[0])
      } else if (statuses.length > 1) {
        query = query.in('status', statuses)
      }
    }
    if (property_type) {
      query = query.eq('property_type', property_type)
    }
    if (business_type) {
      query = query.eq('business_type', business_type)
    }
    if (city) {
      query = query.ilike('city', `%${city}%`)
    }
    if (consultant_id) {
      query = query.eq('consultant_id', consultant_id)
    }
    if (price_min) {
      query = query.gte('listing_price', Number(price_min))
    }
    if (price_max) {
      query = query.lte('listing_price', Number(price_max))
    }
    if (external_ref) {
      query = query.ilike('external_ref', `%${external_ref}%`)
    }
    if (property_condition) {
      query = query.eq('property_condition', property_condition)
    }

    const { data, error, count } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      data: data || [],
      total: count || 0,
      page,
      per_page: limit,
    })
  } catch (error) {
    console.error('Erro ao listar imóveis:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const body = await request.json()

    const { specifications, internal, ...propertyData } = body

    const validation = propertySchema.safeParse(propertyData)
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: validation.error.flatten() },
        { status: 400 }
      )
    }

    const insertData = {
      ...validation.data,
      consultant_id: validation.data.consultant_id || user.id,
    }

    const { data: property, error } = await supabase
      .from('dev_properties')
      .insert(insertData)
      .select('id')
      .single()

    if (error) {
      return NextResponse.json(
        { error: 'Erro ao criar imóvel', details: error.message },
        { status: 500 }
      )
    }

    // Insert specifications if provided
    if (specifications && Object.keys(specifications).length > 0) {
      const { error: specsError } = await supabase
        .from('dev_property_specifications')
        .insert({ property_id: property.id, ...specifications })

      if (specsError) {
        console.error('Erro ao criar especificações:', specsError)
      }
    }

    // Insert internal data if provided
    if (internal && Object.keys(internal).length > 0) {
      const { error: internalError } = await supabase
        .from('dev_property_internal')
        .insert({ property_id: property.id, ...internal })

      if (internalError) {
        console.error('Erro ao criar dados internos:', internalError)
      }
    }

    return NextResponse.json({ id: property.id }, { status: 201 })
  } catch (error) {
    console.error('Erro ao criar imóvel:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
