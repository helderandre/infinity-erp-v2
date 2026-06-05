/**
 * Calcula a lista de badges flexíveis para um par (negócio, imóvel).
 *
 * Regras gerais:
 * - Se o utilizador NÃO definiu o critério (ex.: `tem_piscina = null/false`),
 *   nenhuma badge é emitida — não interessa ao cliente.
 * - Se definiu `tem_X = true`:
 *   - imóvel oferece → badge `positive` ("✓ Piscina")
 *   - imóvel não oferece → badge `warning` ("Sem piscina")
 * - `area_min_m2`: comparado contra `specifications.area_util` (fallback `area_gross`).
 * - `estado_imovel`: comparado contra `dev_properties.property_condition`,
 *   normalizado.
 * - `geo_source`: se não for `spatial`, emite badge `info` informativa.
 */

import type {
  GeoSource,
  MatchBadge,
  NegocioMatchInput,
  PropertyMatchInput,
} from './types'

type AmenityKey =
  | 'tem_garagem'
  | 'tem_estacionamento'
  | 'tem_elevador'
  | 'tem_piscina'
  | 'tem_varanda'
  | 'tem_arrumos'
  | 'tem_exterior'
  | 'tem_porteiro'

interface AmenityRule {
  key: string
  label: string
  hasFn: (specs: NonNullable<PropertyMatchInput['specifications']>) => boolean
}

const AMENITY_RULES: Record<AmenityKey, AmenityRule> = {
  tem_garagem: {
    key: 'garagem',
    label: 'Garagem',
    hasFn: (s) => (s.garage_spaces ?? 0) > 0 || hasFeature(s, ['garagem']),
  },
  tem_estacionamento: {
    key: 'estacionamento',
    label: 'Estacionamento',
    hasFn: (s) =>
      (s.parking_spaces ?? 0) > 0 ||
      (s.garage_spaces ?? 0) > 0 ||
      hasFeature(s, ['estacionamento', 'garagem']),
  },
  tem_elevador: {
    key: 'elevador',
    label: 'Elevador',
    hasFn: (s) => s.has_elevator === true || hasFeature(s, ['elevador']),
  },
  tem_piscina: {
    key: 'piscina',
    label: 'Piscina',
    hasFn: (s) => (s.pool_area ?? 0) > 0 || hasFeature(s, ['piscina']),
  },
  tem_varanda: {
    key: 'varanda',
    label: 'Varanda',
    hasFn: (s) =>
      (s.balcony_area ?? 0) > 0 ||
      hasFeature(s, ['varanda', 'varandas', 'terraço', 'terracos']),
  },
  tem_arrumos: {
    key: 'arrumos',
    label: 'Arrumos',
    hasFn: (s) =>
      (s.attic_area ?? 0) > 0 ||
      (s.pantry_area ?? 0) > 0 ||
      hasFeature(s, ['arrumos', 'arrumacao', 'despensa']),
  },
  tem_exterior: {
    key: 'exterior',
    label: 'Espaço exterior',
    hasFn: (s) =>
      (s.balcony_area ?? 0) > 0 ||
      (s.pool_area ?? 0) > 0 ||
      hasFeature(s, ['varanda', 'terraço', 'jardim', 'piscina', 'exterior']),
  },
  tem_porteiro: {
    key: 'porteiro',
    label: 'Porteiro',
    hasFn: (s) => hasFeature(s, ['porteiro']) || hasEquipment(s, ['porteiro']),
  },
}

function hasFeature(
  specs: NonNullable<PropertyMatchInput['specifications']>,
  needles: string[]
): boolean {
  return matchAnyToken(specs.features ?? [], needles)
}

function hasEquipment(
  specs: NonNullable<PropertyMatchInput['specifications']>,
  needles: string[]
): boolean {
  return matchAnyToken(specs.equipment ?? [], needles)
}

function matchAnyToken(haystack: string[], needles: string[]): boolean {
  if (haystack.length === 0) return false
  const normalized = haystack.map((h) => normalize(h))
  const targets = needles.map((n) => normalize(n))
  return normalized.some((h) => targets.some((t) => h.includes(t)))
}

function normalize(s: string): string {
  // U+0300-U+036F é o bloco "Combining Diacritical Marks" (acentos quando em NFD)
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/_/g, ' ') // snake_case → "usado como novo"
    .toLowerCase()
    .trim()
}

/**
 * Mapeia `negocios.estado_imovel` (PT-PT user input) e
 * `dev_properties.property_condition` (mistura de chaves) para uma escala
 * comparável: 'novo' < 'remodelado' < 'usado_bom' < 'usado' < 'recuperar'.
 *
 * Retorna `null` se não conseguir interpretar.
 */
function condicaoToRank(s: string | null | undefined): number | null {
  if (!s) return null
  const n = normalize(s)
  if (n.includes('em construcao') || n.includes('em construção')) return 0
  if (n === 'novo') return 1
  if (n.includes('como novo')) return 2
  if (n.includes('remodelado')) return 2
  if (n.includes('bom estado')) return 3
  if (n === 'usado') return 4
  if (n.includes('para remodelar') || n.includes('recuperar')) return 5
  return null
}

/**
 * Calcula as badges flexíveis para um match.
 */
export function computeFlexibleBadges(
  negocio: NegocioMatchInput,
  property: PropertyMatchInput,
  geoSource: GeoSource
): MatchBadge[] {
  const badges: MatchBadge[] = []
  const specs = property.specifications ?? null

  // 1. Amenities (`tem_*` booleanos)
  for (const [field, rule] of Object.entries(AMENITY_RULES) as [
    AmenityKey,
    AmenityRule
  ][]) {
    const wants = negocio[field]
    if (wants !== true) continue // user não quer / não definiu → skip

    const has = specs ? rule.hasFn(specs) : false
    badges.push({
      type: has ? 'positive' : 'warning',
      key: rule.key,
      label: has ? rule.label : `Sem ${rule.label.toLowerCase()}`,
    })
  }

  // 2. Área mínima
  if (negocio.area_min_m2 != null && negocio.area_min_m2 > 0) {
    const propArea = specs?.area_util ?? specs?.area_gross ?? null
    if (propArea == null) {
      badges.push({
        type: 'warning',
        key: 'area_util',
        label: `Sem área registada (pede ${negocio.area_min_m2} m²)`,
      })
    } else if (propArea >= negocio.area_min_m2) {
      badges.push({
        type: 'positive',
        key: 'area_util',
        label: `${Math.round(propArea)} m²`,
      })
    } else {
      badges.push({
        type: 'warning',
        key: 'area_util',
        label: `Área ${Math.round(propArea)} m² (pede ${negocio.area_min_m2})`,
      })
    }
  }

  // 3. Estado do imóvel
  if (negocio.estado_imovel) {
    const wantedRank = condicaoToRank(negocio.estado_imovel)
    const actualRank = condicaoToRank(property.property_condition)
    if (wantedRank != null && actualRank != null && actualRank > wantedRank) {
      // imóvel está em pior estado do que o cliente quer
      badges.push({
        type: 'warning',
        key: 'estado_imovel',
        label: `Estado: ${property.property_condition} (pede ${negocio.estado_imovel})`,
      })
    } else if (wantedRank != null && actualRank != null) {
      badges.push({
        type: 'positive',
        key: 'estado_imovel',
        label: property.property_condition ?? '',
      })
    }
    // se não conseguimos interpretar, não emitimos badge
  }

  // 4. Geo source — só emite info se for fallback
  if (geoSource === 'text_fallback' || geoSource === 'localizacao_legacy') {
    badges.push({
      type: 'info',
      key: 'geo_source',
      label: 'Localização aproximada',
    })
  }

  return badges
}

/**
 * Aplica modo "estrito": filtra fora qualquer match com badges `warning`.
 * Badges `info` (ex.: localização aproximada) NÃO excluem.
 */
export function isStrictPass(badges: MatchBadge[]): boolean {
  return !badges.some((b) => b.type === 'warning')
}
