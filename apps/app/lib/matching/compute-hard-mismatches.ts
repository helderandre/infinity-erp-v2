/**
 * Calcula tags de mismatch para os critérios "hard" do comprador
 * (preço, tipo, zona, quartos mínimos, WC mínimos) — complementa
 * `computeFlexibleBadges` que cobre apenas os "soft" (área, estado, amenidades).
 *
 * Usado por `/api/negocios/[id]/property-matches` para que, em modo "Solto"
 * (em que estes filtros são relaxados a nível SQL), o utilizador continue a
 * ver porque é que cada imóvel não corresponde 100% ao perfil do comprador.
 */

import type { MatchBadge } from './types'

export interface BuyerHardWishes {
  tipo_imovel: string | null
  localizacao: string | null
  orcamento: number | null
  orcamento_max: number | null
  quartos_min: number | null
  wc_min: number | null
}

export interface PropertyHardFacts {
  property_type: string | null
  city: string | null
  zone: string | null
  listing_price: number | null
  bedrooms: number | null
  bathrooms: number | null
}

function normalize(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
}

function zonesOverlap(buyerLoc: string | null, propertyCity: string | null, propertyZone: string | null): boolean {
  if (!buyerLoc) return true // sem critério → não emite warning
  const haystack = [propertyCity, propertyZone].filter(Boolean).map((s) => normalize(s as string))
  if (haystack.length === 0) return true // sem dados de imóvel → não emite warning
  const buyerZones = buyerLoc.split(',').map((z) => normalize(z)).filter(Boolean)
  if (buyerZones.length === 0) return true
  return buyerZones.some((bz) => haystack.some((h) => h.includes(bz) || bz.includes(h)))
}

function formatK(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M€`
  if (n >= 1_000) return `${Math.round(n / 1_000)}k€`
  return `${Math.round(n)}€`
}

export function computeHardMismatches(
  buyer: BuyerHardWishes,
  property: PropertyHardFacts
): MatchBadge[] {
  const out: MatchBadge[] = []

  // 1. Preço — só warning quando excede o orçamento máximo do comprador.
  const budget = buyer.orcamento_max ?? buyer.orcamento ?? null
  if (budget && property.listing_price && property.listing_price > budget) {
    const pct = Math.round((property.listing_price / budget - 1) * 100)
    out.push({
      type: 'warning',
      key: 'preco',
      label: `Acima do orçamento ${formatK(budget)} (+${pct}%)`,
    })
  }

  // 2. Tipo de imóvel — só warning quando ambos definidos e não coincidem.
  if (buyer.tipo_imovel && property.property_type) {
    const b = normalize(buyer.tipo_imovel)
    const p = normalize(property.property_type)
    if (!b.includes(p) && !p.includes(b)) {
      out.push({
        type: 'warning',
        key: 'tipo_imovel',
        label: `Pede ${buyer.tipo_imovel} (imóvel é ${property.property_type})`,
      })
    }
  }

  // 3. Zona — só warning quando há critério e o imóvel cai fora dele.
  if (buyer.localizacao && !zonesOverlap(buyer.localizacao, property.city, property.zone)) {
    const propLoc = [property.city, property.zone].filter(Boolean).join(' · ') || '—'
    out.push({
      type: 'warning',
      key: 'zona',
      label: `Quer ${buyer.localizacao} (imóvel em ${propLoc})`,
    })
  }

  // 4. Quartos mínimos
  if (buyer.quartos_min != null && property.bedrooms != null && property.bedrooms < buyer.quartos_min) {
    out.push({
      type: 'warning',
      key: 'quartos',
      label: `Pede T${buyer.quartos_min}+ (imóvel é T${property.bedrooms})`,
    })
  }

  // 5. WC mínimos
  if (buyer.wc_min != null && property.bathrooms != null && property.bathrooms < buyer.wc_min) {
    out.push({
      type: 'warning',
      key: 'wc',
      label: `Pede ${buyer.wc_min}+ WC (imóvel tem ${property.bathrooms})`,
    })
  }

  return out
}
