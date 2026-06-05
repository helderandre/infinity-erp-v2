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

/**
 * Custo por lead anexado ao payload de lead.created.
 *
 * `per_lead` chega NULL num lead acabado de criar (o gasto do dia ainda não
 * fechou) — é preenchido depois pelo sync de insights. `basis` indica que é
 * uma aproximação (gasto diário do anúncio ÷ leads do dia), não o custo exacto
 * daquele lead.
 */
export interface MubeLeadCost {
  per_lead: number | null
  currency: string | null
  basis: 'ad_daily_average'
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
  /** Nome do formulário (enriquecido pelo meta-api) */
  form_name?: string | null
  /** Perguntas do formulário (estrutura bruta da Meta) */
  form_questions?: unknown | null
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
  /** Custo por lead (aproximação). null em leads novos. */
  cost?: MubeLeadCost | null
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
// creative.synced — criativo completo (imagem/vídeo/copy/CTA/link)
// ============================================================

export interface MubeCreativePayload {
  /** Meta creative id (chave de dedup). Liga ao ad via ad.creative_id. */
  creative_id: string
  ad_account_id: string | null
  name: string | null
  /** título e copy do criativo */
  title: string | null
  body: string | null
  /** ex.: "LEARN_MORE", "SIGN_UP" */
  cta_type: string | null
  /** link de destino */
  link_url: string | null
  image_url: string | null
  thumbnail_url: string | null
  video_id: string | null
  /** spec cru da Meta, para flexibilidade */
  object_story_spec: Record<string, unknown> | null
}

export interface MubeCreativeEvent {
  version: '1'
  event: 'creative.synced'
  delivered_at: string
  tenant_id: string
  creative: MubeCreativePayload
}

// ============================================================
// insights.synced — PING (não traz métricas)
// ============================================================

export interface MubeInsightsPayload {
  /** Ad Account a que o refresh diz respeito ("act_<num>") */
  ad_account_id: string
  /** Início da janela refrescada (YYYY-MM-DD) */
  since: string
  /** Fim da janela refrescada (YYYY-MM-DD) */
  until: string
  /** Quantas linhas de insights foram upserted na meta-api */
  rows_upserted: number
  /** Quantos custos de lead foram actualizados */
  leads_cost_updated: number
}

export interface MubeInsightsEvent {
  version: '1'
  event: 'insights.synced'
  delivered_at: string
  tenant_id: string
  insights: MubeInsightsPayload
}

// ============================================================
// ad_object.issue — alerta de estado/problema (webhook de Ad Account)
// ============================================================

export interface MubeAdObjectIssuePayload {
  ad_account_id: string
  field: 'with_issues_ad_objects' | 'in_process_ad_objects'
  /** Payload bruto da Meta para esse campo */
  value: unknown
}

export interface MubeAdObjectIssueEvent {
  version: '1'
  event: 'ad_object.issue'
  delivered_at: string
  tenant_id: string
  ad_object: MubeAdObjectIssuePayload
}

// ============================================================
// Discriminated union para a rota multiplex
// ============================================================

export type MubeEvent =
  | MubeLeadEvent
  | MubeFormEvent
  | MubeCampaignEvent
  | MubeAdEvent
  | MubeCreativeEvent
  | MubeInsightsEvent
  | MubeAdObjectIssueEvent

// ============================================================
// GET /api/insights — tipos de leitura (tenant-facing, HMAC server-side)
// ============================================================

/** value vem como string da Graph API */
export interface InsightActionStat {
  action_type: string
  value: string
}

export type InsightLevel = 'account' | 'campaign' | 'adset' | 'ad'

export interface Insight {
  id: string
  ad_account_id: string
  level: InsightLevel
  /** id do objecto no nível indicado */
  object_id: string
  campaign_id: string | null
  adset_id: string | null
  ad_id: string | null
  /** "2026-05-01" (1 linha por dia) */
  date_start: string
  date_stop: string
  spend: number | null
  impressions: number | null
  reach: number | null
  frequency: number | null
  clicks: number | null
  inline_link_clicks: number | null
  cpc: number | null
  cpm: number | null
  ctr: number | null
  /** soma dos action_type de lead */
  leads: number | null
  /** spend ÷ leads (aproximação). null se leads=0 */
  cost_per_lead: number | null
  actions: InsightActionStat[] | null
  action_values: InsightActionStat[] | null
  cost_per_action_type: InsightActionStat[] | null
  /** normalmente vazio em lead-gen (sem pixel de compra) */
  purchase_roas: InsightActionStat[] | null
  account_currency: string | null
  fetched_at: string
}

export interface InsightsResponse {
  insights: Insight[]
  pagination: {
    total: number
    limit: number
    offset: number
    has_more: boolean
  }
}
