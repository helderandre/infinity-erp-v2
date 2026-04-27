import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { propertySchema } from '@/lib/validations/property'
import { requirePermission } from '@/lib/auth/permissions'

export async function GET(request: Request) {
  try {
    const auth = await requirePermission('properties')
    if (!auth.authorized) return auth.response

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
    const bedrooms_min = searchParams.get('bedrooms_min')
    const bathrooms_min = searchParams.get('bathrooms_min')
    const area_util_min = searchParams.get('area_util_min')
    const area_util_max = searchParams.get('area_util_max')
    const construction_year_min = searchParams.get('construction_year_min')
    const construction_year_max = searchParams.get('construction_year_max')
    const has_elevator = searchParams.get('has_elevator')
    const parking_spaces_min = searchParams.get('parking_spaces_min')
    const has_pool = searchParams.get('has_pool')
    const energy_certificate = searchParams.get('energy_certificate')
    const zone = searchParams.get('zone')
    const address_parish = searchParams.get('address_parish')
    // Management-side filters: surface workflow problems quickly.
    const missing_cover = searchParams.get('missing_cover') === 'true'
    const missing_owners = searchParams.get('missing_owners') === 'true'
    const contract_expiring_days = searchParams.get('contract_expiring_days')
    const limit = Math.min(Number(searchParams.get('per_page')) || 20, 100)
    const page = Math.max(Number(searchParams.get('page')) || 1, 1)
    const offset = (page - 1) * limit

    const sortBy = searchParams.get('sort_by')
    const sortDir = searchParams.get('sort_dir')
    const validSortColumns = ['title', 'external_ref', 'status', 'created_at', 'listing_price', 'city']
    const requestedSort = sortBy && validSortColumns.includes(sortBy) ? sortBy : 'external_ref'
    // `external_ref` follows the `<consultor>-<seq>` pattern; lexicographic
    // sort breaks "latest first" (e.g. "-97" > "-200"). Route those requests
    // to the generated integer column instead.
    const sortColumn = requestedSort === 'external_ref' ? 'external_ref_seq' : requestedSort
    const sortAscending = sortDir === 'asc'

    let query = supabase
      .from('dev_properties')
      .select(
        '*, dev_property_specifications(*), dev_property_media(id, url, is_cover, order_index), consultant:dev_users!consultant_id(id, commercial_name)',
        { count: 'exact' }
      )
      .neq('status', 'draft')
      .neq('status', 'cancelled')
      .order(sortColumn, { ascending: sortAscending, nullsFirst: false })
      .range(offset, offset + limit - 1)

    if (search) {
      const trimmed = search.trim()
      // Shorthand RE/MAX-style ref: caller said only the suffix digits
      // (e.g., "103" for "121491860-103"). Match suffix exclusively so the
      // result list isn't diluted by accidental hits on title/city/zone.
      const isNumericShorthand = /^\d{2,}$/.test(trimmed)
      if (isNumericShorthand) {
        query = query.ilike('external_ref', `%-${trimmed}`)
      } else {
        // Also match properties by the owning consultant's commercial_name —
        // two-step because .or() can't span tables. We resolve consultant IDs
        // by name first, then fold them into the main search disjunction.
        const { data: consultantMatches } = await supabase
          .from('dev_users')
          .select('id')
          .ilike('commercial_name', `%${search}%`)
          .limit(20)
        const consultantIds = (consultantMatches ?? [])
          .map((c: any) => String(c.id))
          .filter(Boolean)

        const conditions = [
          `title.ilike.%${search}%`,
          `city.ilike.%${search}%`,
          `zone.ilike.%${search}%`,
          `external_ref.ilike.%${search}%`,
        ]
        if (consultantIds.length > 0) {
          conditions.push(`consultant_id.in.(${consultantIds.join(',')})`)
        }
        query = query.or(conditions.join(','))
      }
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
      // CSV multi-select: "Apartamento,Moradia"
      const types = property_type.split(',').map((s) => s.trim()).filter(Boolean)
      if (types.length === 1) query = query.eq('property_type', types[0])
      else if (types.length > 1) query = query.in('property_type', types)
    }
    if (business_type) {
      const biz = business_type.split(',').map((s) => s.trim()).filter(Boolean)
      if (biz.length === 1) query = query.eq('business_type', biz[0])
      else if (biz.length > 1) query = query.in('business_type', biz)
    }
    if (city) {
      query = query.ilike('city', `%${city}%`)
    }
    if (consultant_id) {
      const cs = consultant_id.split(',').map((s) => s.trim()).filter(Boolean)
      if (cs.length === 1) query = query.eq('consultant_id', cs[0])
      else if (cs.length > 1) query = query.in('consultant_id', cs)
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
      const conds = property_condition.split(',').map((s) => s.trim()).filter(Boolean)
      if (conds.length === 1) query = query.eq('property_condition', conds[0])
      else if (conds.length > 1) query = query.in('property_condition', conds)
    }
    if (energy_certificate) {
      // Comma-separated multi-select: "A,A+,B"
      const certs = energy_certificate.split(',').map((s) => s.trim()).filter(Boolean)
      if (certs.length === 1) query = query.eq('energy_certificate', certs[0])
      else if (certs.length > 1) query = query.in('energy_certificate', certs)
    }
    if (zone) {
      query = query.ilike('zone', `%${zone}%`)
    }
    if (address_parish) {
      query = query.ilike('address_parish', `%${address_parish}%`)
    }

    // ── Spec-based filters (live in dev_property_specifications) ──
    // PostgREST can't filter the parent by embedded columns without forcing
    // an !inner join (which would silently drop properties with no specs).
    // Instead, pre-resolve property IDs that satisfy ALL spec predicates in
    // one round-trip and fold them into the main query via .in('id', ids).
    const specFilters: {
      key: 'bedrooms' | 'bathrooms' | 'area_util' | 'construction_year' | 'parking_spaces' | 'has_elevator' | 'pool_area'
      op: 'gte' | 'lte' | 'eq' | 'gt'
      value: number | boolean
    }[] = []

    const pushNum = (key: typeof specFilters[number]['key'], op: 'gte' | 'lte' | 'gt', raw: string | null) => {
      if (!raw) return
      const n = Number(raw)
      if (!Number.isFinite(n)) return
      specFilters.push({ key, op, value: n })
    }
    pushNum('bedrooms', 'gte', bedrooms_min)
    pushNum('bathrooms', 'gte', bathrooms_min)
    pushNum('area_util', 'gte', area_util_min)
    pushNum('area_util', 'lte', area_util_max)
    pushNum('construction_year', 'gte', construction_year_min)
    pushNum('construction_year', 'lte', construction_year_max)
    pushNum('parking_spaces', 'gte', parking_spaces_min)
    if (has_elevator === 'true') specFilters.push({ key: 'has_elevator', op: 'eq', value: true })
    if (has_pool === 'true') specFilters.push({ key: 'pool_area', op: 'gt', value: 0 })

    if (specFilters.length > 0) {
      let specQuery = supabase.from('dev_property_specifications').select('property_id')
      for (const f of specFilters) {
        if (f.op === 'gte') specQuery = specQuery.gte(f.key, f.value as number)
        else if (f.op === 'lte') specQuery = specQuery.lte(f.key, f.value as number)
        else if (f.op === 'gt') specQuery = specQuery.gt(f.key, f.value as number)
        else specQuery = specQuery.eq(f.key, f.value as boolean)
      }
      const { data: specMatches } = await specQuery
      const ids = (specMatches ?? []).map((s: any) => s.property_id).filter(Boolean)
      if (ids.length === 0) {
        return NextResponse.json({ data: [], total: 0 })
      }
      query = query.in('id', ids)
    }

    /* ── Management filters ──
     * "missing_cover": exclude properties that have at least one media row
     * with is_cover=true (lookup the IDs to exclude, then .not('id', 'in', …)).
     * "missing_owners": exclude properties present in property_owners.
     * "contract_expiring_days": dev_property_internal.contract_expiry within
     * the next N days (and not already past).
     */
    if (missing_cover) {
      const { data: withCover } = await supabase
        .from('dev_property_media')
        .select('property_id')
        .eq('is_cover', true)
      const exclude = (withCover ?? []).map((r: any) => r.property_id).filter(Boolean)
      if (exclude.length > 0) query = query.not('id', 'in', `(${exclude.join(',')})`)
    }
    if (missing_owners) {
      const { data: withOwners } = await supabase
        .from('property_owners')
        .select('property_id')
      const exclude = Array.from(new Set((withOwners ?? []).map((r: any) => r.property_id).filter(Boolean)))
      if (exclude.length > 0) query = query.not('id', 'in', `(${exclude.join(',')})`)
    }
    if (contract_expiring_days) {
      const days = Number(contract_expiring_days)
      if (Number.isFinite(days) && days > 0) {
        const now = new Date()
        const future = new Date(now.getTime() + days * 24 * 60 * 60 * 1000)
        const { data: expiring } = await supabase
          .from('dev_property_internal')
          .select('property_id')
          .gte('contract_expiry', now.toISOString().slice(0, 10))
          .lte('contract_expiry', future.toISOString().slice(0, 10))
        const ids = (expiring ?? []).map((r: any) => r.property_id).filter(Boolean)
        if (ids.length === 0) return NextResponse.json({ data: [], total: 0 })
        query = query.in('id', ids)
      }
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
    const auth = await requirePermission('properties')
    if (!auth.authorized) return auth.response

    const supabase = await createClient()

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
      consultant_id: validation.data.consultant_id || auth.user.id,
    }

    // Geocodifica antes de inserir se o user não preencheu o mapa picker
    const { fillCoordsIfMissing } = await import('@/lib/geocoding/property-hook')
    await fillCoordsIfMissing(insertData)

    const { data: property, error } = await supabase
      .from('dev_properties')
      .insert(insertData)
      .select('id, slug')
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

    // Fire-and-forget: notify agents with matching deals
    import('@/lib/properties/notify-matches').then(({ notifyPropertyMatches }) => {
      notifyPropertyMatches(supabase, {
        id: property.id,
        title: insertData.title || '',
        listing_price: insertData.listing_price || null,
        property_type: insertData.property_type || null,
        business_type: insertData.business_type || null,
        city: insertData.city || null,
        zone: insertData.zone || null,
        status: insertData.status || null,
      }).catch(() => {})
    }).catch(() => {})

    return NextResponse.json({ id: property.id }, { status: 201 })
  } catch (error) {
    console.error('Erro ao criar imóvel:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
