// types/leads-crm.ts — New CRM Leads System Types

// =============================================================================
// Enums / Literal Types
// =============================================================================

export type PipelineType = 'comprador' | 'vendedor' | 'arrendatario' | 'arrendador'

export type TerminalType = 'won' | 'lost'

export type EntrySource =
  | 'meta_ads'
  | 'google_ads'
  | 'website'
  | 'landing_page'
  | 'partner'
  | 'organic'
  | 'walk_in'
  | 'phone_call'
  | 'social_media'
  | 'other'

export type ActivityType =
  | 'call'
  | 'email'
  | 'whatsapp'
  | 'sms'
  | 'note'
  | 'visit'
  | 'stage_change'
  | 'assignment'
  | 'lifecycle_change'
  | 'system'

export type ActivityDirection = 'inbound' | 'outbound'

export type ReferralType = 'internal' | 'partner_inbound'

export type ReferralStatus = 'pending' | 'accepted' | 'rejected' | 'converted' | 'lost'

export type PartnerType = 'advogado' | 'banco' | 'particular' | 'agencia' | 'construtor' | 'outro'

export type CampaignPlatform = 'meta' | 'google' | 'website' | 'landing_page' | 'other'

export type CampaignStatus = 'active' | 'paused' | 'ended'

export type TagCategory = 'lifecycle' | 'interest' | 'campaign' | 'custom'

// =============================================================================
// Contact Lifecycle Stage
// =============================================================================

export interface LeadsContactStage {
  id: string
  name: string
  description: string | null
  color: string
  order_index: number
  is_default: boolean
  created_at: string
}

// =============================================================================
// Contact (unique person)
// =============================================================================

export interface LeadsContact {
  id: string
  // Name — DB column is `nome`; `full_name` kept for backwards-compat
  nome?: string
  full_name: string  // resolved from nome by the API layer or fallback
  email: string | null
  // Phone — DB column is `telemovel`; `phone` kept for backwards-compat
  telemovel?: string | null
  phone: string | null  // resolved from telemovel
  // Secondary phone — DB column is `telefone_fixo`
  telefone_fixo?: string | null
  secondary_phone: string | null
  nif: string | null
  // Nationality — DB column is `nacionalidade`
  nacionalidade?: string | null
  nationality: string | null
  // Date of birth — DB column is `data_nascimento`
  data_nascimento?: string | null
  date_of_birth: string | null
  // Document — DB columns use PT names
  tipo_documento?: string | null
  document_type: string | null
  numero_documento?: string | null
  document_number: string | null
  data_validade_documento?: string | null
  document_expiry: string | null
  pais_emissor?: string | null
  document_country: string | null
  documento_identificacao_frente_url?: string | null
  document_front_url: string | null
  documento_identificacao_verso_url?: string | null
  document_back_url: string | null
  // Address — DB columns use PT names
  morada?: string | null
  address: string | null
  codigo_postal?: string | null
  postal_code: string | null
  localidade?: string | null
  city: string | null
  // Company — DB columns use PT names
  tem_empresa?: boolean
  has_company: boolean
  empresa?: string | null
  company_name: string | null
  nipc?: string | null
  company_nipc: string | null
  email_empresa?: string | null
  company_email: string | null
  telefone_empresa?: string | null
  company_phone: string | null
  morada_empresa?: string | null
  company_address: string | null
  // Lifecycle
  lifecycle_stage_id: string | null
  tags: string[]
  // Assignment — DB column is `agent_id`
  agent_id?: string | null
  assigned_consultant_id: string | null
  // Notes — DB column is `observacoes`
  observacoes?: string | null
  notes: string | null
  first_source: string | null
  created_at: string
  updated_at: string
}

export interface LeadsContactWithRelations extends LeadsContact {
  lifecycle_stage?: LeadsContactStage | null
  consultant?: { id: string; commercial_name: string | null } | null
  entries_count?: number
  negocios_count?: number
  negocios_won_count?: number
}

// =============================================================================
// Campaign
// =============================================================================

export interface LeadsCampaign {
  id: string
  name: string
  platform: CampaignPlatform
  external_campaign_id: string | null
  external_adset_id: string | null
  external_ad_id: string | null
  status: CampaignStatus
  budget: number | null
  start_date: string | null
  end_date: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

// =============================================================================
// Partner (external referrer)
// =============================================================================

export interface LeadsPartner {
  id: string
  name: string
  email: string | null
  phone: string | null
  company: string | null
  partner_type: PartnerType
  magic_link_token: string | null
  magic_link_expires_at: string | null
  last_portal_access: string | null
  is_active: boolean
  notes: string | null
  created_at: string
  updated_at: string
}

export interface LeadsPartnerWithStats extends LeadsPartner {
  total_referrals: number
  converted_referrals: number
  pending_referrals: number
  conversion_rate: number
}

// =============================================================================
// Entry (inbound event)
// =============================================================================

export interface LeadsEntry {
  id: string
  contact_id: string
  source: EntrySource
  campaign_id: string | null
  partner_id: string | null
  utm_source: string | null
  utm_medium: string | null
  utm_campaign: string | null
  utm_content: string | null
  utm_term: string | null
  form_data: Record<string, unknown> | null
  form_url: string | null
  notes: string | null
  created_at: string
}

export interface LeadsEntryWithRelations extends LeadsEntry {
  campaign?: LeadsCampaign | null
  partner?: LeadsPartner | null
}

// =============================================================================
// Pipeline Stage
// =============================================================================

export interface LeadsPipelineStage {
  id: string
  pipeline_type: PipelineType
  name: string
  color: string
  order_index: number
  is_terminal: boolean
  terminal_type: TerminalType | null
  probability_pct: number
  sla_days: number | null
  created_at: string
}

// =============================================================================
// Negocio (deal with pipeline position)
// =============================================================================

export interface LeadsNegocio {
  id: string
  // FK — DB column is `lead_id`; `contact_id` kept for backwards-compat
  lead_id?: string
  contact_id: string  // resolved from lead_id by the API layer or fallback
  pipeline_type: PipelineType
  // `tipo` is the raw DB column; `pipeline_type` may be derived from it
  tipo?: string
  pipeline_stage_id: string
  stage_entered_at: string
  assigned_consultant_id: string | null
  property_id: string | null
  expected_value: number | null
  probability_pct: number | null
  expected_close_date: string | null
  details: Record<string, unknown>
  lost_reason: string | null
  lost_notes: string | null
  won_date: string | null
  lost_date: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface LeadsNegocioWithRelations extends LeadsNegocio {
  // Contact join: DB returns key `leads` (the table name); `contact` kept for backwards-compat
  leads?: LeadsContact | null
  contact?: LeadsContact | null
  pipeline_stage?: LeadsPipelineStage | null
  // Consultant join: DB returns key `dev_users`; `consultant` kept for backwards-compat
  dev_users?: { id: string; commercial_name: string | null } | null
  consultant?: { id: string; commercial_name: string | null } | null
  property?: {
    id: string
    title: string
    external_ref: string | null
    city: string | null
    listing_price: number | null
  } | null
  // Computed
  weighted_value?: number  // expected_value * (probability_pct or stage.probability_pct) / 100
  days_in_stage?: number
  sla_overdue?: boolean
}

// =============================================================================
// Stage History
// =============================================================================

export interface LeadsNegocioStageHistory {
  id: string
  negocio_id: string
  stage_id: string
  entered_at: string
  exited_at: string | null
  moved_by: string | null
  // Joins
  stage?: LeadsPipelineStage | null
}

// =============================================================================
// Activity (360 timeline)
// =============================================================================

export interface LeadsActivity {
  id: string
  contact_id: string
  negocio_id: string | null
  activity_type: ActivityType
  direction: ActivityDirection | null
  subject: string | null
  description: string | null
  metadata: Record<string, unknown> | null
  created_by: string | null
  created_at: string
}

export interface LeadsActivityWithAuthor extends LeadsActivity {
  author?: { id: string; commercial_name: string | null } | null
}

// =============================================================================
// Referral
// =============================================================================

export interface LeadsReferral {
  id: string
  contact_id: string
  negocio_id: string | null
  entry_id: string | null
  referral_type: ReferralType
  from_consultant_id: string | null
  to_consultant_id: string | null
  partner_id: string | null
  status: ReferralStatus
  notes: string | null
  created_at: string
  updated_at: string
}

export interface LeadsReferralWithRelations extends LeadsReferral {
  contact?: Pick<LeadsContact, 'id' | 'full_name' | 'email' | 'phone' | 'nome' | 'telemovel'> | null
  from_consultant?: { id: string; commercial_name: string | null } | null
  to_consultant?: { id: string; commercial_name: string | null } | null
  partner?: LeadsPartner | null
  negocio?: Pick<LeadsNegocio, 'id' | 'pipeline_type' | 'pipeline_stage_id' | 'expected_value'> | null
}

// =============================================================================
// Tag
// =============================================================================

export interface LeadsTag {
  id: string
  name: string
  color: string
  category: TagCategory | null
  created_at: string
}

// =============================================================================
// Assignment Rule
// =============================================================================

export interface LeadsAssignmentRule {
  id: string
  name: string
  source_match: string[] | null
  campaign_id_match: string | null
  zone_match: string[] | null
  pipeline_type_match: string[] | null
  consultant_id: string | null
  team_consultant_ids: string[] | null
  priority: number
  is_active: boolean
  created_at: string
  updated_at: string
}

// =============================================================================
// Kanban View Types
// =============================================================================

export interface KanbanColumn {
  stage: LeadsPipelineStage
  negocios: LeadsNegocioWithRelations[]
  count: number
  total_value: number
  weighted_value: number
}

export interface KanbanBoard {
  pipeline_type: PipelineType
  columns: KanbanColumn[]
  totals: {
    count: number
    total_value: number
    weighted_value: number
  }
}

// =============================================================================
// Dashboard / Forecast Types
// =============================================================================

export interface PipelineFunnelMetrics {
  pipeline_type: PipelineType
  stages: {
    stage_id: string
    stage_name: string
    count: number
    total_value: number
    avg_days_in_stage: number
    conversion_rate_to_next: number  // % that move to next stage
    sla_overdue_count: number
  }[]
  overall: {
    total_leads: number
    total_won: number
    total_lost: number
    win_rate: number
    avg_cycle_days: number  // average days from first stage to won
  }
}

export interface WeightedForecast {
  pipeline_type: PipelineType
  total_weighted: number
  total_unweighted: number
  by_stage: {
    stage_name: string
    count: number
    unweighted: number
    weighted: number
  }[]
  by_consultant: {
    consultant_id: string
    consultant_name: string
    weighted: number
    count: number
  }[]
}

export interface ForecastVsActual {
  period: string  // e.g. '2026-03'
  forecast_value: number
  actual_value: number
  variance: number
  variance_pct: number
}

// =============================================================================
// Partner Portal Types
// =============================================================================

export interface PartnerPortalLead {
  referral_id: string
  contact_name: string
  referral_status: ReferralStatus
  pipeline_type: PipelineType | null
  pipeline_stage_name: string | null
  created_at: string
  updated_at: string
}

export interface PartnerFlashReport {
  partner_id: string
  partner_name: string
  period_start: string
  period_end: string
  total_referrals: number
  by_status: Record<ReferralStatus, number>
  by_pipeline_stage: { stage_name: string; count: number }[]
  conversion_rate: number
}
