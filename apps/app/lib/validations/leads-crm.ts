import { z } from 'zod'

// =============================================================================
// Contact
// =============================================================================

// Uses actual `leads` table column names (PT)
const contactBaseSchema = z.object({
  nome: z.string().min(2, 'O nome deve ter pelo menos 2 caracteres'),
  email: z.string().email('Email invalido').nullable().optional(),
  telemovel: z.string().min(9, 'Telefone invalido').nullable().optional(),
  telefone_fixo: z.string().nullable().optional(),
  nif: z.string().nullable().optional(),
  nacionalidade: z.string().nullable().optional(),
  data_nascimento: z.string().nullable().optional(),
  tipo_documento: z.string().nullable().optional(),
  numero_documento: z.string().nullable().optional(),
  data_validade_documento: z.string().nullable().optional(),
  pais_emissor: z.string().nullable().optional(),
  morada: z.string().nullable().optional(),
  codigo_postal: z.string().nullable().optional(),
  localidade: z.string().nullable().optional(),
  tem_empresa: z.boolean().optional().default(false),
  empresa: z.string().nullable().optional(),
  nipc: z.string().nullable().optional(),
  email_empresa: z.string().email('Email da empresa invalido').nullable().optional(),
  telefone_empresa: z.string().nullable().optional(),
  morada_empresa: z.string().nullable().optional(),
  lifecycle_stage_id: z.string().nullable().optional(),
  tags: z.array(z.string()).optional().default([]),
  agent_id: z.string().nullable().optional(),
  origem: z.string().nullable().optional(),
  observacoes: z.string().nullable().optional(),
  temperatura: z.enum(['Frio', 'Morno', 'Quente']).nullable().optional(),
})

export const createContactSchema = contactBaseSchema.refine(
  (data) => data.email || data.telemovel,
  { message: 'Email ou telefone obrigatorio', path: ['email'] }
)

export const updateContactSchema = contactBaseSchema.partial()

// =============================================================================
// Entry (inbound event)
// =============================================================================

const entrySources = [
  'meta_ads', 'google_ads', 'website', 'landing_page', 'partner',
  'organic', 'walk_in', 'phone_call', 'social_media', 'other',
] as const

const entrySectors = [
  'real_estate_buy', 'real_estate_sell', 'real_estate_rent',
  'recruitment', 'credit', 'other',
] as const

const entryStatuses = ['new', 'contacted', 'qualified', 'converted', 'archived', 'expired'] as const
const entryPriorities = ['low', 'medium', 'high', 'urgent'] as const
const slaStatuses = ['pending', 'on_time', 'warning', 'breached', 'completed'] as const

export const createEntrySchema = z.object({
  contact_id: z.string().uuid('ID do contacto invalido'),
  source: z.enum(entrySources),
  campaign_id: z.string().uuid().nullable().optional(),
  partner_id: z.string().uuid().nullable().optional(),
  assigned_agent_id: z.string().uuid().nullable().optional(),
  sector: z.enum(entrySectors).nullable().optional(),
  is_reactivation: z.boolean().optional().default(false),
  status: z.enum(entryStatuses).optional().default('new'),
  priority: z.enum(entryPriorities).optional().default('medium'),
  utm_source: z.string().nullable().optional(),
  utm_medium: z.string().nullable().optional(),
  utm_campaign: z.string().nullable().optional(),
  utm_content: z.string().nullable().optional(),
  utm_term: z.string().nullable().optional(),
  form_data: z.record(z.string(), z.unknown()).nullable().optional(),
  form_url: z.string().url().nullable().optional(),
  notes: z.string().nullable().optional(),
})

export const updateEntrySchema = z.object({
  assigned_agent_id: z.string().uuid().nullable().optional(),
  status: z.enum(entryStatuses).optional(),
  priority: z.enum(entryPriorities).optional(),
  sla_status: z.enum(slaStatuses).optional(),
  first_contact_at: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
})

// =============================================================================
// Negocio (deal)
// =============================================================================

const pipelineTypes = ['comprador', 'vendedor', 'arrendatario', 'arrendador'] as const

// Uses actual `negocios` table column names
//
// 2026-06-XX: `tipo` is now perspective only (Comprador/Vendedor/Arrendatário/
// Senhorio/Outro). The deal type lives in `business_type`. Both fields accept
// transitional aliases server-side.
export const createNegocioSchema = z.object({
  lead_id: z.string().uuid('ID do contacto invalido'),
  entry_id: z.string().uuid('ID da entrada invalido').nullable().optional(),
  business_type: z.enum(['Venda', 'Arrendamento', 'Trespasse']).nullable().optional(),
  tipo: z.string().min(1, 'Tipo de negocio obrigatorio'),
  pipeline_stage_id: z.string().uuid('ID da fase invalido'),
  assigned_consultant_id: z.string().uuid().nullable().optional(),
  property_id: z.string().uuid().nullable().optional(),
  // Linked opportunities ("compra depende da venda"): a shared group id ties a
  // sale + dependent purchase born from the same lead/form; depends_on points
  // the purchase at the sale it's contingent on.
  deal_group_id: z.string().uuid().nullable().optional(),
  depends_on_negocio_id: z.string().uuid().nullable().optional(),
  expected_value: z.number().positive('Valor deve ser positivo').nullable().optional(),
  probability_pct: z.number().min(0).max(100).nullable().optional(),
  expected_close_date: z.string().nullable().optional(),
  observacoes: z.string().nullable().optional(),
  // Preferences captured during qualification (Compra / Arrendatário side)
  tipo_imovel: z.string().nullable().optional(),
  localizacao: z.string().nullable().optional(),
  quartos_min: z.number().int().min(0).nullable().optional(),
  area_min_m2: z.number().positive().nullable().optional(),
  orcamento: z.number().positive().nullable().optional(),
  orcamento_max: z.number().positive().nullable().optional(),
  renda_max_mensal: z.number().positive().nullable().optional(),
  // Listing-side fields (Venda / Arrendador)
  preco_venda: z.number().positive().nullable().optional(),
  renda_pretendida: z.number().positive().nullable().optional(),
  // Lead temperature
  temperatura: z.enum(['Frio', 'Morno', 'Quente']).nullable().optional(),
  // Source/origin
  origem: z.string().nullable().optional(),
  origem_detalhe: z.string().nullable().optional(),
  origem_mensagem: z.string().nullable().optional(),
  // Referral
  has_referral: z.boolean().optional(),
  referral_pct: z.number().nullable().optional(),
  referral_type: z.enum(['interna', 'externa']).nullable().optional(),
  referral_side: z.enum(['angariacao', 'comprador']).nullable().optional(),
  referral_info: z.string().nullable().optional(),
  referral_consultant_id: z.string().uuid().nullable().optional(),
  referral_external_name: z.string().nullable().optional(),
  referral_external_phone: z.string().nullable().optional(),
  referral_external_email: z.string().nullable().optional(),
  referral_external_agency: z.string().nullable().optional(),
  // Zonas de interesse — array estruturado consumido pelo trigger
  // `negocios_recompute_zonas_geom` (PostGIS). Sem este campo, zod strip
  // silenciosamente o `zonas` do payload e o negócio nasce sem zonas.
  zonas: z
    .array(
      z.discriminatedUnion('kind', [
        z.object({
          kind: z.literal('admin'),
          area_id: z.string().uuid(),
          label: z.string(),
        }),
        z.object({
          kind: z.literal('polygon'),
          id: z.string(),
          label: z.string(),
          geometry: z.object({
            type: z.literal('Polygon'),
            coordinates: z.array(z.array(z.array(z.number()))),
          }),
        }),
      ])
    )
    .nullable()
    .optional(),
})

export const updateNegocioSchema = createNegocioSchema.partial().extend({
  lost_reason: z.string().nullable().optional(),
  lost_notes: z.string().nullable().optional(),
})

export const moveNegocioStageSchema = z.object({
  pipeline_stage_id: z.string().uuid('ID da fase invalido'),
  lost_reason: z.string().nullable().optional(),
  lost_notes: z.string().nullable().optional(),
})

// =============================================================================
// Activity
// =============================================================================

const activityTypes = [
  'call', 'email', 'whatsapp', 'sms', 'note', 'visit',
  'stage_change', 'assignment', 'lifecycle_change', 'system',
] as const

const activityDirections = ['inbound', 'outbound'] as const

export const createActivitySchema = z.object({
  contact_id: z.string().uuid('ID do contacto invalido'),
  negocio_id: z.string().uuid().nullable().optional(),
  activity_type: z.enum(activityTypes),
  direction: z.enum(activityDirections).nullable().optional(),
  subject: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).nullable().optional(),
  occurred_at: z.string().datetime({ offset: true }).nullable().optional(),
  is_pinned: z.boolean().optional(),
})

export const updateActivitySchema = z.object({
  subject: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  occurred_at: z.string().datetime({ offset: true }).nullable().optional(),
  is_pinned: z.boolean().optional(),
  activity_type: z.enum(activityTypes).optional(),
  direction: z.enum(activityDirections).nullable().optional(),
  negocio_id: z.string().uuid().nullable().optional(),
})

export type UpdateActivityInput = z.infer<typeof updateActivitySchema>

// =============================================================================
// Referral
// =============================================================================

const referralTypes = ['internal', 'partner_inbound'] as const
const referralStatuses = ['pending', 'accepted', 'rejected', 'converted', 'lost'] as const

export const createReferralSchema = z.object({
  contact_id: z.string().uuid('ID do contacto invalido'),
  negocio_id: z.string().uuid().nullable().optional(),
  entry_id: z.string().uuid().nullable().optional(),
  referral_type: z.enum(referralTypes),
  from_consultant_id: z.string().uuid().nullable().optional(),
  to_consultant_id: z.string().uuid().nullable().optional(),
  partner_id: z.string().uuid().nullable().optional(),
  // Internal referrals only: per-referral % override (NULL → falls back to
  // temp_agency_settings.default_referral_pct on the server). 1–100; 0 was
  // ruled out because it would silently create a no-op agreement.
  referral_pct: z.number().min(1).max(100).nullable().optional(),
  notes: z.string().nullable().optional(),
}).refine(
  (data) => {
    if (data.referral_type === 'internal') {
      return !!data.from_consultant_id && !!data.to_consultant_id
    }
    if (data.referral_type === 'partner_inbound') {
      return !!data.partner_id
    }
    return false
  },
  { message: 'Dados da referencia incompletos', path: ['referral_type'] }
)

export const updateReferralStatusSchema = z.object({
  status: z.enum(referralStatuses),
  notes: z.string().nullable().optional(),
})

// =============================================================================
// Campaign
// =============================================================================

const campaignPlatforms = ['meta', 'google', 'website', 'landing_page', 'other'] as const
const campaignStatuses = ['active', 'paused', 'ended'] as const

export const createCampaignSchema = z.object({
  name: z.string().min(2, 'O nome da campanha deve ter pelo menos 2 caracteres'),
  platform: z.enum(campaignPlatforms),
  external_campaign_id: z.string().nullable().optional(),
  external_adset_id: z.string().nullable().optional(),
  external_ad_id: z.string().nullable().optional(),
  status: z.enum(campaignStatuses).optional().default('active'),
  sector: z.enum(entrySectors).nullable().optional(),
  description: z.string().nullable().optional(),
  budget: z.number().positive().nullable().optional(),
  start_date: z.string().nullable().optional(),
  end_date: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
})

// =============================================================================
// Partner
// =============================================================================

const partnerTypes = ['advogado', 'banco', 'particular', 'agencia', 'construtor', 'outro'] as const

export const createPartnerSchema = z.object({
  name: z.string().min(2, 'O nome deve ter pelo menos 2 caracteres'),
  email: z.string().email('Email invalido').nullable().optional(),
  phone: z.string().nullable().optional(),
  company: z.string().nullable().optional(),
  partner_type: z.enum(partnerTypes).optional().default('outro'),
  is_active: z.boolean().optional().default(true),
  notes: z.string().nullable().optional(),
})

// =============================================================================
// Pipeline Stage (admin config)
// =============================================================================

export const createPipelineStageSchema = z.object({
  pipeline_type: z.enum(pipelineTypes),
  name: z.string().min(2, 'O nome da fase deve ter pelo menos 2 caracteres'),
  color: z.string().optional().default('#6b7280'),
  order_index: z.number().int().min(0),
  is_terminal: z.boolean().optional().default(false),
  terminal_type: z.enum(['won', 'lost']).nullable().optional(),
  probability_pct: z.number().int().min(0).max(100).optional().default(0),
  sla_days: z.number().int().positive().nullable().optional(),
})

// =============================================================================
// Contact Stage (admin config)
// =============================================================================

export const createContactStageSchema = z.object({
  name: z.string().min(2, 'O nome da fase deve ter pelo menos 2 caracteres'),
  description: z.string().nullable().optional(),
  color: z.string().optional().default('#6b7280'),
  order_index: z.number().int().min(0),
  is_default: z.boolean().optional().default(false),
})

// =============================================================================
// Assignment Rule (admin config)
// =============================================================================

const fallbackActions = ['gestora_pool', 'round_robin', 'skip'] as const

export const createAssignmentRuleSchema = z.object({
  name: z.string().min(2, 'O nome da regra deve ter pelo menos 2 caracteres'),
  description: z.string().nullable().optional(),
  source_match: z.array(z.string()).nullable().optional(),
  campaign_id_match: z.string().uuid().nullable().optional(),
  ad_id_match: z.string().nullable().optional(),
  adset_id_match: z.string().nullable().optional(),
  zone_match: z.array(z.string()).nullable().optional(),
  pipeline_type_match: z.array(z.enum(pipelineTypes)).nullable().optional(),
  sector_match: z.array(z.enum(entrySectors)).nullable().optional(),
  consultant_id: z.string().uuid().nullable().optional(),
  team_consultant_ids: z.array(z.string().uuid()).nullable().optional(),
  // Either may be supplied — server resolves the missing one against
  // dev_properties before insert/update.
  property_external_ref: z.string().nullable().optional(),
  property_id: z.string().uuid().nullable().optional(),
  overflow_threshold: z.number().int().positive().nullable().optional(),
  fallback_action: z.enum(fallbackActions).optional().default('gestora_pool'),
  priority: z.number().int().optional().default(0),
  is_active: z.boolean().optional().default(true),
})

// =============================================================================
// SLA Config (admin config)
// =============================================================================

export const createSlaConfigSchema = z.object({
  name: z.string().min(2, 'O nome da configuração deve ter pelo menos 2 caracteres'),
  source_match: z.array(z.string()).nullable().optional(),
  sector_match: z.array(z.enum(entrySectors)).nullable().optional(),
  priority_match: z.array(z.enum(entryPriorities)).nullable().optional(),
  sla_minutes: z.number().int().positive('O SLA deve ser positivo').default(1440),
  warning_pct: z.number().int().min(1).max(100).default(50),
  critical_pct: z.number().int().min(1).max(200).default(100),
  escalate_pct: z.number().int().min(1).max(300).default(150),
  is_active: z.boolean().optional().default(true),
  priority: z.number().int().optional().default(0),
})

// =============================================================================
// Webhook payload (Meta Lead Ads / Google)
// =============================================================================

export const webhookLeadSchema = z.object({
  // Contact data (at least name + one contact method)
  name: z.string().min(1),
  email: z.string().email().nullable().optional(),
  phone: z.string().nullable().optional(),
  // Source tracking
  source: z.enum(entrySources).optional().default('other'),
  campaign_id: z.string().nullable().optional(),
  // Meta ad attribution (used by assignment rules to route ad → consultor + imóvel)
  ad_id: z.string().nullable().optional(),
  adset_id: z.string().nullable().optional(),
  utm_source: z.string().nullable().optional(),
  utm_medium: z.string().nullable().optional(),
  utm_campaign: z.string().nullable().optional(),
  utm_content: z.string().nullable().optional(),
  utm_term: z.string().nullable().optional(),
  // Pipeline hint
  pipeline_type: z.enum(pipelineTypes).nullable().optional(),
  // Raw form
  form_data: z.record(z.string(), z.unknown()).nullable().optional(),
  form_url: z.string().url().nullable().optional(),
}).refine(
  (data) => data.email || data.phone,
  { message: 'Email ou telefone obrigatorio', path: ['email'] }
)

// Type exports
export type CreateContactInput = z.infer<typeof createContactSchema>
export type UpdateContactInput = z.infer<typeof updateContactSchema>
export type CreateEntryInput = z.infer<typeof createEntrySchema>
export type UpdateEntryInput = z.infer<typeof updateEntrySchema>
export type CreateNegocioInput = z.infer<typeof createNegocioSchema>
export type UpdateNegocioInput = z.infer<typeof updateNegocioSchema>
export type MoveNegocioStageInput = z.infer<typeof moveNegocioStageSchema>
export type CreateActivityInput = z.infer<typeof createActivitySchema>
export type CreateReferralInput = z.infer<typeof createReferralSchema>
export type UpdateReferralStatusInput = z.infer<typeof updateReferralStatusSchema>
export type CreateCampaignInput = z.infer<typeof createCampaignSchema>
export type CreatePartnerInput = z.infer<typeof createPartnerSchema>
export type CreatePipelineStageInput = z.infer<typeof createPipelineStageSchema>
export type CreateContactStageInput = z.infer<typeof createContactStageSchema>
export type CreateAssignmentRuleInput = z.infer<typeof createAssignmentRuleSchema>
export type CreateSlaConfigInput = z.infer<typeof createSlaConfigSchema>
export type WebhookLeadInput = z.infer<typeof webhookLeadSchema>
