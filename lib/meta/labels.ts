/**
 * Labels canónicos PT-PT para entidades Meta (objectivo, status, locale).
 * Partilhado por todas as páginas /dashboard/analise-meta/*.
 *
 * Conhecidos vêm da documentação Graph API + observado em meta.meta_*_raw:
 *   - objective: OUTCOME_LEADS (2026-05)
 *   - campaign/ad status: ACTIVE, PAUSED, ARCHIVED, WITH_ISSUES
 *   - form status: ACTIVE, ARCHIVED
 *   - form locale: en_US, fr_FR, pt_BR, pt_PT
 *
 * Para valores não mapeados devolvemos o próprio valor (fail-soft).
 */

// ---------------------------------------------------------------------------
// Campaign objective
// https://developers.facebook.com/docs/marketing-api/reference/ad-campaign-group
// ---------------------------------------------------------------------------

const CAMPAIGN_OBJECTIVE_LABEL: Record<string, string> = {
  // ODAX (Outcome-driven, current)
  OUTCOME_AWARENESS: 'Notoriedade',
  OUTCOME_TRAFFIC: 'Tráfego',
  OUTCOME_ENGAGEMENT: 'Interacção',
  OUTCOME_LEADS: 'Geração de Leads',
  OUTCOME_APP_PROMOTION: 'Promoção de App',
  OUTCOME_SALES: 'Vendas',
  // Legacy
  LEAD_GENERATION: 'Geração de Leads (legado)',
  BRAND_AWARENESS: 'Notoriedade de Marca (legado)',
  REACH: 'Alcance (legado)',
  LINK_CLICKS: 'Cliques (legado)',
  CONVERSIONS: 'Conversões (legado)',
  POST_ENGAGEMENT: 'Interacção (legado)',
  PAGE_LIKES: 'Likes (legado)',
  VIDEO_VIEWS: 'Vídeo (legado)',
  MESSAGES: 'Mensagens (legado)',
  APP_INSTALLS: 'Instalações (legado)',
  PRODUCT_CATALOG_SALES: 'Catálogo (legado)',
  STORE_VISITS: 'Visitas à Loja (legado)',
  EVENT_RESPONSES: 'Respostas a Eventos (legado)',
}

export function formatCampaignObjective(value: string | null): string {
  if (!value) return '—'
  return CAMPAIGN_OBJECTIVE_LABEL[value] ?? value
}

// ---------------------------------------------------------------------------
// Entity status (campaign / ad / adset / form)
// effective_status nos endpoints Graph; status para forms
// ---------------------------------------------------------------------------

const META_STATUS_LABEL: Record<string, string> = {
  ACTIVE: 'Activo',
  PAUSED: 'Em pausa',
  ARCHIVED: 'Arquivado',
  DELETED: 'Eliminado',
  DRAFT: 'Rascunho',
  WITH_ISSUES: 'Com problemas',
  // Status específicos de ad/adset (effective_status)
  CAMPAIGN_PAUSED: 'Campanha em pausa',
  ADSET_PAUSED: 'Conjunto em pausa',
  IN_PROCESS: 'Em processamento',
  PENDING_REVIEW: 'Em revisão',
  DISAPPROVED: 'Rejeitado',
  PREAPPROVED: 'Pré-aprovado',
  PENDING_BILLING_INFO: 'Aguarda dados de pagamento',
  // Form-specific
  EXPIRED: 'Expirado',
}

export function formatMetaStatus(value: string | null): string {
  if (!value) return '—'
  return META_STATUS_LABEL[value] ?? value
}

/**
 * Variant do badge para status. Activo verde, pausado neutro, problemas/erro
 * vermelho, arquivado outlined.
 */
export function metaStatusVariant(
  value: string | null,
): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (!value) return 'outline'
  if (value === 'ACTIVE') return 'default'
  if (
    value === 'WITH_ISSUES' ||
    value === 'DISAPPROVED' ||
    value === 'EXPIRED'
  )
    return 'destructive'
  if (value === 'PAUSED' || value === 'CAMPAIGN_PAUSED' || value === 'ADSET_PAUSED')
    return 'secondary'
  return 'outline'
}

// ---------------------------------------------------------------------------
// Account status (ad account numeric)
// 1=ACTIVE, 2=DISABLED, 3=UNSETTLED, 7=PENDING_RISK_REVIEW,
// 8=PENDING_SETTLEMENT, 9=IN_GRACE_PERIOD, 100=PENDING_CLOSURE, 101=CLOSED,
// 201=ANY_ACTIVE, 202=ANY_CLOSED
// ---------------------------------------------------------------------------

const AD_ACCOUNT_STATUS_LABEL: Record<number, string> = {
  1: 'Activa',
  2: 'Desactivada',
  3: 'Pagamento pendente',
  7: 'Revisão de risco',
  8: 'Aguarda liquidação',
  9: 'Período de graça',
  100: 'Encerramento pendente',
  101: 'Encerrada',
  201: 'Qualquer activa',
  202: 'Qualquer encerrada',
}

export function formatAdAccountStatus(value: number | null): string {
  if (value === null || value === undefined) return '—'
  return AD_ACCOUNT_STATUS_LABEL[value] ?? String(value)
}

export function adAccountStatusVariant(
  value: number | null,
): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (value === 1) return 'default'
  if (value === 2 || value === 100 || value === 101) return 'destructive'
  if (value === 3 || value === 8 || value === 9 || value === 7)
    return 'secondary'
  return 'outline'
}

// ---------------------------------------------------------------------------
// Locale
// ---------------------------------------------------------------------------

const LOCALE_LABEL: Record<string, string> = {
  pt_PT: 'Português (PT)',
  pt_BR: 'Português (BR)',
  en_US: 'Inglês (US)',
  en_GB: 'Inglês (UK)',
  es_ES: 'Espanhol',
  es_LA: 'Espanhol (LA)',
  fr_FR: 'Francês',
  it_IT: 'Italiano',
  de_DE: 'Alemão',
  nl_NL: 'Holandês',
}

export function formatLocale(value: string | null): string {
  if (!value) return '—'
  return LOCALE_LABEL[value] ?? value
}

// ---------------------------------------------------------------------------
// Currency formatting (cents string from Meta wire format → EUR string)
// ---------------------------------------------------------------------------

export function formatMetaBudgetCents(
  cents: string | null,
  currency: string | null = 'EUR',
): string {
  if (!cents) return '—'
  const n = Number(cents)
  if (!Number.isFinite(n)) return '—'
  try {
    return new Intl.NumberFormat('pt-PT', {
      style: 'currency',
      currency: currency ?? 'EUR',
      maximumFractionDigits: 0,
    }).format(n / 100)
  } catch {
    // Currency inválida → fallback sem símbolo
    return `${(n / 100).toFixed(0)} ${currency ?? ''}`.trim()
  }
}

// ---------------------------------------------------------------------------
// Insights — formatação de métricas de desempenho
// (spend/cpc/cpm/cost_per_lead vêm já em unidades monetárias, NÃO em cents)
// ---------------------------------------------------------------------------

export function formatEur(
  value: number | null | undefined,
  currency: string | null = 'EUR',
  opts?: { maximumFractionDigits?: number },
): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—'
  try {
    return new Intl.NumberFormat('pt-PT', {
      style: 'currency',
      currency: currency ?? 'EUR',
      maximumFractionDigits: opts?.maximumFractionDigits ?? 2,
    }).format(value)
  } catch {
    return `${value.toFixed(2)} ${currency ?? ''}`.trim()
  }
}

export function formatMetaInt(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—'
  return new Intl.NumberFormat('pt-PT', { maximumFractionDigits: 0 }).format(value)
}

export function formatMetaPct(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—'
  return `${value.toFixed(2)}%`
}

// ---------------------------------------------------------------------------
// Form question type
// ---------------------------------------------------------------------------

const QUESTION_TYPE_LABEL: Record<string, string> = {
  CUSTOM: 'Pergunta personalizada',
  FULL_NAME: 'Nome completo',
  FIRST_NAME: 'Nome próprio',
  LAST_NAME: 'Apelido',
  EMAIL: 'Email',
  PHONE: 'Telefone',
  PHONE_NUMBER: 'Telefone',
  STREET_ADDRESS: 'Morada',
  CITY: 'Cidade',
  STATE: 'Distrito',
  COUNTRY: 'País',
  PROVINCE: 'Província',
  ZIP_CODE: 'Código postal',
  POST_CODE: 'Código postal',
  COMPANY_NAME: 'Empresa',
  JOB_TITLE: 'Cargo',
  WORK_EMAIL: 'Email profissional',
  WORK_PHONE_NUMBER: 'Telefone profissional',
  DOB: 'Data de nascimento',
  GENDER: 'Género',
  MARITAL_STATUS: 'Estado civil',
  RELATIONSHIP_STATUS: 'Estado civil',
  MILITARY_STATUS: 'Estado militar',
  USER_BIRTHDAY: 'Data de nascimento',
  STORE_LOOKUP: 'Loja',
  APPOINTMENT_REQUEST: 'Marcação',
}

export function formatQuestionType(value: string | null): string {
  if (!value) return '—'
  return QUESTION_TYPE_LABEL[value] ?? value
}
