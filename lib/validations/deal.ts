import { z } from 'zod'

const clientSchema = z.object({
  id: z.string().optional(),
  person_type: z.enum(['singular', 'coletiva']).default('singular'),
  name: z.string().min(1, 'Nome e obrigatorio'),
  email: z.string().min(1, 'Email e obrigatorio').email('Email invalido'),
  phone: z.string().min(1, 'Contacto e obrigatorio'),
  order_index: z.number().default(0),
})

export const dealFormSchema = z.object({
  // Step 1 — Partilha
  proposal_file_url: z.string().optional(),
  proposal_file_name: z.string().optional(),
  scenario: z.enum(['pleno', 'comprador_externo', 'pleno_agencia', 'angariacao_externa']),

  // Pleno + Comprador Externo
  property_id: z.string().optional(),

  // Pleno de Agencia
  internal_colleague_id: z.string().optional(),
  colleague_property_id: z.string().optional(),

  // Comprador Externo + Angariacao Externa
  external_consultant_name: z.string().optional(),
  external_consultant_phone: z.string().optional(),
  external_consultant_email: z.string().optional(),
  partner_agency_name: z.string().optional(),

  // Angariacao Externa
  external_property_link: z.string().optional(),

  // Partilha %
  share_pct: z.number().min(0).max(100).optional(),

  share_notes: z.string().optional(),

  // Step 2 — Clientes
  person_type: z.enum(['singular', 'coletiva']).default('singular'),
  clients: z.array(clientSchema).default([]),
  clients_notes: z.string().optional(),

  // Step 3 — Condicoes
  business_type: z.enum(['venda', 'arrendamento', 'trespasse']).optional(),
  deal_value: z.number().positive('Valor deve ser positivo').optional(),
  commission_pct: z.number().positive('Comissao deve ser positiva').optional(),
  cpcv_pct: z.number().min(0).max(100).optional(),
  deposit_value: z.string().optional(),
  contract_signing_date: z.string().optional(),
  max_deadline: z.string().optional(),
  conditions_notes: z.string().optional(),

  // Angariacao Externa — property fields
  external_property_id: z.string().optional(),
  external_property_type: z.string().optional(),
  external_property_typology: z.string().optional(),
  external_property_zone: z.string().optional(),
  external_property_extra: z.string().optional(),
  external_property_construction_year: z.string().optional(),

  // Step 4 — Extra
  has_guarantor: z.boolean().optional(),
  has_furniture: z.boolean().optional(),
  is_bilingual: z.boolean().optional(),
  has_financing: z.boolean().optional(),
  has_financing_condition: z.boolean().optional(),
  has_signature_recognition: z.boolean().optional(),
  housing_regime: z.enum(['hpp', 'secundaria', 'na']).optional(),
  extra_info: z.string().optional(),

  // Step 5 — Referenciacao
  has_referral: z.boolean().optional(),
  referral_pct: z.number().min(0).max(100).optional(),
  referral_type: z.enum(['interna', 'externa']).optional(),
  referral_info: z.string().optional(),
})

export type DealFormData = z.infer<typeof dealFormSchema>

/**
 * Full validation with conditional rules based on scenario + business_type.
 * Used on submit (not on draft save).
 */
export function validateDealForm(data: DealFormData): { success: boolean; errors: Record<string, string> } {
  const errors: Record<string, string> = {}
  const { scenario, business_type } = data

  // Step 1 — Partilha
  if (!data.proposal_file_url) errors.proposal_file_url = 'Upload da proposta e obrigatorio'

  if (scenario === 'pleno' || scenario === 'comprador_externo') {
    if (!data.property_id) errors.property_id = 'Seleccione o imovel'
  }
  if (scenario === 'pleno_agencia') {
    if (!data.internal_colleague_id) errors.internal_colleague_id = 'Seleccione o colega'
    if (!data.colleague_property_id) errors.colleague_property_id = 'Seleccione o imovel do colega'
    if (!data.share_pct) errors.share_pct = 'Indique a percentagem de partilha'
  }
  if (scenario === 'comprador_externo' || scenario === 'angariacao_externa') {
    if (!data.partner_agency_name) errors.partner_agency_name = 'Nome da agencia e obrigatorio'
    if (!data.external_consultant_name) errors.external_consultant_name = 'Nome do consultor e obrigatorio'
    if (!data.external_consultant_phone) errors.external_consultant_phone = 'Contacto do consultor e obrigatorio'
    if (!data.external_consultant_email) errors.external_consultant_email = 'Email do consultor e obrigatorio'
    if (!data.share_pct) errors.share_pct = 'Indique a percentagem de partilha'
  }

  // Step 2 — Clientes (skip for comprador_externo)
  if (scenario !== 'comprador_externo') {
    if (!data.clients || data.clients.length === 0) {
      errors.clients = 'Adicione pelo menos um cliente'
    }
  }

  // Step 3 — Condicoes
  if (!business_type) errors.business_type = 'Seleccione o tipo de negocio'
  if (!data.deal_value) errors.deal_value = 'Valor acordado e obrigatorio'
  if (!data.commission_pct) errors.commission_pct = 'Comissao e obrigatoria'
  if (!data.deposit_value) errors.deposit_value = 'Valor do sinal/caucao e obrigatorio'
  if (!data.contract_signing_date) errors.contract_signing_date = 'Data de assinatura e obrigatoria'
  if (!data.max_deadline) errors.max_deadline = 'Prazo e obrigatorio'

  if (business_type === 'venda') {
    if (data.cpcv_pct === undefined || data.cpcv_pct === null) errors.cpcv_pct = 'Pagamento no CPCV e obrigatorio'
  }

  if (scenario === 'angariacao_externa') {
    if (!data.external_property_id) errors.external_property_id = 'ID do imovel e obrigatorio'
    if (!data.external_property_type) errors.external_property_type = 'Tipo de imovel e obrigatorio'
    if (!data.external_property_typology) errors.external_property_typology = 'Tipologia e obrigatoria'
    if (!data.external_property_construction_year) errors.external_property_construction_year = 'Ano de construcao e obrigatorio'
  }

  // Step 4 — Extra (conditional by business_type)
  if (business_type === 'arrendamento' || business_type === 'trespasse') {
    if (data.has_guarantor === undefined) errors.has_guarantor = 'Indique se tem fiador'
  }
  if (data.has_furniture === undefined) errors.has_furniture = 'Indique se inclui mobilia'
  if (data.is_bilingual === undefined) errors.is_bilingual = 'Indique se o contrato e bilingue'

  if (business_type === 'venda') {
    if (data.has_financing === undefined) errors.has_financing = 'Indique se ha financiamento'
    if (data.has_financing && data.has_financing_condition === undefined) {
      errors.has_financing_condition = 'Indique se ha condicao resolutiva'
    }
    if (data.has_signature_recognition === undefined) errors.has_signature_recognition = 'Indique reconhecimento de assinaturas'
  }
  if (business_type === 'venda' || business_type === 'arrendamento') {
    if (!data.housing_regime) errors.housing_regime = 'Seleccione o regime'
  }

  // Step 5 — Referenciacao (skip for comprador_externo)
  if (scenario !== 'comprador_externo') {
    if (data.has_referral === undefined) errors.has_referral = 'Indique se existe referencia'
    if (data.has_referral) {
      if (!data.referral_pct) errors.referral_pct = 'Indique a percentagem'
      if (!data.referral_type) errors.referral_type = 'Seleccione o tipo de referenciacao'
      if (data.referral_type === 'externa' && !data.referral_info) {
        errors.referral_info = 'Informacao do referenciado e obrigatoria'
      }
    }
  }

  return { success: Object.keys(errors).length === 0, errors }
}

/**
 * Maps field keys to the step they belong to (for focusing on error step)
 */
export function getStepForField(field: string): number {
  const step1 = ['proposal_file_url', 'scenario', 'property_id', 'internal_colleague_id', 'colleague_property_id', 'external_consultant_name', 'external_consultant_phone', 'external_consultant_email', 'partner_agency_name', 'external_property_link', 'share_pct', 'share_notes']
  const step2 = ['person_type', 'clients', 'clients_notes']
  const step3 = ['business_type', 'deal_value', 'commission_pct', 'cpcv_pct', 'deposit_value', 'contract_signing_date', 'max_deadline', 'conditions_notes', 'external_property_id', 'external_property_type', 'external_property_typology', 'external_property_zone', 'external_property_extra', 'external_property_construction_year']
  const step4 = ['has_guarantor', 'has_furniture', 'is_bilingual', 'has_financing', 'has_financing_condition', 'has_signature_recognition', 'housing_regime', 'extra_info']

  if (step1.includes(field)) return 0
  if (step2.includes(field)) return 1
  if (step3.includes(field)) return 2
  if (step4.includes(field)) return 3
  return 4
}
