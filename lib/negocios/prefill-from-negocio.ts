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
 * Para Venda / Arrendador / Compra-e-Venda: gera prefillData para o
 * AcquisitionFormV2 a partir do negócio + lead (que é o proprietário).
 */
export function buildAcquisitionPrefillFromNegocio(
  negocio: NegocioForPrefill,
): Partial<AcquisitionFormData> {
  const tipo = negocio.tipo || ''
  const isArrendador = tipo === 'Arrendador'

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

  // Owner = lead
  const lead = negocio.lead
  const ownerName = lead?.full_name || lead?.nome || ''
  const ownerPhone = lead?.telemovel || lead?.telefone || ''

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
    // Owner seed — só semeamos se tiver pelo menos nome.
    // Se não houver, o user adiciona manualmente (o schema exige min 1).
    owners: ownerName
      ? ([
          {
            person_type: 'singular' as const,
            name: ownerName,
            email: lead?.email || '',
            phone: ownerPhone,
            nif: lead?.nif || '',
            nationality: '',
            naturality: '',
            marital_status: '',
            address: lead?.morada || '',
            observations: '',
            ownership_percentage: 100,
            is_main_contact: true,
            is_pep: false,
            funds_origin: [],
            is_portugal_resident: true,
            country_of_incorporation: 'Portugal',
            beneficiaries: [],
          } as any,
        ])
      : [],
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
