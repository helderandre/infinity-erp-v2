import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/permissions'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requirePermission('leads')
    if (!auth.authorized) return auth.response

    const { id } = await params
    const admin = createAdminClient() as any

    // Get negocio search criteria
    const { data: neg, error: negError } = await admin
      .from('negocios')
      .select('tipo_imovel, localizacao, orcamento, orcamento_max, quartos_min')
      .eq('id', id)
      .single()

    if (negError || !neg) {
      return NextResponse.json({ error: 'Negócio não encontrado.' }, { status: 404 })
    }

    // Get already-added property IDs
    const { data: existing } = await admin
      .from('negocio_properties')
      .select('property_id')
      .eq('negocio_id', id)
      .not('property_id', 'is', null)

    const excludeIds = (existing || []).map((e: any) => e.property_id).filter(Boolean)

    // Build query
    let query = admin
      .from('dev_properties')
      .select(`
        id, title, external_ref, listing_price, property_type, status, city, zone, slug,
        dev_property_specifications(bedrooms, bathrooms, area_gross, area_util, parking_spaces, has_elevator, features),
        dev_property_media(url, is_cover)
      `)
      .not('status', 'in', '(cancelled,draft)')
      .order('created_at', { ascending: false })
      .limit(50)

    // Filter by property type
    if (neg.tipo_imovel) {
      query = query.ilike('property_type', `%${neg.tipo_imovel}%`)
    }

    // Filter by price range (±15%)
    const budget = neg.orcamento_max || neg.orcamento
    if (budget) {
      const min = budget * 0.7
      const max = budget * 1.25
      query = query.gte('listing_price', min).lte('listing_price', max)
    }

    // Filter by location
    if (neg.localizacao) {
      const zones = neg.localizacao.split(',').map((z: string) => z.trim()).filter(Boolean)
      if (zones.length > 0) {
        const orFilter = zones.map((z: string) => `city.ilike.%${z}%,zone.ilike.%${z}%`).join(',')
        query = query.or(orFilter)
      }
    }

    // Exclude already-added
    if (excludeIds.length > 0) {
      query = query.not('id', 'in', `(${excludeIds.join(',')})`)
    }

    const { data, error } = await query

    if (error) {
      console.error('[property-matches]', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Add price flags
    const results = (data || []).map((p: any) => {
      let price_flag: string | null = null
      if (budget && p.listing_price) {
        const ratio = p.listing_price / budget
        if (ratio <= 1.0) price_flag = 'green'
        else if (ratio <= 1.05) price_flag = 'green'
        else if (ratio <= 1.15) price_flag = 'yellow'
        else if (ratio <= 1.25) price_flag = 'orange'
        else price_flag = 'red'
      }
      return { ...p, price_flag }
    })

    return NextResponse.json({ data: results })
  } catch (err) {
    console.error('[property-matches]', err)
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}
