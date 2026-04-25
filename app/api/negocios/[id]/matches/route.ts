import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/permissions'
import { computeFlexibleBadges, isStrictPass } from '@/lib/matching'
import type { GeoSource } from '@/lib/matching'
import type { PropertyMatch } from '@/types/lead'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requirePermission('leads')
    if (!auth.authorized) return auth.response

    const { id } = await params
    const url = new URL(request.url)
    const strict = url.searchParams.get('strict') === 'true'
    const supabase = await createClient()

    // 1. Buscar critérios flexíveis do negócio (os bloqueantes são aplicados em SQL)
    const { data: negocio, error: negError } = await supabase
      .from('negocios')
      .select(
        `tipo, orcamento, orcamento_max, area_min_m2, estado_imovel,
         tem_garagem, tem_estacionamento, tem_elevador, tem_piscina,
         tem_varanda, tem_arrumos, tem_exterior, tem_porteiro`
      )
      .eq('id', id)
      .single()

    if (negError || !negocio) {
      return NextResponse.json({ error: 'Negócio não encontrado' }, { status: 404 })
    }

    // 2. Aplicar bloqueantes via SQL function (status, business_type,
    //    property_type, quartos_min, casas_banho, preço, geografia).
    // Cast porque a função foi adicionada após a última geração de
    // types/database.ts; será reflectida na próxima regeneração.
    const { data: rpcResult, error: rpcError } = await (
      supabase as unknown as {
        rpc: (
          fn: 'match_properties_for_negocio',
          args: { p_negocio_id: string }
        ) => Promise<{
          data: Array<{ property_id: string; geo_source: GeoSource }> | null
          error: { message: string } | null
        }>
      }
    ).rpc('match_properties_for_negocio', { p_negocio_id: id })

    if (rpcError) {
      return NextResponse.json({ error: rpcError.message }, { status: 500 })
    }

    const blocking = rpcResult ?? []
    if (blocking.length === 0) {
      return NextResponse.json({ data: [] })
    }

    const propertyIds = blocking.map((r) => r.property_id)
    const geoSourceMap = new Map(blocking.map((r) => [r.property_id, r.geo_source]))

    // 3. Hidratar com props + specs + media + consultor (em paralelo)
    const [propsRes, specsRes, mediaRes] = await Promise.all([
      supabase
        .from('dev_properties')
        .select(
          'id, title, slug, listing_price, property_type, status, city, zone, description, energy_certificate, property_condition, consultant_id'
        )
        .in('id', propertyIds),
      supabase
        .from('dev_property_specifications')
        .select(
          `property_id, bedrooms, bathrooms, area_gross, area_util, parking_spaces,
           garage_spaces, construction_year, has_elevator, balcony_area, pool_area,
           attic_area, pantry_area, features, equipment`
        )
        .in('property_id', propertyIds),
      supabase
        .from('dev_property_media')
        .select('property_id, url, is_cover')
        .in('property_id', propertyIds)
        .order('order_index', { ascending: true }),
    ])

    const properties = propsRes.data ?? []
    if (properties.length === 0) return NextResponse.json({ data: [] })

    const consultantIds = [
      ...new Set(properties.map((p) => p.consultant_id).filter((x): x is string => !!x)),
    ]

    const [consultantsRes, consultantPhonesRes] = await Promise.all([
      consultantIds.length > 0
        ? supabase
            .from('dev_users')
            .select('id, commercial_name, professional_email')
            .in('id', consultantIds)
        : Promise.resolve({ data: [] as unknown[] }),
      consultantIds.length > 0
        ? supabase
            .from('dev_consultant_profiles')
            .select('user_id, phone_commercial')
            .in('user_id', consultantIds)
        : Promise.resolve({ data: [] as unknown[] }),
    ])

    type SpecsRow = NonNullable<typeof specsRes.data>[number]
    type ConsultantRow = { id: string; commercial_name: string; professional_email: string }
    type ConsultantPhoneRow = { user_id: string; phone_commercial: string }

    const specsMap = new Map<string, SpecsRow>(
      (specsRes.data ?? []).map((s) => [s.property_id as string, s as SpecsRow])
    )
    const mediaMap = new Map<string, { url: string; is_cover: boolean }[]>()
    for (const m of mediaRes.data ?? []) {
      const pid = m.property_id as string
      const list = mediaMap.get(pid) ?? []
      list.push({ url: m.url as string, is_cover: !!m.is_cover })
      mediaMap.set(pid, list)
    }
    const consultantMap = new Map<string, ConsultantRow>(
      ((consultantsRes.data ?? []) as ConsultantRow[]).map((c) => [c.id, c])
    )
    const phoneMap = new Map<string, string>(
      ((consultantPhonesRes.data ?? []) as ConsultantPhoneRow[]).map((c) => [
        c.user_id,
        c.phone_commercial,
      ])
    )

    // 4. Compor PropertyMatch[] com badges
    const results: PropertyMatch[] = []
    for (const p of properties) {
      const specs = specsMap.get(p.id) ?? null
      const geoSource = geoSourceMap.get(p.id) ?? 'no_filter'

      // Badges flexíveis
      const badges = computeFlexibleBadges(
        {
          area_min_m2: (negocio as Record<string, unknown>).area_min_m2 as number | null,
          estado_imovel: (negocio as Record<string, unknown>).estado_imovel as string | null,
          tem_garagem: (negocio as Record<string, unknown>).tem_garagem as boolean | null,
          tem_estacionamento: (negocio as Record<string, unknown>).tem_estacionamento as
            | boolean
            | null,
          tem_elevador: (negocio as Record<string, unknown>).tem_elevador as boolean | null,
          tem_piscina: (negocio as Record<string, unknown>).tem_piscina as boolean | null,
          tem_varanda: (negocio as Record<string, unknown>).tem_varanda as boolean | null,
          tem_arrumos: (negocio as Record<string, unknown>).tem_arrumos as boolean | null,
          tem_exterior: (negocio as Record<string, unknown>).tem_exterior as boolean | null,
          tem_porteiro: (negocio as Record<string, unknown>).tem_porteiro as boolean | null,
        },
        {
          property_condition: p.property_condition,
          specifications: specs
            ? {
                area_util: specs.area_util,
                area_gross: specs.area_gross,
                bedrooms: specs.bedrooms,
                bathrooms: specs.bathrooms,
                has_elevator: specs.has_elevator,
                garage_spaces: specs.garage_spaces,
                parking_spaces: specs.parking_spaces,
                balcony_area: specs.balcony_area,
                pool_area: specs.pool_area,
                attic_area: specs.attic_area,
                pantry_area: specs.pantry_area,
                features: specs.features,
                equipment: specs.equipment,
              }
            : null,
        },
        geoSource
      )

      // Modo estrito: filtra warnings (info não exclui)
      if (strict && !isStrictPass(badges)) continue

      // price_flag (mantém compatibilidade visual existente)
      let price_flag: 'yellow' | 'orange' | null = null
      const orcamentoMax = negocio.orcamento_max
      if (p.listing_price && orcamentoMax) {
        const ratio = Number(p.listing_price) / Number(orcamentoMax)
        if (ratio > 1.1) price_flag = 'orange'
        else if (ratio > 1.0) price_flag = 'yellow'
      }

      const media = mediaMap.get(p.id) ?? []
      const coverMedia = media.find((m) => m.is_cover)
      const consultant = p.consultant_id ? consultantMap.get(p.consultant_id) : null

      results.push({
        id: p.id,
        title: p.title ?? '',
        slug: p.slug ?? '',
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
        cover_url: coverMedia?.url ?? media[0]?.url ?? null,
        price_flag,
        geo_source: geoSource,
        badges,
        consultant: consultant
          ? {
              id: consultant.id,
              commercial_name: consultant.commercial_name,
              phone: phoneMap.get(consultant.id) ?? null,
              email: consultant.professional_email,
            }
          : null,
      })
    }

    // 5. Ordenar: 0 warnings primeiro (perfeitos), depois por price_flag, depois por preço
    results.sort((a, b) => {
      const aWarnings = a.badges.filter((b) => b.type === 'warning').length
      const bWarnings = b.badges.filter((b) => b.type === 'warning').length
      if (aWarnings !== bWarnings) return aWarnings - bWarnings

      const order = { null: 0, yellow: 1, orange: 2 } as const
      const aOrder = order[(a.price_flag ?? 'null') as keyof typeof order] ?? 0
      const bOrder = order[(b.price_flag ?? 'null') as keyof typeof order] ?? 0
      if (aOrder !== bOrder) return aOrder - bOrder

      return (a.listing_price ?? 0) - (b.listing_price ?? 0)
    })

    return NextResponse.json({ data: results })
  } catch (error) {
    console.error('Erro ao obter matches:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
