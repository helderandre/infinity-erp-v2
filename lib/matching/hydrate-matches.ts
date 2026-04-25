/**
 * Hidratação partilhada entre `/api/negocios/[id]/matches` (full) e
 * `/api/negocios/[id]/matches/preview` (live preview com zonas em rascunho).
 *
 * Recebe a lista de pares `{ property_id, geo_source }` que veio da
 * função SQL e devolve `PropertyMatch[]` enriquecido com specs, media,
 * consultor, badges e price_flag.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { computeFlexibleBadges, isStrictPass } from './compute-flexible-badges'
import type { GeoSource } from './types'
import type { PropertyMatch } from '@/types/lead'

interface NegocioForBadges {
  area_min_m2: number | null
  estado_imovel: string | null
  tem_garagem: boolean | null
  tem_estacionamento: boolean | null
  tem_elevador: boolean | null
  tem_piscina: boolean | null
  tem_varanda: boolean | null
  tem_arrumos: boolean | null
  tem_exterior: boolean | null
  tem_porteiro: boolean | null
  orcamento: number | null
  orcamento_max: number | null
}

export interface HydrateOptions {
  strict?: boolean
}

export async function hydrateMatches(
  supabase: SupabaseClient,
  negocio: NegocioForBadges,
  blocking: Array<{ property_id: string; geo_source: GeoSource }>,
  options: HydrateOptions = {}
): Promise<PropertyMatch[]> {
  if (blocking.length === 0) return []

  const propertyIds = blocking.map((r) => r.property_id)
  const geoSourceMap = new Map(blocking.map((r) => [r.property_id, r.geo_source]))

  const [propsRes, specsRes, mediaRes] = await Promise.all([
    supabase
      .from('dev_properties')
      .select(
        'id, title, slug, listing_price, property_type, business_type, status, city, zone, description, energy_certificate, property_condition, latitude, longitude, consultant_id'
      )
      .in('id', propertyIds),
    supabase
      .from('dev_property_specifications')
      .select(
        `property_id, bedrooms, bathrooms, area_gross, area_util, parking_spaces,
         garage_spaces, construction_year, has_elevator, balcony_area, pool_area,
         attic_area, pantry_area, features, equipment, typology`
      )
      .in('property_id', propertyIds),
    supabase
      .from('dev_property_media')
      .select('property_id, url, is_cover')
      .in('property_id', propertyIds)
      .order('order_index', { ascending: true }),
  ])

  const properties = propsRes.data ?? []
  if (properties.length === 0) return []

  const consultantIds = [
    ...new Set(properties.map((p: any) => p.consultant_id).filter((x: unknown): x is string => !!x)),
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
    (specsRes.data ?? []).map((s: any) => [s.property_id as string, s as SpecsRow])
  )
  const mediaMap = new Map<string, { url: string; is_cover: boolean }[]>()
  for (const m of mediaRes.data ?? []) {
    const pid = (m as any).property_id as string
    const list = mediaMap.get(pid) ?? []
    list.push({ url: (m as any).url as string, is_cover: !!(m as any).is_cover })
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

  const results: PropertyMatch[] = []
  for (const p of properties as any[]) {
    const specs = specsMap.get(p.id) as any
    const geoSource = geoSourceMap.get(p.id) ?? 'no_filter'

    const badges = computeFlexibleBadges(
      {
        area_min_m2: negocio.area_min_m2,
        estado_imovel: negocio.estado_imovel,
        tem_garagem: negocio.tem_garagem,
        tem_estacionamento: negocio.tem_estacionamento,
        tem_elevador: negocio.tem_elevador,
        tem_piscina: negocio.tem_piscina,
        tem_varanda: negocio.tem_varanda,
        tem_arrumos: negocio.tem_arrumos,
        tem_exterior: negocio.tem_exterior,
        tem_porteiro: negocio.tem_porteiro,
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

    if (options.strict && !isStrictPass(badges)) continue

    let price_flag: 'yellow' | 'orange' | null = null
    if (p.listing_price && negocio.orcamento_max) {
      const ratio = Number(p.listing_price) / Number(negocio.orcamento_max)
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
      business_type: p.business_type,
      status: p.status,
      city: p.city,
      zone: p.zone,
      description: p.description,
      energy_certificate: p.energy_certificate,
      property_condition: p.property_condition,
      latitude: p.latitude,
      longitude: p.longitude,
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
            typology: specs.typology,
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

  // Ordenação: menos warnings primeiro, depois price_flag, depois preço
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

  return results
}
