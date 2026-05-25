/**
 * Tipos do payload que o meta-api Mube envia para o webhook do CRM.
 *
 * Schema versionado: `version: "1"`. Se um dia mudar, será `version: "2"`
 * e teremos de decidir se aceitamos ambos ou só v1.
 */

// ============================================================
// lead.created
// ============================================================

export interface MubeLeadFieldData {
  name: string
  values: string[]
}

export interface MubeLeadPayload {
  /** ID interno do lead no meta-api (UUID) */
  id: string
  /** ID do lead na Meta (Facebook Lead ID) */
  leadgen_id: string
  /** Facebook Page ID que recebeu o lead */
  page_id: string
  /** Facebook Form ID (pode ser null em alguns casos) */
  form_id: string | null
  /** Facebook Ad ID (null se lead orgânico) */
  ad_id: string | null
  /** Facebook Campaign ID (null se lead orgânico) */
  campaign_id: string | null
  /** Email normalizado (lowercase + trim) ou null */
  email: string | null
  /** Nome completo ou null */
  full_name: string | null
  /** Telefone sem espaços ou null */
  phone: string | null
  /** Array completo de campos do formulário Meta (todos os field types) */
  field_data: MubeLeadFieldData[]
  /** Quando o lead foi criado na Meta (ISO 8601) */
  fb_created_time: string | null
  /** Quando o meta-api recebeu o webhook da Meta (ISO 8601) */
  received_at: string
}

export interface MubeLeadEvent {
  version: '1'
  event: 'lead.created'
  /** Quando o meta-api enviou para este endpoint (ISO 8601) */
  delivered_at: string
  /** ID do tenant no meta-api (UUID) — deve bater com MUBE_TENANT_ID */
  tenant_id: string
  lead: MubeLeadPayload
}

// ============================================================
// form.synced
// ============================================================

export interface MubeFormQuestion {
  id: string
  key: string
  label: string
  type: string
}

export interface MubeFormPayload {
  /** Meta lead form id (chave de dedup) */
  form_id: string
  /** Facebook Page id dona do form */
  page_id: string | null
  form_name: string | null
  /** ACTIVE | ARCHIVED | DELETED | DRAFT | PAUSED */
  status: string | null
  /** Locale do form (ex. "pt_BR") */
  locale: string | null
  /** Perguntas do form. Estrutura detalhada vive no payload jsonb. */
  questions?: MubeFormQuestion[]
  fb_created_time: string | null
}

export interface MubeFormEvent {
  version: '1'
  event: 'form.synced'
  delivered_at: string
  tenant_id: string
  form: MubeFormPayload
}

// ============================================================
// campaign.synced
// ============================================================

export interface MubeCampaignPayload {
  /** Meta campaign id (chave de dedup) */
  campaign_id: string
  /** Ad Account dono da campanha ("act_<num>") */
  ad_account_id: string | null
  name: string | null
  status: string | null
  /** Ex: LEAD_GENERATION, OUTCOME_LEADS */
  objective: string | null
  /** Centavos como string (formato wire da Meta) */
  daily_budget?: string | null
  lifetime_budget?: string | null
  start_time?: string | null
  stop_time?: string | null
  fb_created_time: string | null
}

export interface MubeCampaignEvent {
  version: '1'
  event: 'campaign.synced'
  delivered_at: string
  tenant_id: string
  campaign: MubeCampaignPayload
}

// ============================================================
// ad.synced
// ============================================================

export interface MubeAdPayload {
  /** Meta ad id (chave de dedup) */
  ad_id: string
  /** Campaign id da campanha pai (FK lógica, sem constraint na BD) */
  campaign_id: string | null
  /** Meta adset id (adsets não são armazenados como entidade) */
  adset_id?: string | null
  name: string | null
  /** Effective status do ad */
  status: string | null
  creative_id?: string | null
  creative_name?: string | null
  fb_created_time: string | null
}

export interface MubeAdEvent {
  version: '1'
  event: 'ad.synced'
  delivered_at: string
  tenant_id: string
  ad: MubeAdPayload
}

// ============================================================
// Discriminated union para a rota multiplex
// ============================================================

export type MubeEvent =
  | MubeLeadEvent
  | MubeFormEvent
  | MubeCampaignEvent
  | MubeAdEvent
