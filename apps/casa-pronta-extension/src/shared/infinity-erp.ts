import { getSupabase } from './supabase'
import type { CasaProntaPayload, NegocioResumo, Pessoa, Requerente } from './types'

/**
 * Queries reais ao Supabase do Infinity ERP.
 *
 * Fluxo:
 *  1. fetchNegocios()        — lista `deals` elegíveis (status active/draft, não reportados ao IMPIC)
 *  2. fetchNegocioPayload()  — constrói o CasaProntaPayload completo para um deal
 *     agregando: deal + property + legal_data + owners + deal_compliance + deal_clients
 *
 * Requerente = utilizador MUBE autenticado (consultor), obtido de:
 *  dev_users + dev_consultant_profiles + dev_consultant_private_data
 */

// ---------- Tipos das linhas da BD (subset do que precisamos) ----------

interface DealRow {
  id: string
  reference: string | null
  pv_number: string | null
  status: string | null
  deal_value: number
  deal_date: string | null
  business_type: string | null
  contract_signing_date: string | null
  property_id: string | null
}

interface PropertyRow {
  id: string
  title: string | null
  address_street: string | null
  city: string | null
  zone: string | null
  address_parish: string | null
  property_type: string | null
}

interface LegalDataRow {
  descricao_ficha: string | null
  descricao_ficha_ano: number | null
  fracao_autonoma: string | null
  artigo_matricial: string | null
  distrito: string | null
  concelho: string | null
  freguesia: string | null
  quota_parte: string | null
}

interface SpecsRow {
  area_gross: number | null
  area_util: number | null
}

interface PropertyInternalRow {
  exact_address: string | null
}

interface DealComplianceRow {
  buyer_name: string | null
  buyer_nif: string | null
  seller_name: string | null
  seller_nif: string | null
  impic_reported: boolean | null
}

interface DealClientRow {
  name: string
  order_index: number | null
}

interface OwnerJoinRow {
  is_main_contact: boolean | null
  ownership_percentage: number | null
  // PostgREST devolve a relação M:1 como array (mesmo sendo um só elemento)
  owners:
    | {
        name: string
        nif: string | null
      }
    | Array<{
        name: string
        nif: string | null
      }>
    | null
}

// ---------- Mapeamentos ----------

function propertyTypeToDestino(type: string | null): 'habitacao' | 'comercio' | 'industria' | 'outro' {
  if (!type) return 'habitacao'
  const t = type.toLowerCase()
  if (/(apartamento|moradia|t\d|duplex|estudio|habita)/.test(t)) return 'habitacao'
  if (/(loja|escritorio|comercio|armazem|restaurante)/.test(t)) return 'comercio'
  if (/(fabrica|industria|armazém industrial)/.test(t)) return 'industria'
  if (/(terreno|lote|garagem|estacionamento)/.test(t)) return 'outro'
  return 'habitacao'
}

/**
 * Determina a data previsível do negócio.
 * Ordem: contract_signing_date → deal_date → hoje+30 dias.
 */
function determineDataPrevista(deal: DealRow): string {
  if (deal.contract_signing_date) return deal.contract_signing_date
  if (deal.deal_date) return deal.deal_date
  const d = new Date()
  d.setDate(d.getDate() + 30)
  return d.toISOString().slice(0, 10)
}

// ---------- Requerente (consultor autenticado) ----------

export async function fetchRequerente(): Promise<Requerente | null> {
  const supabase = getSupabase()
  const { data: userRes } = await supabase.auth.getUser()
  if (!userRes.user) return null

  const { data, error } = await supabase
    .from('dev_users')
    .select(
      `
      id,
      commercial_name,
      professional_email,
      dev_consultant_profiles ( phone_commercial ),
      dev_consultant_private_data ( full_name, nif, address_private, postal_code, city )
      `
    )
    .eq('id', userRes.user.id)
    .single()

  if (error || !data) {
    console.warn('[MUBE] dev_users não encontrado para auth.uid:', error?.message)
    return null
  }

  const profile = Array.isArray(data.dev_consultant_profiles)
    ? data.dev_consultant_profiles[0]
    : data.dev_consultant_profiles
  const priv = Array.isArray(data.dev_consultant_private_data)
    ? data.dev_consultant_private_data[0]
    : data.dev_consultant_private_data

  // Por decisão do utilizador: usar sempre o NOME PESSOAL do consultor
  const nome = priv?.full_name || data.commercial_name || ''
  const nif = priv?.nif || ''
  const email = data.professional_email || userRes.user.email || ''
  const telefone = profile?.phone_commercial || ''

  // Constrói endereço a partir dos campos privados
  const enderecoPartes = [priv?.address_private, priv?.postal_code, priv?.city].filter(Boolean)
  const endereco = enderecoPartes.join(', ')

  return { nome, nif, email, telefone, endereco }
}

// ---------- Listagem de negócios ----------

export async function fetchNegocios(): Promise<NegocioResumo[]> {
  const supabase = getSupabase()

  const { data, error } = await supabase
    .from('deals')
    .select(
      `
      id,
      reference,
      pv_number,
      status,
      deal_value,
      property_id,
      dev_properties ( title, address_street, city, zone, address_parish ),
      deal_compliance ( buyer_name, seller_name, impic_reported ),
      deal_clients ( name, order_index )
      `
    )
    .in('status', ['active', 'draft'])
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[MUBE] erro a buscar deals:', error)
    throw new Error(`Erro a carregar negócios: ${error.message}`)
  }

  if (!data) return []

  // Filtra os já reportados ao IMPIC
  const filtered = data.filter((d) => {
    const comp = Array.isArray(d.deal_compliance) ? d.deal_compliance[0] : d.deal_compliance
    return !comp?.impic_reported
  })

  return filtered.map((d): NegocioResumo => {
    const property = Array.isArray(d.dev_properties) ? d.dev_properties[0] : d.dev_properties
    const comp = Array.isArray(d.deal_compliance) ? d.deal_compliance[0] : d.deal_compliance
    const clients = Array.isArray(d.deal_clients)
      ? [...d.deal_clients].sort(
          (a, b) => (a.order_index ?? 0) - (b.order_index ?? 0)
        )
      : []

    const buyer = comp?.buyer_name || clients[0]?.name || null

    // Morada do imóvel (com fallback)
    const addressParts = [
      (property as PropertyRow | null)?.address_street,
      (property as PropertyRow | null)?.city,
    ].filter(Boolean)
    const address = addressParts.length > 0 ? addressParts.join(', ') : null

    return {
      id: d.id,
      referencia: d.reference || d.pv_number || d.id.slice(0, 8).toUpperCase(),
      estado: d.status || 'unknown',
      vendedor_nome: comp?.seller_name || null,
      comprador_nome: buyer,
      imovel_endereco: address,
      preco: d.deal_value ?? null,
    }
  })
}

// ---------- Payload completo ----------

export async function fetchNegocioPayload(
  negocioId: string
): Promise<CasaProntaPayload | null> {
  const supabase = getSupabase()

  // 1) Deal + embedded relations
  const { data: deal, error: dealErr } = await supabase
    .from('deals')
    .select(
      `
      id,
      reference,
      pv_number,
      status,
      deal_value,
      deal_date,
      business_type,
      contract_signing_date,
      property_id,
      dev_properties (
        id,
        title,
        address_street,
        city,
        zone,
        address_parish,
        property_type,
        dev_property_specifications ( area_gross, area_util ),
        dev_property_internal ( exact_address ),
        dev_property_legal_data (
          descricao_ficha, descricao_ficha_ano, fracao_autonoma,
          artigo_matricial, distrito, concelho, freguesia, quota_parte
        )
      ),
      deal_compliance ( buyer_name, buyer_nif, seller_name, seller_nif, impic_reported ),
      deal_clients ( name, order_index )
      `
    )
    .eq('id', negocioId)
    .single()

  if (dealErr || !deal) {
    console.error('[MUBE] erro a buscar deal:', dealErr)
    return null
  }

  const property = (Array.isArray(deal.dev_properties) ? deal.dev_properties[0] : deal.dev_properties) as
    | (PropertyRow & {
        dev_property_specifications: SpecsRow | SpecsRow[] | null
        dev_property_internal: PropertyInternalRow | PropertyInternalRow[] | null
        dev_property_legal_data: LegalDataRow | LegalDataRow[] | null
      })
    | null

  const specs = property?.dev_property_specifications
    ? Array.isArray(property.dev_property_specifications)
      ? property.dev_property_specifications[0]
      : property.dev_property_specifications
    : null

  const internal = property?.dev_property_internal
    ? Array.isArray(property.dev_property_internal)
      ? property.dev_property_internal[0]
      : property.dev_property_internal
    : null

  const legal = property?.dev_property_legal_data
    ? Array.isArray(property.dev_property_legal_data)
      ? property.dev_property_legal_data[0]
      : property.dev_property_legal_data
    : null

  const compliance = (Array.isArray(deal.deal_compliance)
    ? deal.deal_compliance[0]
    : deal.deal_compliance) as DealComplianceRow | null

  // 2) Vendedores via owners (por decisão: preferir owners)
  let vendedores: Pessoa[] = []
  if (property?.id) {
    const { data: ownerRows } = await supabase
      .from('property_owners')
      .select('is_main_contact, ownership_percentage, owners ( name, nif )')
      .eq('property_id', property.id)
      .order('is_main_contact', { ascending: false })
      .order('ownership_percentage', { ascending: false })

    if (ownerRows) {
      vendedores = (ownerRows as unknown as OwnerJoinRow[])
        .map((r) => {
          const o = Array.isArray(r.owners) ? r.owners[0] : r.owners
          return o && o.name ? { nome: o.name, nif: o.nif || '' } : null
        })
        .filter((p): p is Pessoa => p !== null)
    }
  }
  // Fallback para deal_compliance se não houver owners
  if (vendedores.length === 0 && compliance?.seller_name) {
    vendedores.push({
      nome: compliance.seller_name,
      nif: compliance.seller_nif || '',
    })
  }

  // 3) Compradores: preferir deal_compliance (tem NIF), fallback deal_clients
  let compradores: Pessoa[] = []
  if (compliance?.buyer_name) {
    compradores.push({
      nome: compliance.buyer_name,
      nif: compliance.buyer_nif || '',
    })
  } else if (deal.deal_clients && Array.isArray(deal.deal_clients)) {
    const clients = [...(deal.deal_clients as DealClientRow[])].sort(
      (a, b) => (a.order_index ?? 0) - (b.order_index ?? 0)
    )
    compradores = clients.map((c) => ({ nome: c.name, nif: '' }))
  }

  // 4) Requerente (consultor autenticado)
  const requerente = (await fetchRequerente()) ?? {
    nome: '',
    nif: '',
    email: '',
    telefone: '',
    endereco: '',
  }

  // 5) Construir payload final
  const dealRow = deal as unknown as DealRow
  const areaBruta = specs?.area_gross ?? 0
  const areaUtil = specs?.area_util ?? undefined

  // Descrição em Ficha pode vir com ano (ex: "12345/2015") — concatena se ambos existirem
  let descricaoFicha = legal?.descricao_ficha ?? ''
  if (legal?.descricao_ficha && legal?.descricao_ficha_ano) {
    descricaoFicha = `${legal.descricao_ficha}/${legal.descricao_ficha_ano}`
  }

  const payload: CasaProntaPayload = {
    requerente,
    vendedores,
    compradores,
    imovel: {
      descricao_ficha: descricaoFicha,
      artigo_matricial: legal?.artigo_matricial ?? '',
      quota_parte: legal?.quota_parte ?? undefined,
      fracao_autonoma: legal?.fracao_autonoma ?? undefined,
      area_bruta_privativa: Number(areaBruta) || 0,
      unidade_medida: 'm2',
      area_total: areaUtil != null ? Number(areaUtil) : undefined,
      unidade_medida_total: areaUtil != null ? 'm2' : undefined,
      arrendado: false, // TODO: adicionar campo a deals/property se necessário
      destino: propertyTypeToDestino(property?.property_type ?? null),
      endereco:
        internal?.exact_address ||
        property?.address_street ||
        '',
      distrito: legal?.distrito ?? '',
      concelho: legal?.concelho ?? property?.city ?? '',
      freguesia: legal?.freguesia ?? property?.address_parish ?? '',
    },
    transmissao: {
      tipo_negocio: 'compra_venda',
      preco: Number(dealRow.deal_value) || 0,
      moeda: 'EUR',
      data_prevista: determineDataPrevista(dealRow),
    },
  }

  return payload
}
