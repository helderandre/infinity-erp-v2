/**
 * Forward geocoding via Mapbox Geocoding API v5.
 *
 * Usado para converter morada + CP + cidade dum imóvel em lat/lng.
 * Inicialmente para backfill dos 39 imóveis legacy + hook no save.
 *
 * Limites: 100k requests/mês grátis. Deve ser MUITO mais do que precisamos.
 */

interface GeocodeInput {
  address_street?: string | null
  postal_code?: string | null
  city?: string | null
  zone?: string | null
}

export interface GeocodeResult {
  latitude: number
  longitude: number
  /** Score 0-1 de confiança devolvido pelo Mapbox (relevance) */
  relevance: number
  /** Texto canónico da morada como Mapbox a interpretou */
  place_name: string
}

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN
const MIN_RELEVANCE = 0.5

/**
 * Constrói a query a partir dos campos disponíveis.
 * Privilegia: morada, CP, cidade — todos opcionais.
 */
function buildQuery(input: GeocodeInput): string | null {
  const parts: string[] = []
  if (input.address_street?.trim()) parts.push(input.address_street.trim())
  if (input.postal_code?.trim()) parts.push(input.postal_code.trim())
  if (input.city?.trim()) parts.push(input.city.trim())
  if (parts.length === 0 && input.zone?.trim()) parts.push(input.zone.trim())
  if (parts.length === 0) return null
  return parts.join(', ')
}

/**
 * Geocodifica um imóvel para lat/lng. Devolve `null` se:
 *   - Sem morada/CP/cidade utilizáveis
 *   - Mapbox não devolve resultados
 *   - Resultado tem relevance abaixo do threshold (provavelmente errado)
 *
 * Não levanta erros — usado tanto em backfill como em hooks de save,
 * geocodificação não-fatal.
 */
export async function geocodeProperty(
  input: GeocodeInput
): Promise<GeocodeResult | null> {
  if (!MAPBOX_TOKEN) {
    console.warn('[geocoding] NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN não configurado')
    return null
  }

  const query = buildQuery(input)
  if (!query) return null

  const params = new URLSearchParams({
    access_token: MAPBOX_TOKEN,
    country: 'PT',
    language: 'pt',
    limit: '1',
    types: 'address,postcode,place,locality,neighborhood',
  })

  const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
    query
  )}.json?${params}`

  try {
    const response = await fetch(url)
    if (!response.ok) {
      console.warn(`[geocoding] Mapbox retornou ${response.status} para "${query}"`)
      return null
    }
    const data = (await response.json()) as {
      features?: Array<{
        center?: [number, number]
        relevance?: number
        place_name?: string
      }>
    }
    const feature = data.features?.[0]
    if (!feature?.center || feature.center.length !== 2) return null

    const relevance = feature.relevance ?? 0
    if (relevance < MIN_RELEVANCE) return null

    const [longitude, latitude] = feature.center
    return {
      latitude,
      longitude,
      relevance,
      place_name: feature.place_name ?? query,
    }
  } catch (err) {
    console.warn('[geocoding] Erro ao chamar Mapbox:', err instanceof Error ? err.message : err)
    return null
  }
}
