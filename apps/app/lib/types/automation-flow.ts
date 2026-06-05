// ============================================================
// automation-flow.ts — Tipos de nodes, edges, flow definition
// Fase 2 do Sistema de Automações
// ============================================================

// ── Tipos de Node ──

export type AutomationNodeType =
  // Triggers (sem input, apenas output)
  | "trigger_webhook"
  | "trigger_status"
  | "trigger_schedule"
  | "trigger_manual"
  // Acções
  | "whatsapp"
  | "email"
  | "delay"
  | "condition"
  | "supabase_query"
  | "task_lookup"
  | "set_variable"
  | "http_request"
  | "webhook_response"
  | "notification"

export type TriggerSourceType = "webhook" | "status_change" | "schedule" | "manual"

export type DelayUnit = "minutes" | "hours" | "days"

export type WhatsAppMessageType = "text" | "image" | "video" | "audio" | "ptt" | "document" | "poll" | "contact"

export function isTriggerType(type: string): boolean {
  return type.startsWith("trigger_")
}

// ── Dados por Tipo de Node ──

export interface TriggerWebhookNodeData {
  label: string
  type: "trigger_webhook"
  webhookKey?: string
  samplePayload?: Record<string, unknown>
  webhookMappings?: WebhookFieldMapping[]
}

export interface TriggerStatusNodeData {
  label: string
  type: "trigger_status"
  triggerCondition?: {
    entity_type: string
    field: string
    values: string[]
    list_name?: string
    event_types?: ("INSERT" | "UPDATE" | "UPSERT")[]
  }
}

export interface TriggerScheduleNodeData {
  label: string
  type: "trigger_schedule"
  cronExpression?: string
  timezone?: string
}

export interface TriggerManualNodeData {
  label: string
  type: "trigger_manual"
}

// ── WhatsApp ──

export interface WhatsAppMessage {
  type: WhatsAppMessageType
  content: string
  mediaUrl?: string
  docName?: string
  delay?: number
  // Poll fields
  pollOptions?: string[]
  pollSelectableCount?: number
  // Contact fields
  contactName?: string
  contactPhone?: string
  contactOrganization?: string
  contactEmail?: string
}

export interface WhatsAppNodeData {
  label: string
  type: "whatsapp"
  messages?: WhatsAppMessage[]
  templateId?: string
  templateName?: string
  recipientVariable?: string
}

// ── Email ──

export interface EmailNodeData {
  label: string
  type: "email"
  emailTemplateId?: string
  emailTemplateName?: string
  subject?: string
  bodyHtml?: string
  editorState?: unknown
  recipientVariable?: string
  senderName?: string
  senderEmail?: string
}

// ── Delay ──

export interface DelayNodeData {
  label: string
  type: "delay"
  value: number
  unit: DelayUnit
}

// ── Condition ──

export type ConditionOperator =
  | "equals"
  | "not_equals"
  | "contains"
  | "not_contains"
  | "greater"
  | "less"
  | "empty"
  | "not_empty"
  | "starts_with"
  | "ends_with"

export const CONDITION_OPERATOR_LABELS: Record<ConditionOperator, string> = {
  equals: "é igual a",
  not_equals: "é diferente de",
  contains: "contém",
  not_contains: "não contém",
  greater: "é maior que",
  less: "é menor que",
  empty: "está vazio",
  not_empty: "não está vazio",
  starts_with: "começa com",
  ends_with: "termina com",
}

export const VALUE_LESS_OPERATORS = new Set<ConditionOperator>(["empty", "not_empty"])

export interface ConditionRule {
  field: string
  operator: ConditionOperator
  value?: string
}

export interface ConditionNodeData {
  label: string
  type: "condition"
  rules: ConditionRule[]
  logic: "and" | "or"
}

// ── Supabase Query ──

export type SupabaseQueryOperation = "select" | "insert" | "update" | "upsert" | "delete" | "rpc"

export interface SupabaseQueryFilter {
  column: string
  operator: "eq" | "neq" | "gt" | "lt" | "gte" | "lte" | "in" | "like" | "is" | "not_is"
  value: string
}

export interface SupabaseQueryData {
  column: string
  value: string
}

export interface SupabaseQueryRpcParam {
  name: string
  value: string
  type?: "text" | "uuid" | "int" | "jsonb" | "boolean"
}

export interface SupabaseQueryNodeData {
  label: string
  type: "supabase_query"
  operation: SupabaseQueryOperation
  table?: string
  columns?: string
  filters?: SupabaseQueryFilter[]
  data?: SupabaseQueryData[]
  upsertConflict?: string
  limit?: number
  single?: boolean
  rpcFunction?: string
  rpcParams?: SupabaseQueryRpcParam[]
  outputVariable?: string
}

// ── Task Lookup ──

export interface TaskLookupInitialField {
  column: string
  valueVariable: string
}

export interface TaskLookupNodeData {
  label: string
  type: "task_lookup"
  entityType: "lead" | "owner" | "user"
  lookupField: string
  lookupVariable: string
  createIfNotFound: boolean
  initialFields?: TaskLookupInitialField[]
  outputVariable?: string
}

// ── Set Variable ──

export interface VariableAssignment {
  key: string
  value: string
}

export interface SetVariableNodeData {
  label: string
  type: "set_variable"
  assignments: VariableAssignment[]
}

// ── HTTP Request ──

export interface HttpRequestNodeData {
  label: string
  type: "http_request"
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE"
  url: string
  headers?: string
  body?: string
  outputVariable?: string
}

// ── Webhook Response ──

export interface WebhookResponseNodeData {
  label: string
  type: "webhook_response"
  statusCode: number
  responseBody: string
  continueAfterResponse: boolean
}

// ── Notification ──

export interface NotificationNodeData {
  label: string
  type: "notification"
  recipientType: "user" | "role" | "variable"
  recipientId?: string
  recipientVariable?: string
  title: string
  body: string
  entityType?: string
  entityIdVariable?: string
}

// ── Union + Flow Definition ──

export type AutomationNodeData =
  | TriggerWebhookNodeData
  | TriggerStatusNodeData
  | TriggerScheduleNodeData
  | TriggerManualNodeData
  | WhatsAppNodeData
  | EmailNodeData
  | DelayNodeData
  | ConditionNodeData
  | SupabaseQueryNodeData
  | TaskLookupNodeData
  | SetVariableNodeData
  | HttpRequestNodeData
  | WebhookResponseNodeData
  | NotificationNodeData

// Nota: Os tipos React Flow (Node, Edge) serão usados quando @xyflow/react for instalado (Fase 5).
// Por agora, definimos interfaces compatíveis para não bloquear F2.

export interface AutomationNode {
  id: string
  type: AutomationNodeType
  position: { x: number; y: number }
  data: AutomationNodeData
}

export interface AutomationEdge {
  id: string
  source: string
  target: string
  sourceHandle?: string | null
  targetHandle?: string | null
  label?: string
}

export interface FlowDefinition {
  version: number
  nodes: AutomationNode[]
  edges: AutomationEdge[]
}

// ── Importação do webhook-mapping (referenciado em TriggerWebhookNodeData) ──

export interface WebhookFieldMapping {
  webhookPath: string
  variableKey: string
  transform?: "uppercase" | "lowercase" | "trim" | "none"
}

// ── Categorias de Node ──

export type NodeCategory = "trigger" | "action" | "logic"

export function getNodeCategory(type: AutomationNodeType): NodeCategory {
  if (isTriggerType(type)) return "trigger"
  if (type === "condition" || type === "task_lookup" || type === "delay") return "logic"
  return "action"
}

export const nodeCategoryConfig: Record<NodeCategory, {
  label: string
  badgeBg: string
  badgeText: string
  badgeDot: string
  cardBorder: string
  cardBg: string
}> = {
  trigger: {
    label: "Trigger",
    badgeBg: "bg-amber-100 dark:bg-amber-900/40",
    badgeText: "text-amber-700 dark:text-amber-300",
    badgeDot: "bg-amber-500",
    cardBorder: "border-amber-200/80 dark:border-amber-800/40",
    cardBg: "bg-amber-50/40 dark:bg-amber-950/10",
  },
  action: {
    label: "Acção",
    badgeBg: "bg-sky-100 dark:bg-sky-900/40",
    badgeText: "text-sky-700 dark:text-sky-300",
    badgeDot: "bg-sky-500",
    cardBorder: "border-sky-200/80 dark:border-sky-800/40",
    cardBg: "bg-sky-50/20 dark:bg-sky-950/10",
  },
  logic: {
    label: "Lógica",
    badgeBg: "bg-rose-100 dark:bg-rose-900/40",
    badgeText: "text-rose-700 dark:text-rose-300",
    badgeDot: "bg-rose-500",
    cardBorder: "border-rose-200/80 dark:border-rose-800/40",
    cardBg: "bg-rose-50/20 dark:bg-rose-950/10",
  },
}

// ── Mapas de Cores por Tipo de Node ──

export const nodeAccentMap: Record<AutomationNodeType, string> = {
  trigger_webhook: "border-l-amber-400/80",
  trigger_status: "border-l-amber-400/80",
  trigger_schedule: "border-l-amber-400/80",
  trigger_manual: "border-l-amber-400/80",
  whatsapp: "border-l-emerald-500/80",
  email: "border-l-sky-400/80",
  delay: "border-l-violet-400/80",
  condition: "border-l-rose-400/80",
  supabase_query: "border-l-indigo-400/80",
  task_lookup: "border-l-blue-400/80",
  set_variable: "border-l-cyan-400/80",
  http_request: "border-l-orange-400/80",
  webhook_response: "border-l-slate-400/80",
  notification: "border-l-yellow-400/80",
}

export const nodeColorBgMap: Record<AutomationNodeType, string> = {
  trigger_webhook: "bg-amber-100/80 dark:bg-amber-900/20",
  trigger_status: "bg-amber-100/80 dark:bg-amber-900/20",
  trigger_schedule: "bg-amber-100/80 dark:bg-amber-900/20",
  trigger_manual: "bg-amber-100/80 dark:bg-amber-900/20",
  whatsapp: "bg-emerald-100/80 dark:bg-emerald-900/20",
  email: "bg-sky-100/80 dark:bg-sky-900/20",
  delay: "bg-violet-100/80 dark:bg-violet-900/20",
  condition: "bg-rose-100/80 dark:bg-rose-900/20",
  supabase_query: "bg-indigo-100/80 dark:bg-indigo-900/20",
  task_lookup: "bg-blue-100/80 dark:bg-blue-900/20",
  set_variable: "bg-cyan-100/80 dark:bg-cyan-900/20",
  http_request: "bg-orange-100/80 dark:bg-orange-900/20",
  webhook_response: "bg-slate-100/80 dark:bg-slate-900/20",
  notification: "bg-yellow-100/80 dark:bg-yellow-900/20",
}

export const nodeColorTextMap: Record<AutomationNodeType, string> = {
  trigger_webhook: "text-amber-600 dark:text-amber-400",
  trigger_status: "text-amber-600 dark:text-amber-400",
  trigger_schedule: "text-amber-600 dark:text-amber-400",
  trigger_manual: "text-amber-600 dark:text-amber-400",
  whatsapp: "text-emerald-600 dark:text-emerald-400",
  email: "text-sky-600 dark:text-sky-400",
  delay: "text-violet-600 dark:text-violet-400",
  condition: "text-rose-600 dark:text-rose-400",
  supabase_query: "text-indigo-600 dark:text-indigo-400",
  task_lookup: "text-blue-600 dark:text-blue-400",
  set_variable: "text-cyan-600 dark:text-cyan-400",
  http_request: "text-orange-600 dark:text-orange-400",
  webhook_response: "text-slate-600 dark:text-slate-400",
  notification: "text-yellow-600 dark:text-yellow-400",
}

export const nodeSidebarMap: Record<AutomationNodeType, string> = {
  trigger_webhook: "border-amber-200/60 hover:border-amber-300 hover:bg-amber-50/50 dark:border-amber-800/30 dark:hover:border-amber-700 dark:hover:bg-amber-950/20",
  trigger_status: "border-amber-200/60 hover:border-amber-300 hover:bg-amber-50/50 dark:border-amber-800/30 dark:hover:border-amber-700 dark:hover:bg-amber-950/20",
  trigger_schedule: "border-amber-200/60 hover:border-amber-300 hover:bg-amber-50/50 dark:border-amber-800/30 dark:hover:border-amber-700 dark:hover:bg-amber-950/20",
  trigger_manual: "border-amber-200/60 hover:border-amber-300 hover:bg-amber-50/50 dark:border-amber-800/30 dark:hover:border-amber-700 dark:hover:bg-amber-950/20",
  whatsapp: "border-emerald-200/60 hover:border-emerald-300 hover:bg-emerald-50/50 dark:border-emerald-800/30 dark:hover:border-emerald-700 dark:hover:bg-emerald-950/20",
  email: "border-sky-200/60 hover:border-sky-300 hover:bg-sky-50/50 dark:border-sky-800/30 dark:hover:border-sky-700 dark:hover:bg-sky-950/20",
  delay: "border-violet-200/60 hover:border-violet-300 hover:bg-violet-50/50 dark:border-violet-800/30 dark:hover:border-violet-700 dark:hover:bg-violet-950/20",
  condition: "border-rose-200/60 hover:border-rose-300 hover:bg-rose-50/50 dark:border-rose-800/30 dark:hover:border-rose-700 dark:hover:bg-rose-950/20",
  supabase_query: "border-indigo-200/60 hover:border-indigo-300 hover:bg-indigo-50/50 dark:border-indigo-800/30 dark:hover:border-indigo-700 dark:hover:bg-indigo-950/20",
  task_lookup: "border-blue-200/60 hover:border-blue-300 hover:bg-blue-50/50 dark:border-blue-800/30 dark:hover:border-blue-700 dark:hover:bg-blue-950/20",
  set_variable: "border-cyan-200/60 hover:border-cyan-300 hover:bg-cyan-50/50 dark:border-cyan-800/30 dark:hover:border-cyan-700 dark:hover:bg-cyan-950/20",
  http_request: "border-orange-200/60 hover:border-orange-300 hover:bg-orange-50/50 dark:border-orange-800/30 dark:hover:border-orange-700 dark:hover:bg-orange-950/20",
  webhook_response: "border-slate-200/60 hover:border-slate-300 hover:bg-slate-50/50 dark:border-slate-800/30 dark:hover:border-slate-700 dark:hover:bg-slate-950/20",
  notification: "border-yellow-200/60 hover:border-yellow-300 hover:bg-yellow-50/50 dark:border-yellow-800/30 dark:hover:border-yellow-700 dark:hover:bg-yellow-950/20",
}
