/**
 * Calcula tags de "onde este imóvel não corresponde ao que o comprador pede"
 * — usadas no separador "Interessados" de um negócio de venda, para mostrar
 * em cada potencial comprador onde o imóvel à venda fica aquém dos critérios
 * que esse comprador definiu.
 *
 * Convenção: só emitimos `warning` ou `info`. Nada de positives — manter os
 * cards limpos e focados nos motivos de discrepância.
 */

import type { MatchBadge } from './types'

type AmenityKey =
  | 'tem_garagem'
  | 'tem_estacionamento'
  | 'tem_elevador'
  | 'tem_piscina'
  | 'tem_varanda'
  | 'tem_arrumos'
  | 'tem_exterior'
  | 'tem_porteiro'

const AMENITY_LABEL: Record<AmenityKey, string> = {
  tem_garagem: 'garagem',
  tem_estacionamento: 'estacionamento',
  tem_elevador: 'elevador',
  tem_piscina: 'piscina',
  tem_varanda: 'varanda',
  tem_arrumos: 'arrumos',
  tem_exterior: 'espaço exterior',
  tem_porteiro: 'porteiro',
}

export interface SellerProfile {
  preco_venda: number | null
  tipo_imovel: string | null
  localizacao: string | null
  quartos: number | null
  casas_banho: number | null
  area_m2: number | null
  estado_imovel: string | null
  amenities: Partial<Record<AmenityKey, boolean | null>>
}

export interface BuyerProfile {
  orcamento: number | null
  orcamento_max: number | null
  tipo_imovel: string | null
  localizacao: string | null
  quartos_min: number | null
  wc_min: number | null
  area_min_m2: number | null
  estado_imovel: string | null
  amenities: Partial<Record<AmenityKey, boolean | null>>
}

function normalize(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
}

function condicaoToRank(s: string | null | undefined): number | null {
  if (!s) return null
  const n = normalize(s)
  if (n.includes('em construcao')) return 0
  if (n === 'novo') return 1
  if (n.includes('como novo') || n.includes('remodelado')) return 2
  if (n.includes('bom estado')) return 3
  if (n === 'usado') return 4
  if (n.includes('para remodelar') || n.includes('recuperar')) return 5
  return null
}

function zonesOverlap(a: string | null, b: string | null): boolean {
  if (!a || !b) return true // sem critério de zona — não emitir mismatch
  const az = a.split(',').map((z) => normalize(z)).filter(Boolean)
  const bz = b.split(',').map((z) => normalize(z)).filter(Boolean)
  if (az.length === 0 || bz.length === 0) return true
  return az.some((x) => bz.some((y) => x.includes(y) || y.includes(x)))
}

export function computeBuyerMismatches(
  seller: SellerProfile,
  buyer: BuyerProfile
): MatchBadge[] {
  const out: MatchBadge[] = []

  // 1. Orçamento — preço do imóvel vs orçamento do comprador
  if (seller.preco_venda && buyer.orcamento_max) {
    const ratio = seller.preco_venda / buyer.orcamento_max
    if (ratio > 1.0) {
      const pct = Math.round((ratio - 1) * 100)
      out.push({
        type: 'warning',
        key: 'preco',
        label: `Orçamento até ${formatK(buyer.orcamento_max)} (preço +${pct}%)`,
      })
    }
  } else if (seller.preco_venda && buyer.orcamento && !buyer.orcamento_max) {
    // só tem mínimo (raro) — só emite warning se preço estiver abaixo
    if (seller.preco_venda < buyer.orcamento) {
      out.push({
        type: 'warning',
        key: 'preco',
        label: `Pede mín. ${formatK(buyer.orcamento)} (preço ${formatK(seller.preco_venda)})`,
      })
    }
  }

  // 2. Tipo de imóvel
  if (seller.tipo_imovel && buyer.tipo_imovel) {
    const s = normalize(seller.tipo_imovel)
    const b = normalize(buyer.tipo_imovel)
    if (!s.includes(b) && !b.includes(s)) {
      out.push({
        type: 'warning',
        key: 'tipo_imovel',
        label: `Pede ${buyer.tipo_imovel} (imóvel é ${seller.tipo_imovel})`,
      })
    }
  }

  // 3. Zona / localização
  if (buyer.localizacao && seller.localizacao && !zonesOverlap(seller.localizacao, buyer.localizacao)) {
    out.push({
      type: 'warning',
      key: 'zona',
      label: `Quer ${buyer.localizacao} (imóvel em ${seller.localizacao})`,
    })
  }

  // 4. Quartos mínimos
  if (buyer.quartos_min != null && seller.quartos != null && seller.quartos < buyer.quartos_min) {
    out.push({
      type: 'warning',
      key: 'quartos',
      label: `Pede T${buyer.quartos_min}+ (imóvel é T${seller.quartos})`,
    })
  }

  // 5. Casas de banho mínimas
  if (buyer.wc_min != null && seller.casas_banho != null && seller.casas_banho < buyer.wc_min) {
    out.push({
      type: 'warning',
      key: 'wc',
      label: `Pede ${buyer.wc_min}+ WC (imóvel tem ${seller.casas_banho})`,
    })
  }

  // 6. Área mínima
  if (buyer.area_min_m2 != null && buyer.area_min_m2 > 0) {
    if (seller.area_m2 == null) {
      out.push({
        type: 'info',
        key: 'area',
        label: `Pede ≥${buyer.area_min_m2} m² (sem área registada)`,
      })
    } else if (seller.area_m2 < buyer.area_min_m2) {
      out.push({
        type: 'warning',
        key: 'area',
        label: `Pede ≥${buyer.area_min_m2} m² (imóvel ${Math.round(seller.area_m2)} m²)`,
      })
    }
  }

  // 7. Estado do imóvel
  if (buyer.estado_imovel && seller.estado_imovel) {
    const wantedRank = condicaoToRank(buyer.estado_imovel)
    const actualRank = condicaoToRank(seller.estado_imovel)
    if (wantedRank != null && actualRank != null && actualRank > wantedRank) {
      out.push({
        type: 'warning',
        key: 'estado_imovel',
        label: `Quer ${buyer.estado_imovel} (imóvel está ${seller.estado_imovel})`,
      })
    }
  }

  // 8. Amenidades — comprador pede tem_X = true e o imóvel não tem
  for (const key of Object.keys(AMENITY_LABEL) as AmenityKey[]) {
    if (buyer.amenities[key] !== true) continue
    if (seller.amenities[key] === true) continue
    out.push({
      type: 'warning',
      key,
      label: `Pede ${AMENITY_LABEL[key]}`,
    })
  }

  return out
}

function formatK(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M€`
  if (n >= 1_000) return `${Math.round(n / 1_000)}k€`
  return `${Math.round(n)}€`
}
