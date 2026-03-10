import type { FormFieldType, FormTargetEntity } from '@/types/subtask'

export interface FieldRegistryEntry {
  field_name: string
  label: string
  field_type: FormFieldType
  target_entity: FormTargetEntity
  /** Categoria para agrupar no picker */
  category: string
  /** Opções pré-definidas (para selects) */
  options?: { value: string; label: string }[]
  /** Nome da constante para resolver opções em runtime */
  options_from_constant?: string
  /** Placeholder sugerido */
  default_placeholder?: string
  /** Validação sugerida */
  suggested_min?: number
  suggested_max?: number
}

export const FIELD_REGISTRY: FieldRegistryEntry[] = [
  // ═══════════════════════════════════
  // IMÓVEL — dev_properties
  // ═══════════════════════════════════
  {
    field_name: 'title',
    label: 'Título do Anúncio',
    field_type: 'text',
    target_entity: 'property',
    category: 'Imóvel — Dados Gerais',
    default_placeholder: 'Ex: T3 renovado com terraço em Lisboa',
  },
  {
    field_name: 'description',
    label: 'Descrição',
    field_type: 'rich_text',
    target_entity: 'property',
    category: 'Imóvel — Dados Gerais',
  },
  {
    field_name: 'listing_price',
    label: 'Preço de Venda/Arrendamento',
    field_type: 'currency',
    target_entity: 'property',
    category: 'Imóvel — Dados Gerais',
    suggested_min: 0,
  },
  {
    field_name: 'property_type',
    label: 'Tipo de Imóvel',
    field_type: 'select',
    target_entity: 'property',
    category: 'Imóvel — Dados Gerais',
    options_from_constant: 'PROPERTY_TYPES',
  },
  {
    field_name: 'business_type',
    label: 'Tipo de Negócio',
    field_type: 'select',
    target_entity: 'property',
    category: 'Imóvel — Dados Gerais',
    options_from_constant: 'BUSINESS_TYPES',
  },
  {
    field_name: 'property_condition',
    label: 'Estado do Imóvel',
    field_type: 'select',
    target_entity: 'property',
    category: 'Imóvel — Dados Gerais',
    options_from_constant: 'PROPERTY_CONDITIONS',
  },
  {
    field_name: 'energy_certificate',
    label: 'Certificado Energético',
    field_type: 'select',
    target_entity: 'property',
    category: 'Imóvel — Dados Gerais',
    options_from_constant: 'ENERGY_CERTIFICATES',
  },
  {
    field_name: 'external_ref',
    label: 'Referência Externa',
    field_type: 'text',
    target_entity: 'property',
    category: 'Imóvel — Dados Gerais',
  },

  // ═══════════════════════════════════
  // IMÓVEL — Localização
  // ═══════════════════════════════════
  {
    field_name: 'location',
    label: 'Localização do Imóvel (Mapbox)',
    field_type: 'address_map',
    target_entity: 'property',
    category: 'Imóvel — Localização',
  },
  {
    field_name: 'city',
    label: 'Cidade',
    field_type: 'text',
    target_entity: 'property',
    category: 'Imóvel — Localização (Campos Individuais)',
  },
  {
    field_name: 'zone',
    label: 'Zona / Freguesia',
    field_type: 'text',
    target_entity: 'property',
    category: 'Imóvel — Localização (Campos Individuais)',
  },
  {
    field_name: 'address_street',
    label: 'Morada',
    field_type: 'text',
    target_entity: 'property',
    category: 'Imóvel — Localização (Campos Individuais)',
  },
  {
    field_name: 'postal_code',
    label: 'Código Postal',
    field_type: 'text',
    target_entity: 'property',
    category: 'Imóvel — Localização (Campos Individuais)',
    default_placeholder: '0000-000',
  },

  // ═══════════════════════════════════
  // IMÓVEL — Media
  // ═══════════════════════════════════
  {
    field_name: 'media',
    label: 'Fotografias do Imóvel',
    field_type: 'media_upload',
    target_entity: 'property',
    category: 'Imóvel — Media',
  },

  // ═══════════════════════════════════
  // ESPECIFICAÇÕES — dev_property_specifications
  // ═══════════════════════════════════
  {
    field_name: 'typology',
    label: 'Tipologia',
    field_type: 'select',
    target_entity: 'property_specs',
    category: 'Especificações',
    options_from_constant: 'TYPOLOGIES',
  },
  {
    field_name: 'bedrooms',
    label: 'Quartos',
    field_type: 'number',
    target_entity: 'property_specs',
    category: 'Especificações',
    suggested_min: 0,
  },
  {
    field_name: 'bathrooms',
    label: 'Casas de Banho',
    field_type: 'number',
    target_entity: 'property_specs',
    category: 'Especificações',
    suggested_min: 0,
  },
  {
    field_name: 'area_gross',
    label: 'Área Bruta (m²)',
    field_type: 'number',
    target_entity: 'property_specs',
    category: 'Especificações',
    suggested_min: 0,
  },
  {
    field_name: 'area_util',
    label: 'Área Útil (m²)',
    field_type: 'number',
    target_entity: 'property_specs',
    category: 'Especificações',
    suggested_min: 0,
  },
  {
    field_name: 'construction_year',
    label: 'Ano de Construção',
    field_type: 'number',
    target_entity: 'property_specs',
    category: 'Especificações',
    suggested_min: 1800,
    suggested_max: 2030,
  },
  {
    field_name: 'parking_spaces',
    label: 'Lugares de Estacionamento',
    field_type: 'number',
    target_entity: 'property_specs',
    category: 'Especificações',
    suggested_min: 0,
  },
  {
    field_name: 'has_elevator',
    label: 'Tem Elevador',
    field_type: 'checkbox',
    target_entity: 'property_specs',
    category: 'Especificações',
  },
  {
    field_name: 'solar_orientation',
    label: 'Orientação Solar',
    field_type: 'multiselect',
    target_entity: 'property_specs',
    category: 'Especificações',
    options_from_constant: 'SOLAR_ORIENTATIONS',
  },
  {
    field_name: 'views',
    label: 'Vistas',
    field_type: 'multiselect',
    target_entity: 'property_specs',
    category: 'Especificações',
    options_from_constant: 'VIEWS',
  },
  {
    field_name: 'equipment',
    label: 'Equipamento',
    field_type: 'multiselect',
    target_entity: 'property_specs',
    category: 'Especificações',
    options_from_constant: 'EQUIPMENT',
  },
  {
    field_name: 'features',
    label: 'Características',
    field_type: 'multiselect',
    target_entity: 'property_specs',
    category: 'Especificações',
    options_from_constant: 'FEATURES',
  },

  // ═══════════════════════════════════
  // DADOS INTERNOS — dev_property_internal
  // ═══════════════════════════════════
  {
    field_name: 'commission_agreed',
    label: 'Comissão Acordada',
    field_type: 'percentage',
    target_entity: 'property_internal',
    category: 'Contrato / Dados Internos',
    suggested_min: 0,
    suggested_max: 100,
  },
  {
    field_name: 'commission_type',
    label: 'Tipo de Comissão',
    field_type: 'select',
    target_entity: 'property_internal',
    category: 'Contrato / Dados Internos',
    options: [
      { value: 'percentage', label: 'Percentagem' },
      { value: 'fixed', label: 'Valor Fixo' },
    ],
  },
  {
    field_name: 'contract_regime',
    label: 'Regime de Contrato',
    field_type: 'select',
    target_entity: 'property_internal',
    category: 'Contrato / Dados Internos',
    options_from_constant: 'CONTRACT_REGIMES',
  },
  {
    field_name: 'contract_expiry',
    label: 'Data de Expiração do Contrato',
    field_type: 'date',
    target_entity: 'property_internal',
    category: 'Contrato / Dados Internos',
  },
  {
    field_name: 'imi_value',
    label: 'Valor IMI (€)',
    field_type: 'currency',
    target_entity: 'property_internal',
    category: 'Contrato / Dados Internos',
    suggested_min: 0,
  },
  {
    field_name: 'condominium_fee',
    label: 'Condomínio (€/mês)',
    field_type: 'currency',
    target_entity: 'property_internal',
    category: 'Contrato / Dados Internos',
    suggested_min: 0,
  },
  {
    field_name: 'internal_notes',
    label: 'Notas Internas',
    field_type: 'textarea',
    target_entity: 'property_internal',
    category: 'Contrato / Dados Internos',
  },

  // ═══════════════════════════════════
  // PROPRIETÁRIO — owners
  // ═══════════════════════════════════
  {
    field_name: 'name',
    label: 'Nome Completo',
    field_type: 'text',
    target_entity: 'owner',
    category: 'Proprietário — Identificação',
  },
  {
    field_name: 'email',
    label: 'Email',
    field_type: 'email',
    target_entity: 'owner',
    category: 'Proprietário — Identificação',
  },
  {
    field_name: 'phone',
    label: 'Telefone',
    field_type: 'phone',
    target_entity: 'owner',
    category: 'Proprietário — Identificação',
  },
  {
    field_name: 'nif',
    label: 'NIF',
    field_type: 'text',
    target_entity: 'owner',
    category: 'Proprietário — Identificação',
  },
  {
    field_name: 'nationality',
    label: 'Nacionalidade',
    field_type: 'text',
    target_entity: 'owner',
    category: 'Proprietário — Identificação',
  },
  {
    field_name: 'marital_status',
    label: 'Estado Civil',
    field_type: 'select',
    target_entity: 'owner',
    category: 'Proprietário — Identificação',
    options_from_constant: 'MARITAL_STATUS',
  },
  {
    field_name: 'address',
    label: 'Morada',
    field_type: 'textarea',
    target_entity: 'owner',
    category: 'Proprietário — Identificação',
  },
  {
    field_name: 'person_type',
    label: 'Tipo de Pessoa',
    field_type: 'select',
    target_entity: 'owner',
    category: 'Proprietário — Identificação',
    options: [
      { value: 'singular', label: 'Pessoa Singular' },
      { value: 'coletiva', label: 'Pessoa Colectiva' },
    ],
  },

  // ═══════════════════════════════════
  // PROPRIETÁRIO — Empresa (coletiva)
  // ═══════════════════════════════════
  {
    field_name: 'legal_representative_name',
    label: 'Nome do Representante Legal',
    field_type: 'text',
    target_entity: 'owner',
    category: 'Proprietário — Empresa',
  },
  {
    field_name: 'legal_representative_nif',
    label: 'NIF do Representante Legal',
    field_type: 'text',
    target_entity: 'owner',
    category: 'Proprietário — Empresa',
  },

  // ═══════════════════════════════════
  // JUNCTION — property_owners
  // ═══════════════════════════════════
  {
    field_name: 'ownership_percentage',
    label: 'Percentagem de Propriedade',
    field_type: 'percentage',
    target_entity: 'property_owner',
    category: 'Participação no Imóvel',
    suggested_min: 0,
    suggested_max: 100,
  },
  {
    field_name: 'is_main_contact',
    label: 'É Contacto Principal',
    field_type: 'checkbox',
    target_entity: 'property_owner',
    category: 'Participação no Imóvel',
  },
]

/**
 * Helper: agrupar campos por categoria para o picker.
 */
export function getFieldsByCategory(): Record<string, FieldRegistryEntry[]> {
  return FIELD_REGISTRY.reduce((acc, field) => {
    if (!acc[field.category]) acc[field.category] = []
    acc[field.category].push(field)
    return acc
  }, {} as Record<string, FieldRegistryEntry[]>)
}

/**
 * Helper: obter campo do registry por field_name + target_entity.
 */
export function getRegistryField(
  fieldName: string,
  targetEntity: FormTargetEntity
): FieldRegistryEntry | undefined {
  return FIELD_REGISTRY.find(
    (f) => f.field_name === fieldName && f.target_entity === targetEntity
  )
}
