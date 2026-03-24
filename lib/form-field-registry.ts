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
  {
    field_name: 'link_portal_remax',
    label: 'Link Portal RE/MAX',
    field_type: 'link_external',
    target_entity: 'property',
    category: 'Imóvel — Dados Gerais',
    default_placeholder: 'https://www.remax.pt/...',
  },
  {
    field_name: 'link_portal_idealista',
    label: 'Link Portal Idealista',
    field_type: 'link_external',
    target_entity: 'property',
    category: 'Imóvel — Dados Gerais',
    default_placeholder: 'https://www.idealista.pt/...',
  },
  {
    field_name: 'link_portal_imovirtual',
    label: 'Link Portal Imovirtual',
    field_type: 'link_external',
    target_entity: 'property',
    category: 'Imóvel — Dados Gerais',
    default_placeholder: 'https://www.imovirtual.com/...',
  },
  {
    field_name: 'notas_juridico_convictus',
    label: 'Notas Jurídico Convictus',
    field_type: 'rich_text',
    target_entity: 'property',
    category: 'Imóvel — Dados Gerais',
  },
  {
    field_name: 'remax_published_date',
    label: 'Data de Publicação RE/MAX',
    field_type: 'date',
    target_entity: 'property',
    category: 'Imóvel — Dados Gerais',
  },
  {
    field_name: 'status',
    label: 'Estado do Imóvel',
    field_type: 'select',
    target_entity: 'property',
    category: 'Imóvel — Dados Gerais',
    options_from_constant: 'PROPERTY_STATUS',
  },
  {
    field_name: 'business_status',
    label: 'Estado de Publicação',
    field_type: 'select',
    target_entity: 'property',
    category: 'Imóvel — Dados Gerais',
    options_from_constant: 'PROPERTY_STATUS',
  },
  {
    field_name: 'contract_regime',
    label: 'Regime de Contrato (Imóvel)',
    field_type: 'select',
    target_entity: 'property',
    category: 'Imóvel — Dados Gerais',
    options_from_constant: 'CONTRACT_REGIMES',
  },
  {
    field_name: 'slug',
    label: 'Slug (URL)',
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
  {
    field_name: 'address_parish',
    label: 'Freguesia',
    field_type: 'text',
    target_entity: 'property',
    category: 'Imóvel — Localização (Campos Individuais)',
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
    field_name: 'garage_spaces',
    label: 'Lugares de Garagem',
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
    field_name: 'fronts_count',
    label: 'Número de Frentes',
    field_type: 'number',
    target_entity: 'property_specs',
    category: 'Especificações',
    suggested_min: 0,
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
  {
    field_name: 'storage_area',
    label: 'Área de Arrecadação (m²)',
    field_type: 'number',
    target_entity: 'property_specs',
    category: 'Especificações — Áreas',
    suggested_min: 0,
  },
  {
    field_name: 'balcony_area',
    label: 'Área de Varanda (m²)',
    field_type: 'number',
    target_entity: 'property_specs',
    category: 'Especificações — Áreas',
    suggested_min: 0,
  },
  {
    field_name: 'pool_area',
    label: 'Área de Piscina (m²)',
    field_type: 'number',
    target_entity: 'property_specs',
    category: 'Especificações — Áreas',
    suggested_min: 0,
  },
  {
    field_name: 'attic_area',
    label: 'Área do Sótão (m²)',
    field_type: 'number',
    target_entity: 'property_specs',
    category: 'Especificações — Áreas',
    suggested_min: 0,
  },
  {
    field_name: 'pantry_area',
    label: 'Área da Despensa (m²)',
    field_type: 'number',
    target_entity: 'property_specs',
    category: 'Especificações — Áreas',
    suggested_min: 0,
  },
  {
    field_name: 'gym_area',
    label: 'Área do Ginásio (m²)',
    field_type: 'number',
    target_entity: 'property_specs',
    category: 'Especificações — Áreas',
    suggested_min: 0,
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
  {
    field_name: 'cpcv_percentage',
    label: 'Percentagem CPCV',
    field_type: 'percentage',
    target_entity: 'property_internal',
    category: 'Contrato / Dados Internos',
    suggested_min: 0,
    suggested_max: 100,
  },
  {
    field_name: 'contract_term',
    label: 'Prazo do Contrato',
    field_type: 'text',
    target_entity: 'property_internal',
    category: 'Contrato / Dados Internos',
  },
  {
    field_name: 'reference_internal',
    label: 'Referência Interna',
    field_type: 'text',
    target_entity: 'property_internal',
    category: 'Contrato / Dados Internos',
  },
  {
    field_name: 'exact_address',
    label: 'Morada Exacta (Interna)',
    field_type: 'text',
    target_entity: 'property_internal',
    category: 'Contrato / Dados Internos',
  },
  {
    field_name: 'listing_links',
    label: 'Links de Anúncios',
    field_type: 'link_external',
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

  // ═══════════════════════════════════
  // CONSULTOR — dev_users + dev_consultant_profiles
  // ═══════════════════════════════════
  {
    field_name: 'commercial_name',
    label: 'Nome Comercial',
    field_type: 'text',
    target_entity: 'consultant',
    category: 'Consultor',
  },
  {
    field_name: 'professional_email',
    label: 'Email Profissional',
    field_type: 'email',
    target_entity: 'consultant',
    category: 'Consultor',
  },
  {
    field_name: 'phone_commercial',
    label: 'Telemóvel Comercial',
    field_type: 'phone',
    target_entity: 'consultant',
    category: 'Consultor',
  },
  {
    field_name: 'bio',
    label: 'Bio',
    field_type: 'textarea',
    target_entity: 'consultant',
    category: 'Consultor',
  },
  {
    field_name: 'specializations',
    label: 'Especializações',
    field_type: 'text',
    target_entity: 'consultant',
    category: 'Consultor',
  },
  {
    field_name: 'languages',
    label: 'Idiomas',
    field_type: 'text',
    target_entity: 'consultant',
    category: 'Consultor',
  },
  {
    field_name: 'instagram_handle',
    label: 'Instagram',
    field_type: 'text',
    target_entity: 'consultant',
    category: 'Consultor — Redes Sociais',
  },
  {
    field_name: 'linkedin_url',
    label: 'LinkedIn',
    field_type: 'text',
    target_entity: 'consultant',
    category: 'Consultor — Redes Sociais',
  },

  // ═══════════════════════════════════
  // NEGÓCIO (DEAL) — deals
  // ═══════════════════════════════════
  {
    field_name: 'reference',
    label: 'Referência do Negócio',
    field_type: 'text',
    target_entity: 'deal',
    category: 'Negócio — Identificação',
  },
  {
    field_name: 'pv_number',
    label: 'Número PV',
    field_type: 'text',
    target_entity: 'deal',
    category: 'Negócio — Identificação',
  },
  {
    field_name: 'remax_draft_number',
    label: 'Número Draft RE/MAX',
    field_type: 'text',
    target_entity: 'property',
    category: 'Imóvel — Dados Gerais',
  },
  {
    field_name: 'status',
    label: 'Estado do Negócio',
    field_type: 'select',
    target_entity: 'deal',
    category: 'Negócio — Identificação',
    options: [
      { value: 'draft', label: 'Rascunho' },
      { value: 'submitted', label: 'Submetido' },
      { value: 'active', label: 'Activo' },
      { value: 'completed', label: 'Concluído' },
      { value: 'cancelled', label: 'Cancelado' },
    ],
  },
  {
    field_name: 'deal_date',
    label: 'Data do Negócio',
    field_type: 'date',
    target_entity: 'deal',
    category: 'Negócio — Identificação',
  },

  // Negócio — Tipo e Cenário
  {
    field_name: 'deal_type',
    label: 'Cenário do Negócio',
    field_type: 'select',
    target_entity: 'deal',
    category: 'Negócio — Tipo e Cenário',
    options: [
      { value: 'pleno', label: 'Pleno' },
      { value: 'comprador_externo', label: 'Comprador Externo' },
      { value: 'pleno_agencia', label: 'Pleno de Agência' },
      { value: 'angariacao_externa', label: 'Angariação Externa' },
    ],
  },
  {
    field_name: 'business_type',
    label: 'Tipo de Negócio',
    field_type: 'select',
    target_entity: 'deal',
    category: 'Negócio — Tipo e Cenário',
    options: [
      { value: 'venda', label: 'Venda' },
      { value: 'arrendamento', label: 'Arrendamento' },
      { value: 'trespasse', label: 'Trespasse' },
    ],
  },

  // Negócio — Valores
  {
    field_name: 'deal_value',
    label: 'Valor do Negócio',
    field_type: 'currency',
    target_entity: 'deal',
    category: 'Negócio — Valores',
    suggested_min: 0,
  },
  {
    field_name: 'deposit_value',
    label: 'Valor do Sinal',
    field_type: 'currency',
    target_entity: 'deal',
    category: 'Negócio — Valores',
    suggested_min: 0,
  },

  // Negócio — Comissão
  {
    field_name: 'commission_type',
    label: 'Tipo de Comissão',
    field_type: 'select',
    target_entity: 'deal',
    category: 'Negócio — Comissão',
    options: [
      { value: 'percentage', label: 'Percentagem' },
      { value: 'fixed', label: 'Valor Fixo' },
    ],
  },
  {
    field_name: 'commission_pct',
    label: 'Comissão (%)',
    field_type: 'percentage',
    target_entity: 'deal',
    category: 'Negócio — Comissão',
    suggested_min: 0,
    suggested_max: 100,
  },
  {
    field_name: 'commission_total',
    label: 'Comissão Total (€)',
    field_type: 'currency',
    target_entity: 'deal',
    category: 'Negócio — Comissão',
    suggested_min: 0,
  },
  {
    field_name: 'consultant_pct',
    label: 'Percentagem do Consultor (%)',
    field_type: 'percentage',
    target_entity: 'deal',
    category: 'Negócio — Comissão',
    suggested_min: 0,
    suggested_max: 100,
  },
  {
    field_name: 'consultant_amount',
    label: 'Valor do Consultor (€)',
    field_type: 'currency',
    target_entity: 'deal',
    category: 'Negócio — Comissão',
    suggested_min: 0,
  },
  {
    field_name: 'agency_margin',
    label: 'Margem da Agência (€)',
    field_type: 'currency',
    target_entity: 'deal',
    category: 'Negócio — Comissão',
    suggested_min: 0,
  },
  {
    field_name: 'agency_net',
    label: 'Agência Líquido (€)',
    field_type: 'currency',
    target_entity: 'deal',
    category: 'Negócio — Comissão',
    suggested_min: 0,
  },

  // Negócio — Partilha
  {
    field_name: 'has_share',
    label: 'Tem Partilha',
    field_type: 'checkbox',
    target_entity: 'deal',
    category: 'Negócio — Partilha',
  },
  {
    field_name: 'share_type',
    label: 'Tipo de Partilha',
    field_type: 'select',
    target_entity: 'deal',
    category: 'Negócio — Partilha',
    options: [
      { value: 'internal', label: 'Interna' },
      { value: 'external', label: 'Externa' },
      { value: 'network', label: 'Rede' },
      { value: 'external_buyer', label: 'Comprador Externo' },
      { value: 'internal_agency', label: 'Agência Interna' },
      { value: 'external_agency', label: 'Agência Externa' },
    ],
  },
  {
    field_name: 'share_pct',
    label: 'Partilha (%)',
    field_type: 'percentage',
    target_entity: 'deal',
    category: 'Negócio — Partilha',
    suggested_min: 0,
    suggested_max: 100,
  },
  {
    field_name: 'share_amount',
    label: 'Valor da Partilha (€)',
    field_type: 'currency',
    target_entity: 'deal',
    category: 'Negócio — Partilha',
    suggested_min: 0,
  },
  {
    field_name: 'share_notes',
    label: 'Notas da Partilha',
    field_type: 'textarea',
    target_entity: 'deal',
    category: 'Negócio — Partilha',
  },
  {
    field_name: 'partner_agency_name',
    label: 'Nome da Agência Parceira',
    field_type: 'text',
    target_entity: 'deal',
    category: 'Negócio — Partilha',
  },
  {
    field_name: 'partner_contact',
    label: 'Contacto do Parceiro',
    field_type: 'text',
    target_entity: 'deal',
    category: 'Negócio — Partilha',
  },
  {
    field_name: 'partner_amount',
    label: 'Valor do Parceiro (€)',
    field_type: 'currency',
    target_entity: 'deal',
    category: 'Negócio — Partilha',
    suggested_min: 0,
  },
  {
    field_name: 'network_pct',
    label: 'Rede (%)',
    field_type: 'percentage',
    target_entity: 'deal',
    category: 'Negócio — Partilha',
    suggested_min: 0,
    suggested_max: 100,
  },
  {
    field_name: 'network_amount',
    label: 'Valor da Rede (€)',
    field_type: 'currency',
    target_entity: 'deal',
    category: 'Negócio — Partilha',
    suggested_min: 0,
  },

  // Negócio — Consultor Externo
  {
    field_name: 'external_consultant_name',
    label: 'Nome do Consultor Externo',
    field_type: 'text',
    target_entity: 'deal',
    category: 'Negócio — Consultor Externo',
  },
  {
    field_name: 'external_consultant_phone',
    label: 'Telemóvel do Consultor Externo',
    field_type: 'phone',
    target_entity: 'deal',
    category: 'Negócio — Consultor Externo',
  },
  {
    field_name: 'external_consultant_email',
    label: 'Email do Consultor Externo',
    field_type: 'email',
    target_entity: 'deal',
    category: 'Negócio — Consultor Externo',
  },

  // Negócio — Imóvel Externo
  {
    field_name: 'external_property_link',
    label: 'Link do Imóvel Externo',
    field_type: 'text',
    target_entity: 'deal',
    category: 'Negócio — Imóvel Externo',
    default_placeholder: 'https://...',
  },
  {
    field_name: 'external_property_id',
    label: 'ID do Imóvel Externo',
    field_type: 'text',
    target_entity: 'deal',
    category: 'Negócio — Imóvel Externo',
  },
  {
    field_name: 'external_property_type',
    label: 'Tipo do Imóvel Externo',
    field_type: 'select',
    target_entity: 'deal',
    category: 'Negócio — Imóvel Externo',
    options_from_constant: 'PROPERTY_TYPES',
  },
  {
    field_name: 'external_property_typology',
    label: 'Tipologia do Imóvel Externo',
    field_type: 'select',
    target_entity: 'deal',
    category: 'Negócio — Imóvel Externo',
    options_from_constant: 'TYPOLOGIES',
  },
  {
    field_name: 'external_property_zone',
    label: 'Zona do Imóvel Externo',
    field_type: 'text',
    target_entity: 'deal',
    category: 'Negócio — Imóvel Externo',
  },
  {
    field_name: 'external_property_construction_year',
    label: 'Ano Construção (Imóvel Externo)',
    field_type: 'text',
    target_entity: 'deal',
    category: 'Negócio — Imóvel Externo',
  },
  {
    field_name: 'external_property_extra',
    label: 'Informações Extra (Imóvel Externo)',
    field_type: 'textarea',
    target_entity: 'deal',
    category: 'Negócio — Imóvel Externo',
  },

  // Negócio — Pagamentos
  {
    field_name: 'payment_structure',
    label: 'Estrutura de Pagamento',
    field_type: 'select',
    target_entity: 'deal',
    category: 'Negócio — Pagamentos',
    options: [
      { value: 'cpcv_only', label: '100% no CPCV' },
      { value: 'escritura_only', label: '100% na Escritura' },
      { value: 'split', label: 'Split CPCV / Escritura' },
      { value: 'single', label: 'Momento Único' },
    ],
  },
  {
    field_name: 'cpcv_pct',
    label: 'CPCV (%)',
    field_type: 'percentage',
    target_entity: 'deal',
    category: 'Negócio — Pagamentos',
    suggested_min: 0,
    suggested_max: 100,
  },
  {
    field_name: 'escritura_pct',
    label: 'Escritura (%)',
    field_type: 'percentage',
    target_entity: 'deal',
    category: 'Negócio — Pagamentos',
    suggested_min: 0,
    suggested_max: 100,
  },

  // Negócio — Condições
  {
    field_name: 'contract_signing_date',
    label: 'Data de Assinatura do Contrato',
    field_type: 'date',
    target_entity: 'deal',
    category: 'Negócio — Condições',
  },
  {
    field_name: 'max_deadline',
    label: 'Prazo Máximo',
    field_type: 'date',
    target_entity: 'deal',
    category: 'Negócio — Condições',
  },
  {
    field_name: 'conditions_notes',
    label: 'Notas de Condições',
    field_type: 'textarea',
    target_entity: 'deal',
    category: 'Negócio — Condições',
  },

  // Negócio — Extra
  {
    field_name: 'has_guarantor',
    label: 'Tem Fiador',
    field_type: 'checkbox',
    target_entity: 'deal',
    category: 'Negócio — Extra',
  },
  {
    field_name: 'has_furniture',
    label: 'Tem Mobília',
    field_type: 'checkbox',
    target_entity: 'deal',
    category: 'Negócio — Extra',
  },
  {
    field_name: 'is_bilingual',
    label: 'Bilingue',
    field_type: 'checkbox',
    target_entity: 'deal',
    category: 'Negócio — Extra',
  },
  {
    field_name: 'has_financing',
    label: 'Tem Financiamento',
    field_type: 'checkbox',
    target_entity: 'deal',
    category: 'Negócio — Extra',
  },
  {
    field_name: 'has_financing_condition',
    label: 'Condição de Financiamento',
    field_type: 'checkbox',
    target_entity: 'deal',
    category: 'Negócio — Extra',
  },
  {
    field_name: 'has_signature_recognition',
    label: 'Reconhecimento de Assinatura',
    field_type: 'checkbox',
    target_entity: 'deal',
    category: 'Negócio — Extra',
  },
  {
    field_name: 'housing_regime',
    label: 'Regime Habitacional',
    field_type: 'select',
    target_entity: 'deal',
    category: 'Negócio — Extra',
    options: [
      { value: 'hpp', label: 'Habitação Própria Permanente' },
      { value: 'secundaria', label: 'Habitação Secundária' },
      { value: 'na', label: 'Não Aplicável' },
    ],
  },
  {
    field_name: 'extra_info',
    label: 'Informações Extra',
    field_type: 'textarea',
    target_entity: 'deal',
    category: 'Negócio — Extra',
  },

  // Negócio — Referenciação
  {
    field_name: 'has_referral',
    label: 'Tem Referenciação',
    field_type: 'checkbox',
    target_entity: 'deal',
    category: 'Negócio — Referenciação',
  },
  {
    field_name: 'referral_type',
    label: 'Tipo de Referenciação',
    field_type: 'select',
    target_entity: 'deal',
    category: 'Negócio — Referenciação',
    options: [
      { value: 'interna', label: 'Interna' },
      { value: 'externa', label: 'Externa' },
    ],
  },
  {
    field_name: 'referral_pct',
    label: 'Referenciação (%)',
    field_type: 'percentage',
    target_entity: 'deal',
    category: 'Negócio — Referenciação',
    suggested_min: 0,
    suggested_max: 100,
  },
  {
    field_name: 'referral_info',
    label: 'Info da Referenciação',
    field_type: 'textarea',
    target_entity: 'deal',
    category: 'Negócio — Referenciação',
  },

  // Negócio — Proposta
  {
    field_name: 'proposal_file_url',
    label: 'URL do Ficheiro da Proposta',
    field_type: 'text',
    target_entity: 'deal',
    category: 'Negócio — Proposta',
  },
  {
    field_name: 'proposal_file_name',
    label: 'Nome do Ficheiro da Proposta',
    field_type: 'text',
    target_entity: 'deal',
    category: 'Negócio — Proposta',
  },

  // Negócio — Notas
  {
    field_name: 'notes',
    label: 'Notas do Negócio',
    field_type: 'textarea',
    target_entity: 'deal',
    category: 'Negócio — Notas',
  },
  {
    field_name: 'clients_notes',
    label: 'Notas sobre Clientes',
    field_type: 'textarea',
    target_entity: 'deal',
    category: 'Negócio — Notas',
  },

  // ═══════════════════════════════════
  // CLIENTE DO NEGÓCIO — deal_clients
  // ═══════════════════════════════════
  {
    field_name: 'name',
    label: 'Nome do Cliente',
    field_type: 'text',
    target_entity: 'deal_client',
    category: 'Cliente do Negócio',
  },
  {
    field_name: 'email',
    label: 'Email do Cliente',
    field_type: 'email',
    target_entity: 'deal_client',
    category: 'Cliente do Negócio',
  },
  {
    field_name: 'phone',
    label: 'Telemóvel do Cliente',
    field_type: 'phone',
    target_entity: 'deal_client',
    category: 'Cliente do Negócio',
  },
  {
    field_name: 'person_type',
    label: 'Tipo de Pessoa',
    field_type: 'select',
    target_entity: 'deal_client',
    category: 'Cliente do Negócio',
    options: [
      { value: 'singular', label: 'Pessoa Singular' },
      { value: 'coletiva', label: 'Pessoa Colectiva' },
    ],
  },

  // ═══════════════════════════════════
  // PAGAMENTO DO NEGÓCIO — deal_payments
  // ═══════════════════════════════════
  {
    field_name: 'payment_moment',
    label: 'Momento do Pagamento',
    field_type: 'select',
    target_entity: 'deal_payment',
    category: 'Pagamento — Geral',
    options: [
      { value: 'cpcv', label: 'CPCV' },
      { value: 'escritura', label: 'Escritura' },
      { value: 'single', label: 'Pagamento Único' },
    ],
  },
  {
    field_name: 'payment_pct',
    label: 'Percentagem do Pagamento',
    field_type: 'percentage',
    target_entity: 'deal_payment',
    category: 'Pagamento — Geral',
    suggested_min: 0,
    suggested_max: 100,
  },
  {
    field_name: 'amount',
    label: 'Valor do Pagamento (€)',
    field_type: 'currency',
    target_entity: 'deal_payment',
    category: 'Pagamento — Geral',
    suggested_min: 0,
  },
  {
    field_name: 'network_amount',
    label: 'Valor Rede (€)',
    field_type: 'currency',
    target_entity: 'deal_payment',
    category: 'Pagamento — Distribuição',
    suggested_min: 0,
  },
  {
    field_name: 'agency_amount',
    label: 'Valor Agência (€)',
    field_type: 'currency',
    target_entity: 'deal_payment',
    category: 'Pagamento — Distribuição',
    suggested_min: 0,
  },
  {
    field_name: 'consultant_amount',
    label: 'Valor Consultor (€)',
    field_type: 'currency',
    target_entity: 'deal_payment',
    category: 'Pagamento — Distribuição',
    suggested_min: 0,
  },
  {
    field_name: 'partner_amount',
    label: 'Valor Parceiro (€)',
    field_type: 'currency',
    target_entity: 'deal_payment',
    category: 'Pagamento — Distribuição',
    suggested_min: 0,
  },

  // Pagamento — Estado
  {
    field_name: 'is_signed',
    label: 'Assinado',
    field_type: 'checkbox',
    target_entity: 'deal_payment',
    category: 'Pagamento — Estado',
  },
  {
    field_name: 'signed_date',
    label: 'Data de Assinatura',
    field_type: 'date',
    target_entity: 'deal_payment',
    category: 'Pagamento — Estado',
  },
  {
    field_name: 'is_received',
    label: 'Recebido',
    field_type: 'checkbox',
    target_entity: 'deal_payment',
    category: 'Pagamento — Estado',
  },
  {
    field_name: 'received_date',
    label: 'Data de Recebimento',
    field_type: 'date',
    target_entity: 'deal_payment',
    category: 'Pagamento — Estado',
  },
  {
    field_name: 'is_reported',
    label: 'Reportado',
    field_type: 'checkbox',
    target_entity: 'deal_payment',
    category: 'Pagamento — Estado',
  },
  {
    field_name: 'reported_date',
    label: 'Data de Reporte',
    field_type: 'date',
    target_entity: 'deal_payment',
    category: 'Pagamento — Estado',
  },

  // Pagamento — Facturação Agência
  {
    field_name: 'agency_invoice_number',
    label: 'Nº Factura Agência',
    field_type: 'text',
    target_entity: 'deal_payment',
    category: 'Pagamento — Facturação Agência',
  },
  {
    field_name: 'agency_invoice_date',
    label: 'Data Factura Agência',
    field_type: 'date',
    target_entity: 'deal_payment',
    category: 'Pagamento — Facturação Agência',
  },
  {
    field_name: 'agency_invoice_recipient',
    label: 'Destinatário Factura',
    field_type: 'text',
    target_entity: 'deal_payment',
    category: 'Pagamento — Facturação Agência',
  },
  {
    field_name: 'agency_invoice_recipient_nif',
    label: 'NIF Destinatário Factura',
    field_type: 'text',
    target_entity: 'deal_payment',
    category: 'Pagamento — Facturação Agência',
  },
  {
    field_name: 'agency_invoice_amount_net',
    label: 'Valor Líquido Factura (€)',
    field_type: 'currency',
    target_entity: 'deal_payment',
    category: 'Pagamento — Facturação Agência',
    suggested_min: 0,
  },
  {
    field_name: 'agency_invoice_amount_gross',
    label: 'Valor Bruto Factura (€)',
    field_type: 'currency',
    target_entity: 'deal_payment',
    category: 'Pagamento — Facturação Agência',
    suggested_min: 0,
  },
  {
    field_name: 'agency_invoice_id',
    label: 'ID Factura Agência',
    field_type: 'text',
    target_entity: 'deal_payment',
    category: 'Pagamento — Facturação Agência',
  },

  // Pagamento — Facturação Rede
  {
    field_name: 'network_invoice_number',
    label: 'Nº Factura Rede',
    field_type: 'text',
    target_entity: 'deal_payment',
    category: 'Pagamento — Facturação Rede',
  },
  {
    field_name: 'network_invoice_date',
    label: 'Data Factura Rede',
    field_type: 'date',
    target_entity: 'deal_payment',
    category: 'Pagamento — Facturação Rede',
  },

  // Pagamento — Facturação Consultor
  {
    field_name: 'consultant_invoice_number',
    label: 'Nº Factura/Recibo Consultor',
    field_type: 'text',
    target_entity: 'deal_payment',
    category: 'Pagamento — Facturação Consultor',
  },
  {
    field_name: 'consultant_invoice_date',
    label: 'Data Factura Consultor',
    field_type: 'date',
    target_entity: 'deal_payment',
    category: 'Pagamento — Facturação Consultor',
  },
  {
    field_name: 'consultant_invoice_type',
    label: 'Tipo de Factura Consultor',
    field_type: 'select',
    target_entity: 'deal_payment',
    category: 'Pagamento — Facturação Consultor',
    options: [
      { value: 'factura', label: 'Factura' },
      { value: 'recibo_verde', label: 'Recibo Verde' },
      { value: 'recibo', label: 'Recibo' },
    ],
  },
  {
    field_name: 'consultant_paid',
    label: 'Consultor Pago',
    field_type: 'checkbox',
    target_entity: 'deal_payment',
    category: 'Pagamento — Facturação Consultor',
  },
  {
    field_name: 'consultant_paid_date',
    label: 'Data de Pagamento ao Consultor',
    field_type: 'date',
    target_entity: 'deal_payment',
    category: 'Pagamento — Facturação Consultor',
  },
  {
    field_name: 'notes',
    label: 'Notas do Pagamento',
    field_type: 'textarea',
    target_entity: 'deal_payment',
    category: 'Pagamento — Notas',
  },

  // ═══════════════════════════════════
  // PROCESSO — proc_instances
  // ═══════════════════════════════════
  {
    field_name: 'external_ref',
    label: 'Referência do Processo',
    field_type: 'text',
    target_entity: 'process',
    category: 'Processo',
  },
  {
    field_name: 'current_status',
    label: 'Estado do Processo',
    field_type: 'select',
    target_entity: 'process',
    category: 'Processo',
    options_from_constant: 'PROCESS_STATUS',
  },
  {
    field_name: 'process_type',
    label: 'Tipo de Processo',
    field_type: 'select',
    target_entity: 'process',
    category: 'Processo',
    options_from_constant: 'PROCESS_TYPES',
  },
  {
    field_name: 'percent_complete',
    label: 'Progresso (%)',
    field_type: 'percentage',
    target_entity: 'process',
    category: 'Processo',
  },
  {
    field_name: 'started_at',
    label: 'Data de Início',
    field_type: 'date',
    target_entity: 'process',
    category: 'Processo',
  },
  {
    field_name: 'completed_at',
    label: 'Data de Conclusão',
    field_type: 'date',
    target_entity: 'process',
    category: 'Processo',
  },
  {
    field_name: 'approved_at',
    label: 'Data de Aprovação',
    field_type: 'date',
    target_entity: 'process',
    category: 'Processo',
  },
  {
    field_name: 'notes',
    label: 'Notas do Processo',
    field_type: 'textarea',
    target_entity: 'process',
    category: 'Processo',
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
