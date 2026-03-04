import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import type { PropertyMatch } from '@/types/lead'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()

    // 1. Buscar criterios do negocio
    const { data: negocio, error: negError } = await supabase
      .from('negocios')
      .select('localizacao, orcamento, orcamento_max, quartos_min, tipo')
      .eq('id', id)
      .single()

    if (negError || !negocio) {
      return NextResponse.json({ error: 'Negócio não encontrado' }, { status: 404 })
    }

    // Matches so faz sentido para Compra ou Compra e Venda
    if (!['Compra', 'Compra e Venda'].includes(negocio.tipo)) {
      return NextResponse.json({ data: [] })
    }

    // 2. Consultar propriedades
    let query = supabase
      .from('dev_properties')
      .select('id, title, slug, listing_price, property_type, status, city, zone, description, energy_certificate, property_condition, consultant_id')
      .neq('status', 'sold')
      .eq('business_type', 'venda')

    // Filtro de preco
    if (negocio.orcamento_max) {
      const maxPrice = negocio.orcamento_max * 1.15
      query = query.lte('listing_price', maxPrice)
    }
    if (negocio.orcamento) {
      query = query.gte('listing_price', negocio.orcamento)
    }

    // Filtro de zonas
    if (negocio.localizacao) {
      const zones = negocio.localizacao.split(',').map((z: string) => z.trim()).filter(Boolean)
      if (zones.length > 0) {
        const orFilter = zones
          .map((z: string) => `city.ilike.%${z}%,zone.ilike.%${z}%`)
          .join(',')
        query = query.or(orFilter)
      }
    }

    const { data: properties, error: propError } = await query.limit(50)

    if (propError) {
      return NextResponse.json({ error: propError.message }, { status: 500 })
    }

    if (!properties || properties.length === 0) {
      return NextResponse.json({ data: [] })
    }

    // 3. Buscar specs, media e consultores em paralelo
    const propertyIds = properties.map(p => p.id)
    const consultantIds = [...new Set(properties.map(p => p.consultant_id).filter((id): id is string => !!id))]

    const [specsResult, mediaResult, consultantsResult] = await Promise.all([
      supabase
        .from('dev_property_specifications')
        .select('property_id, bedrooms, bathrooms, area_gross, area_util, parking_spaces, construction_year, has_elevator, features')
        .in('property_id', propertyIds),
      supabase
        .from('dev_property_media')
        .select('property_id, url, is_cover')
        .in('property_id', propertyIds)
        .order('order_index', { ascending: true }),
      consultantIds.length > 0
        ? supabase
            .from('dev_users')
            .select('id, commercial_name, professional_email')
            .in('id', consultantIds)
        : Promise.resolve({ data: [] }),
    ])

    // Also fetch consultant phones
    const consultantPhoneResult = consultantIds.length > 0
      ? await supabase
          .from('dev_consultant_profiles')
          .select('user_id, phone_commercial')
          .in('user_id', consultantIds)
      : { data: [] }

    const specsMap = new Map(
      (specsResult.data || []).map(s => [s.property_id, s])
    )

    // Group all media by property
    const mediaMap = new Map<string, { url: string; is_cover: boolean }[]>()
    for (const m of (mediaResult.data || [])) {
      const pid = m.property_id as string
      const list = mediaMap.get(pid) || []
      list.push({ url: m.url, is_cover: !!m.is_cover })
      mediaMap.set(pid, list)
    }

    const consultantMap = new Map(
      (consultantsResult.data || []).map(c => [c.id, c])
    )
    const consultantPhoneMap = new Map(
      (consultantPhoneResult.data || []).map(c => [c.user_id, c.phone_commercial])
    )

    // 4. Montar resultados com filtro de quartos e price_flag
    const results: PropertyMatch[] = properties
      .map(p => {
        const specs = specsMap.get(p.id)

        // Filtro post-query por quartos minimos
        if (negocio.quartos_min && specs?.bedrooms && specs.bedrooms < negocio.quartos_min) {
          return null
        }

        // Calcular price_flag
        let price_flag: 'yellow' | 'orange' | null = null
        if (p.listing_price && negocio.orcamento_max) {
          const ratio = p.listing_price / negocio.orcamento_max
          if (ratio > 1.10) {
            price_flag = 'orange'
          } else if (ratio > 1.0) {
            price_flag = 'yellow'
          }
        }

        const media = mediaMap.get(p.id) || []
        const coverMedia = media.find(m => m.is_cover)
        const consultant = p.consultant_id ? consultantMap.get(p.consultant_id) : null

        return {
          id: p.id,
          title: p.title || '',
          slug: p.slug || '',
          listing_price: p.listing_price,
          property_type: p.property_type,
          status: p.status,
          city: p.city,
          zone: p.zone,
          description: p.description,
          energy_certificate: p.energy_certificate,
          property_condition: p.property_condition,
          specs: specs
            ? {
                bedrooms: specs.bedrooms,
                bathrooms: specs.bathrooms,
                area_gross: specs.area_gross,
                area_util: specs.area_util,
                parking_spaces: specs.parking_spaces,
                construction_year: specs.construction_year,
                has_elevator: specs.has_elevator,
                features: specs.features,
              }
            : null,
          media,
          cover_url: coverMedia?.url || media[0]?.url || null,
          price_flag,
          consultant: consultant
            ? {
                id: consultant.id,
                commercial_name: consultant.commercial_name,
                phone: consultantPhoneMap.get(consultant.id) || null,
                email: consultant.professional_email,
              }
            : null,
        }
      })
      .filter((p): p is PropertyMatch => p !== null)

    // 5. Ordenar: dentro do orcamento primeiro, depois yellow, depois orange
    results.sort((a, b) => {
      const order = { null: 0, yellow: 1, orange: 2 } as const
      const aOrder = order[a.price_flag ?? 'null' as keyof typeof order] ?? 0
      const bOrder = order[b.price_flag ?? 'null' as keyof typeof order] ?? 0
      return aOrder - bOrder
    })

    return NextResponse.json({ data: results })
  } catch (error) {
    console.error('Erro ao obter matches:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
