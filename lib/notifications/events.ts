/**
 * Catálogo de event keys para o sistema de notification routing.
 * Cada event_key corresponde a uma entrada na tabela notification_routing_rules.
 * Novos eventos devem ser adicionados aqui E seeded na migração SQL.
 */

// ── Recrutamento ──────────────────────────────────────
export const RECRUITMENT_EVENTS = {
  NEW_CANDIDATE: 'recruitment.new_candidate',
  STAGE_CHANGE: 'recruitment.stage_change',
  INTERVIEW_SCHEDULED: 'recruitment.interview_scheduled',
  CANDIDATE_HIRED: 'recruitment.candidate_hired',
} as const

// ── Pipeline (CRM) ───────────────────────────────────
export const PIPELINE_EVENTS = {
  NEW_NEGOCIO: 'pipeline.new_negocio',
  STAGE_CHANGE: 'pipeline.stage_change',
  WON: 'pipeline.won',
  LOST: 'pipeline.lost',
  SLA_WARNING: 'pipeline.sla_warning',
  SLA_BREACH: 'pipeline.sla_breach',
} as const

// ── Leads ─────────────────────────────────────────────
export const LEAD_EVENTS = {
  NEW_LEAD: 'leads.new_lead',
  ASSIGNED: 'leads.assigned',
  QUALIFIED: 'leads.qualified',
} as const

// ── Processos ─────────────────────────────────────────
export const PROCESS_EVENTS = {
  CREATED: 'processes.created',
  APPROVED: 'processes.approved',
  REJECTED: 'processes.rejected',
  RETURNED: 'processes.returned',
  TASK_ASSIGNED: 'processes.task_assigned',
  TASK_COMPLETED: 'processes.task_completed',
  TASK_OVERDUE: 'processes.task_overdue',
} as const

// ── Imóveis ───────────────────────────────────────────
export const PROPERTY_EVENTS = {
  NEW: 'properties.new',
  STATUS_CHANGE: 'properties.status_change',
  PRICE_CHANGE: 'properties.price_change',
} as const

// ── Crédito ───────────────────────────────────────────
export const CREDIT_EVENTS = {
  NEW_REQUEST: 'credit.new_request',
  STATUS_UPDATE: 'credit.status_update',
} as const

// ── Loja ──────────────────────────────────────────────
export const STORE_EVENTS = {
  NEW_ORDER: 'store.new_order',
  ORDER_SHIPPED: 'store.order_shipped',
} as const

// ── Formações ─────────────────────────────────────────
export const TRAINING_EVENTS = {
  NEW_SESSION: 'training.new_session',
  REMINDER: 'training.reminder',
} as const

// ── Financeiro ────────────────────────────────────────
export const FINANCIAL_EVENTS = {
  COMMISSION_READY: 'financial.commission_ready',
  PAYMENT_PROCESSED: 'financial.payment_processed',
} as const

// ── Módulos disponíveis (para UI) ─────────────────────
export const NOTIFICATION_MODULES = {
  recruitment: 'Recrutamento',
  pipeline: 'Pipeline',
  leads: 'Leads',
  processes: 'Processos',
  properties: 'Imóveis',
  credit: 'Crédito',
  store: 'Loja',
  training: 'Formações',
  financial: 'Financeiro',
} as const

export type NotificationModule = keyof typeof NOTIFICATION_MODULES
