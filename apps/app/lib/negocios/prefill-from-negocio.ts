/**
 * Helpers para construir prefill de formulários a partir de um row em
 * `negocios`. Reutilizado nos dois fluxos:
 *
 *  • Angariação (Venda / Arrendador) → AcquisitionFormV2.prefillData
 *    Mapeia specs do imóvel (tipo, preço, área, amenidades…) e seed do
 *    proprietário a partir do lead.
 *
 *  • Fecho (Compra / Arrendatário) → DealForm.propertyContext + clients[0]
 *    O cliente já está pré-preenchido via `negocioContext` (lead = comprador);
 *    aqui devolvemos o `propertyContext` quando o dossier tem 1 imóvel óbvio
 *    a fechar.
 */

import type { AcquisitionFormData } from '@/lib/validations/acquisition'

interface NegocioForPrefill {
  id: string
  tipo: string
  /** Pós-refactor 2026-06: business_type é coluna independente em `negocios`.
   *  Quando presente é a fonte autoritativa para decidir venda vs arrendamento;
   *  caso contrário (linhas legacy) inferimos a partir do `tipo`. */
  business_type?: string | null
  tipo_imovel?: string | null
  preco_venda?: number | null
  preco_venda_max?: number | null
  renda_pretendida?: number | null
  renda_max_mensal?: number | null
  orcamento?: number | null
  orcamento_max?: number | null
  localizacao?: string | null
  distrito?: string | null
  concelho?: string | null
  freguesia?: string | null
  quartos?: number | null
  quartos_min?: number | null
  area_m2?: number | null
  area_min_m2?: number | null
  estado_imovel?: string | null
  classe_imovel?: string | null
  observacoes?: string | null
  // Amenities (todas as colunas tem_*)
  tem_elevador?: boolean | null
  tem_estacionamento?: boolean | null
  tem_garagem?: boolean | null
  // Lead joined
  lead?: {
    id?: string
    nome?: string | null
    full_name?: string | null
    telemovel?: string | null
    telefone?: string | null
    email?: string | null
    nif?: string | null
    morada?: string | null
    cidade?: string | null
    codigo_postal?: string | null
  } | null
}

const FEATURE_FIELDS: Array<{ field: keyof NegocioForPrefill; label: string }> = [
  { field: 'tem_elevador', label: 'Elevador' },
  { field: 'tem_estacionamento', label: 'Estacionamento' },
  { field: 'tem_garagem', label: 'Garagem' },
  // Mantém-se intencionalmente curto — outras amenidades vivem em
  // colunas dedicadas em `dev_property_specifications` que o quick-fill da
  // angariação preenche.
]

/**
 * Contacto associado a uma oportunidade (linha de `negocio_contacts`, não-
 * titular) reduzido ao essencial para semear um proprietário/cliente.
 */
export interface PrefillParticipant {
  name: string
  email?: string | null
  phone?: string | null
  nif?: string | null
}

/** Converte a resposta de GET /api/crm/negocios/[id]/contactos em participantes
 *  prontos para prefill — exclui o titular (is_primary) e linhas sem nome. */
export function mapNegocioContactsToParticipants(rows: unknown[]): PrefillParticipant[] {
  return (rows ?? [])
    .map((row) => row as {
      is_primary?: boolean
      lead?: { nome?: string | null; full_name?: string | null; email?: string | null; telemovel?: string | null; telefone_fixo?: string | null; telefone?: string | null; nif?: string | null } | null
    })
    .filter((r) => !r.is_primary)
    .map((r) => {
      const l = r.lead || {}
      return {
        name: l.full_name || l.nome || '',
        email: l.email ?? null,
        phone: l.telemovel ?? l.telefone_fixo ?? l.telefone ?? null,
        nif: l.nif ?? null,
      }
    })
    .filter((p) => p.name.trim() !== '')
}

/** Divide 100% igualmente por `count` proprietários; o resto vai para o
 *  primeiro (o contacto principal). Ex.: 2 → [50,50], 3 → [34,33,33]. */
function splitOwnershipEqually(count: number): number[] {
  if (count <= 0) return []
  const base = Math.floor(100 / count)
  const out = Array(count).fill(base) as number[]
  out[0] += 100 - base * count
  return out
}

function makeSingularOwner(
  o: { name: string; email?: string | null; phone?: string | null; nif?: string | null; address?: string | null },
  ownershipPct: number,
  isMain: boolean,
) {
  return {
    person_type: 'singular' as const,
    name: o.name,
    email: o.email || '',
    phone: o.phone || '',
    nif: o.nif || '',
    nationality: '',
    naturality: '',
    marital_status: '',
    address: o.address || '',
    observations: '',
    ownership_percentage: ownershipPct,
    is_main_contact: isMain,
    is_pep: false,
    funds_origin: [],
    is_portugal_resident: true,
    country_of_incorporation: 'Portugal',
    beneficiaries: [],
  } as Record<string, unknown>
}

/**
 * Para Venda / Arrendador / Compra-e-Venda: gera prefillData para o
 * AcquisitionFormV2 a partir do negócio + lead (que é o proprietário).
 */
export function buildAcquisitionPrefillFromNegocio(
  negocio: NegocioForPrefill,
  /** Contactos associados à oportunidade (negocio_contacts não-titulares).
   *  Cada um vira um proprietário adicional; a propriedade é dividida em
   *  partes iguais entre todos (titular + associados). */
  participants: PrefillParticipant[] = [],
): Partial<AcquisitionFormData> {
  const tipo = negocio.tipo || ''
  // Pós-refactor: `tipo` passou a ser perspectiva ('Vendedor'/'Senhorio') e
  // `business_type` é coluna autoritativa. Aceita também os valores legacy
  // ('Venda'/'Arrendador') caso a row seja anterior à migração.
  const explicitBusinessType = (negocio.business_type || '').toLowerCase()
  const isArrendador =
    explicitBusinessType === 'arrendamento' ||
    tipo === 'Arrendador' || tipo === 'Senhorio'

  const businessType: 'venda' | 'arrendamento' = isArrendador ? 'arrendamento' : 'venda'

  const listingPrice = isArrendador
    ? negocio.renda_pretendida ?? negocio.renda_max_mensal ?? 0
    : negocio.preco_venda ?? negocio.preco_venda_max ?? 0

  // Construir título amigável (utilizador pode ajustar)
  const titleParts: string[] = []
  if (negocio.tipo_imovel) titleParts.push(negocio.tipo_imovel)
  const firstLocation = (negocio.localizacao || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)[0]
  if (firstLocation) titleParts.push(firstLocation)
  const title = titleParts.join(' em ') || 'Angariação'

  // Localização — usa primeiro chunk como cidade, resto como zona
  const locParts = (negocio.localizacao || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  const city = locParts[0] || negocio.concelho || ''
  const zone = locParts.slice(1).join(', ') || negocio.freguesia || ''

  // Proprietários = titular (lead) + contactos associados da oportunidade.
  // Dividem a propriedade em partes iguais; o titular é o contacto principal.
  const lead = negocio.lead
  const ownerName = lead?.full_name || lead?.nome || ''
  const ownerPhone = lead?.telemovel || lead?.telefone || ''

  const ownerSeeds: Array<{ name: string; email?: string | null; phone?: string | null; nif?: string | null; address?: string | null }> = []
  if (ownerName) {
    ownerSeeds.push({ name: ownerName, email: lead?.email, phone: ownerPhone, nif: lead?.nif, address: lead?.morada })
  }
  for (const p of participants) {
    if (!p.name?.trim()) continue
    ownerSeeds.push({ name: p.name, email: p.email, phone: p.phone, nif: p.nif })
  }
  const ownershipSplit = splitOwnershipEqually(ownerSeeds.length)
  const owners = ownerSeeds.map((o, i) => makeSingularOwner(o, ownershipSplit[i], i === 0))

  const prefill: Partial<AcquisitionFormData> = {
    title,
    property_type: negocio.tipo_imovel || '',
    business_type: businessType,
    listing_price: typeof listingPrice === 'number' && listingPrice > 0 ? listingPrice : 0,
    description: negocio.observacoes || '',
    property_condition: negocio.estado_imovel || '',
    city,
    zone,
    specifications: {
      typology: negocio.quartos != null ? `T${negocio.quartos}` : '',
      bedrooms: negocio.quartos ?? negocio.quartos_min ?? 0,
      bathrooms: 0,
      area_util: negocio.area_m2 ?? negocio.area_min_m2 ?? 0,
      area_gross: 0,
      construction_year: null,
      parking_spaces: 0,
      garage_spaces: 0,
      has_elevator: !!negocio.tem_elevador,
      features: FEATURE_FIELDS.filter((f) => !!(negocio as any)[f.field]).map((f) => f.label),
    },
    // Proprietários — titular + associados (partes iguais). Vazio se não
    // houver sequer nome; o schema exige min 1 e o user adiciona manualmente.
    owners: owners as any,
  }

  return prefill
}

/**
 * Para Compra / Arrendatário: devolve `propertyContext` para o DealForm
 * derivado do dossier (quando há um imóvel óbvio) + flag de business_type.
 *
 * Aceita `dossierProperty` opcional — quando o caller já tem o imóvel a
 * fechar identificado (ex.: vindo de aceitar uma proposta), passa-o
 * directamente.
 */
export function buildDealPropertyContextFromNegocio(
  negocio: NegocioForPrefill,
  dossierProperty?: {
    id: string
    title: string | null
    external_ref: string | null
    listing_price: number | null
    city: string | null
    business_type: string | null
  } | null,
): {
  propertyContext: {
    id: string
    title: string
    external_ref?: string | null
    business_type?: string | null
    listing_price?: number | null
    city?: string | null
  } | undefined
  businessType: 'venda' | 'arrendamento'
} {
  const tipo = negocio.tipo || ''
  const isArrendatario = tipo === 'Arrendatário'
  const businessType: 'venda' | 'arrendamento' = isArrendatario ? 'arrendamento' : 'venda'

  if (!dossierProperty) {
    return { propertyContext: undefined, businessType }
  }

  return {
    propertyContext: {
      id: dossierProperty.id,
      title: dossierProperty.title || 'Imóvel',
      external_ref: dossierProperty.external_ref ?? null,
      business_type: dossierProperty.business_type ?? businessType,
      listing_price:
        dossierProperty.listing_price ??
        negocio.orcamento_max ??
        negocio.orcamento ??
        null,
      city: dossierProperty.city ?? null,
    },
    businessType,
  }
}
