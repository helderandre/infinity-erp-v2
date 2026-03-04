import type { AcquisitionFormData } from '@/lib/validations/acquisition'

// doc_types.id for "Cartão de Cidadão" (Proprietário category)
const DOC_TYPE_CC_ID = '16706cb5-1a27-413d-ad75-ec6aee1c3674'

/**
 * Maps negócio fields to acquisition form prefill data.
 * Used when starting an acquisition from a Venda negócio.
 */
export function mapNegocioToAcquisition(
  negocio: Record<string, unknown>
): Partial<AcquisitionFormData> {
  const tipo = negocio.tipo as string

  // For Compra e Venda, use _venda suffixed fields; for Venda, use base fields
  const isCompraVenda = tipo === 'Compra e Venda'

  const propertyType = (isCompraVenda ? negocio.tipo_imovel_venda : negocio.tipo_imovel) as string | undefined
  const preco = negocio.preco_venda as number | undefined
  const localizacao = (isCompraVenda ? negocio.localizacao_venda : negocio.localizacao) as string | undefined
  const estadoImovel = (isCompraVenda ? negocio.estado_imovel_venda : negocio.estado_imovel) as string | undefined
  const quartos = negocio.quartos as number | undefined
  const casasBanho = negocio.casas_banho as number | undefined
  const area = negocio.area_m2 as number | undefined
  const distrito = negocio.distrito as string | undefined
  const concelho = negocio.concelho as string | undefined
  const freguesia = negocio.freguesia as string | undefined
  const observacoes = negocio.observacoes as string | undefined

  // Parse location string to extract city
  let city = ''
  let zone = ''
  if (localizacao) {
    const parts = localizacao.split(',').map((s: string) => s.trim()).filter(Boolean)
    if (parts.length > 0) city = parts[0]
    if (parts.length > 1) zone = parts.slice(1).join(', ')
  }
  // Override with explicit fields if available
  if (concelho) city = concelho
  if (distrito && !zone) zone = distrito

  // Collect features from boolean amenity fields
  const features: string[] = []
  const amenityPrefix = isCompraVenda ? '_venda' : ''
  const amenityMap: Record<string, string> = {
    [`tem_elevador${amenityPrefix}`]: 'Elevador',
    [`tem_estacionamento${amenityPrefix}`]: 'Estacionamento',
    [`tem_garagem${amenityPrefix}`]: 'Garagem',
    [`tem_exterior${amenityPrefix}`]: 'Espaço Exterior',
    [`tem_varanda${amenityPrefix}`]: 'Varanda',
    [`tem_piscina${amenityPrefix}`]: 'Piscina',
    [`tem_porteiro${amenityPrefix}`]: 'Porteiro',
    [`tem_arrumos${amenityPrefix}`]: 'Arrumos',
  }

  for (const [field, label] of Object.entries(amenityMap)) {
    if (negocio[field]) features.push(label)
  }

  // Auto-generate title
  const typologyStr = quartos ? `T${quartos}` : ''
  const typeLabel = propertyType || 'Imóvel'
  const titleParts = [typeLabel, typologyStr, city ? `em ${city}` : ''].filter(Boolean)
  const title = titleParts.join(' ')

  // Map property condition
  const conditionMap: Record<string, string> = {
    'Novo': 'new',
    'Usado': 'used',
    'Em construção': 'under_construction',
    'Para remodelar': 'to_renovate',
    'Remodelado': 'renovated',
    'Em ruína': 'ruin',
  }

  const result: Partial<AcquisitionFormData> = {
    title: title.length >= 5 ? title : 'Rascunho',
    business_type: 'venda',
    listing_price: preco || 0,
    description: observacoes || '',
    city,
    zone,
    address_parish: freguesia || '',
  }

  if (propertyType) result.property_type = propertyType
  if (estadoImovel && conditionMap[estadoImovel]) {
    result.property_condition = conditionMap[estadoImovel]
  }

  // Specifications
  const specs: Record<string, any> = {}
  if (quartos) specs.bedrooms = quartos
  if (casasBanho) specs.bathrooms = casasBanho
  if (area) specs.area_util = area
  if (typologyStr) specs.typology = typologyStr
  if (features.length > 0) specs.features = features

  const hasElevator = isCompraVenda ? negocio.tem_elevador_venda : negocio.tem_elevador
  if (hasElevator) specs.has_elevator = true

  const hasParking = isCompraVenda ? negocio.tem_estacionamento_venda : negocio.tem_estacionamento
  if (hasParking) specs.parking_spaces = 1

  const hasGarage = isCompraVenda ? negocio.tem_garagem_venda : negocio.tem_garagem
  if (hasGarage) specs.garage_spaces = 1

  if (Object.keys(specs).length > 0) {
    result.specifications = specs as any
  }

  // Add lead contact as first owner (proprietário) if available
  const lead = negocio.lead as Record<string, unknown> | undefined
  if (lead) {
    const leadName = (lead.full_name as string) || (lead.nome as string) || ''
    const leadEmail = (lead.email as string) || ''
    const leadPhone = (lead.telemovel as string) || (lead.telefone as string) || ''
    const leadNif = (lead.nif as string) || ''
    const leadNacionalidade = (lead.nacionalidade as string) || ''
    const leadMorada = (lead.morada as string) || ''
    const leadDataNascimento = (lead.data_nascimento as string) || ''

    // Map lead document type to KYC form values
    const docTypeMap: Record<string, string> = {
      'CC': 'CC',
      'Cartão de Cidadão': 'CC',
      'Cartao de Cidadao': 'CC',
      'BI': 'BI',
      'Bilhete de Identidade': 'BI',
      'Passaporte': 'Passaporte',
      'Título de Residência': 'Titulo de Residencia',
      'Titulo de Residencia': 'Titulo de Residencia',
      'Outro': 'Outro',
    }

    const leadTipoDoc = (lead.tipo_documento as string) || ''
    const leadNumeroDoc = (lead.numero_documento as string) || ''
    const leadValidadeDoc = (lead.data_validade_documento as string) || ''
    const leadPaisEmissor = (lead.pais_emissor as string) || ''
    const mappedDocType = docTypeMap[leadTipoDoc] || (leadTipoDoc ? 'Outro' : '')

    if (leadName) {
      result.owners = [{
        person_type: 'singular' as const,
        name: leadName,
        email: leadEmail,
        phone: leadPhone,
        nif: leadNif,
        nationality: leadNacionalidade,
        address: leadMorada,
        ownership_percentage: 100,
        is_main_contact: true,
        is_pep: false,
        funds_origin: [],
        is_portugal_resident: true,
        country_of_incorporation: 'Portugal',
        beneficiaries: [],
        birth_date: leadDataNascimento,
        id_doc_type: mappedDocType,
        id_doc_number: leadNumeroDoc,
        id_doc_expiry: leadValidadeDoc,
        id_doc_issued_by: leadPaisEmissor,
      }]
    }

    // Pre-fill documents from lead's identification document URLs
    const docFrenteUrl = lead.documento_identificacao_frente_url as string | null
    const docUrl = lead.documento_identificacao_url as string | null
    const docVersoUrl = lead.documento_identificacao_verso_url as string | null
    const idDocUrl = docFrenteUrl || docUrl

    if (idDocUrl) {
      const documents: Array<{ doc_type_id: string; file_url: string; file_name: string; owner_index: number }> = []

      documents.push({
        doc_type_id: DOC_TYPE_CC_ID,
        file_url: idDocUrl,
        file_name: mappedDocType ? `${mappedDocType} - Frente` : 'Documento de Identificação - Frente',
        owner_index: 0,
      })

      if (docVersoUrl) {
        documents.push({
          doc_type_id: DOC_TYPE_CC_ID,
          file_url: docVersoUrl,
          file_name: mappedDocType ? `${mappedDocType} - Verso` : 'Documento de Identificação - Verso',
          owner_index: 0,
        })
      }

      result.documents = documents as any
    }
  }

  return result
}
