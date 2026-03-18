import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

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

    // Get acompanhamento with negócio criteria
    const { data: acomp, error: acompError } = await admin
      .from('temp_acompanhamentos')
      .select(`
        id, negocio_id,
        negocio:negocios!negocio_id(
          orcamento, orcamento_max, localizacao, quartos_min,
          tipo_imovel, tem_garagem, tem_elevador, casas_banho
        )
      `)
      .eq('id', id)
      .single()

    if (acompError || !acomp) {
      return NextResponse.json({ error: 'Acompanhamento não encontrado.' }, { status: 404 })
    }

    const neg = acomp.negocio
    if (!neg) {
      return NextResponse.json({ data: [] })
    }

    // Get already-added properties to exclude
    const { data: existingProps } = await admin
      .from('temp_acompanhamento_properties')
      .select('property_id')
      .eq('acompanhamento_id', id)

    const excludeIds = (existingProps || []).map((p: any) => p.property_id)

    // Build property query
    let query = admin
      .from('dev_properties')
      .select(`
        id, title, external_ref, city, zone, listing_price, slug, property_type, status,
        dev_property_specifications(bedrooms, bathrooms, area_util, has_elevator, parking_spaces),
        dev_property_media(url, is_cover)
      `)
      .in('status', ['active', 'available'])

    // Filter by property type
    if (neg.tipo_imovel) {
      query = query.eq('property_type', neg.tipo_imovel)
    }

    // Filter by price range
    const budgetMax = neg.orcamento_max || neg.orcamento
    if (budgetMax) {
      query = query.lte('listing_price', budgetMax * 1.15)
    }
    if (neg.orcamento) {
      query = query.gte('listing_price', neg.orcamento * 0.85)
    }

    // Filter by location
    if (neg.localizacao) {
      const locations = neg.localizacao.split(',').map((l: string) => l.trim()).filter(Boolean)
      if (locations.length > 0) {
        const locationFilters = locations
          .map((z: string) => `city.ilike.%${z}%,zone.ilike.%${z}%`)
          .join(',')
        query = query.or(locationFilters)
      }
    }

    query = query.order('listing_price', { ascending: true }).limit(50)

    const { data: properties, error: propError } = await query

    if (propError) {
      console.error('[acompanhamentos/matches GET]', propError)
      return NextResponse.json({ error: propError.message }, { status: 500 })
    }

    // Post-filter: bedrooms + exclude already-added
    let matches = (properties || []).filter((p: any) => {
      if (excludeIds.includes(p.id)) return false
      if (neg.quartos_min && p.dev_property_specifications?.bedrooms) {
        if (p.dev_property_specifications.bedrooms < neg.quartos_min) return false
      }
      return true
    })

    // Add price flags
    matches = matches.map((p: any) => {
      let priceFlag = 'green'
      const maxBudget = neg.orcamento_max || neg.orcamento
      if (maxBudget && p.listing_price > maxBudget) {
        const overPct = ((p.listing_price - maxBudget) / maxBudget) * 100
        priceFlag = overPct > 15 ? 'red' : overPct > 5 ? 'orange' : 'yellow'
      }
      return { ...p, price_flag: priceFlag }
    })

    return NextResponse.json({ data: matches })
  } catch (err) {
    console.error('[acompanhamentos/matches GET]', err)
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}
