# SPEC-AUTO-F2-TIPOS-VARIAVEIS — Fase 2: Tipos TypeScript, Template Engine e Sistema de Variáveis

**Data:** 2026-03-05
**Prioridade:** 🔴 Crítica (bloqueia F4, F5, F6)
**Estimativa:** 1-2 sessões de Claude Code
**Pré-requisitos:** F1 concluída (tabelas criadas)

---

## 📋 Objectivo

Criar toda a camada de tipos TypeScript, o template engine para resolução de variáveis, o avaliador de condições, o mapeamento de webhooks, e o componente de seletor de variáveis com pills visuais. Esta fase estabelece os contratos de dados que todas as fases seguintes utilizam.

---

## 📁 Ficheiros a Criar

| Ficheiro | Responsabilidade |
|----------|-----------------|
| `lib/types/automation-flow.ts` | Todos os tipos de nodes, edges, flow definition, enums |
| `lib/types/whatsapp-template.ts` | Tipos para templates e mensagens WhatsApp |
| `lib/template-engine.ts` | Renderização de variáveis `{{var}}`, fallbacks, condicionais |
| `lib/condition-evaluator.ts` | Avaliação de regras condicionais (if/else) |
| `lib/webhook-mapping.ts` | Mapeamento de payload webhook → variáveis |
| `lib/retry.ts` | Lógica de retry com exponential backoff |
| `components/automations/variable-picker.tsx` | Seletor visual de variáveis com pills coloridas |

---

## 📦 `lib/types/automation-flow.ts`

### Tipos de Node

```typescript
// Todos os tipos de node disponíveis no editor
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

// Tipos de trigger
export type TriggerSourceType = "webhook" | "status_change" | "schedule" | "manual"

// Unidades de delay
export type DelayUnit = "minutes" | "hours" | "days"

// Tipos de mensagem WhatsApp (alinhado com Uazapi /send/media)
export type WhatsAppMessageType = "text" | "image" | "video" | "audio" | "ptt" | "document"

// Helper para verificar se é trigger
export function isTriggerType(type: string): boolean {
  return type.startsWith("trigger_")
}
```

### Dados por Tipo de Node

```typescript
// ── Trigger Webhook ──
export interface TriggerWebhookNodeData {
  label: string
  type: "trigger_webhook"
  webhookKey?: string                    // Chave única 16 chars
  samplePayload?: Record<string, unknown>
  webhookMappings?: WebhookFieldMapping[]
}

// ── Trigger Status Change ──
export interface TriggerStatusNodeData {
  label: string
  type: "trigger_status"
  triggerCondition?: {
    entity_type: string          // 'lead', 'process', 'deal'
    field: string                // 'estado', 'current_status'
    values: string[]             // ['Aprovado', 'Fechado']
    list_name?: string           // Cache visual
    event_types?: ("INSERT" | "UPDATE" | "UPSERT")[]
  }
}

// ── Trigger Schedule ──
export interface TriggerScheduleNodeData {
  label: string
  type: "trigger_schedule"
  cronExpression?: string        // "0 9 * * 1-5" = Seg-Sex às 9h
  timezone?: string              // "Europe/Lisbon"
}

// ── Trigger Manual ──
export interface TriggerManualNodeData {
  label: string
  type: "trigger_manual"
}

// ── WhatsApp ──
export interface WhatsAppMessage {
  type: WhatsAppMessageType
  content: string                // Texto ou legenda (suporta variáveis)
  mediaUrl?: string              // URL do ficheiro
  docName?: string               // Nome do documento
  delay?: number                 // ms de "digitando..." antes de enviar
}

export interface WhatsAppNodeData {
  label: string
  type: "whatsapp"
  // Modo 1: mensagens inline neste nó
  messages?: WhatsAppMessage[]
  // Modo 2: usar template da biblioteca
  templateId?: string            // UUID do auto_wpp_templates
  templateName?: string          // Cache visual do nome
}

// ── Email ──
export interface EmailNodeData {
  label: string
  type: "email"
  // Modo 1: template da biblioteca existente (tpl_email_library)
  emailTemplateId?: string
  emailTemplateName?: string
  // Modo 2: configuração inline
  subject?: string
  bodyHtml?: string
  editorState?: unknown          // Estado do editor visual (Craft.js)
  // Destinatário
  recipientVariable?: string     // Variável que contém o email (ex: "lead_email")
}

// ── Delay ──
export interface DelayNodeData {
  label: string
  type: "delay"
  value: number
  unit: DelayUnit
}

// ── Condition ──
export interface ConditionRule {
  field: string                  // Variável a comparar
  operator: ConditionOperator
  value?: string                 // Valor de comparação
}

export type ConditionOperator =
  | "equals" | "not_equals"
  | "contains" | "not_contains"
  | "greater" | "less"
  | "empty" | "not_empty"
  | "starts_with" | "ends_with"

// Labels PT-PT para operadores (usar na UI)
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

// Operadores que não precisam de campo valor
export const VALUE_LESS_OPERATORS = new Set<ConditionOperator>(["empty", "not_empty"])

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
  operator: "eq" | "neq" | "gt" | "lt" | "gte" | "lte" | "in" | "like" | "is"
  value: string                  // Pode conter {{variável}}
}

export interface SupabaseQueryData {
  column: string
  value: string                  // Pode conter {{variável}} ou valor fixo
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
  // Para operações de tabela
  table?: string
  columns?: string               // "id, name, email" ou "*"
  filters?: SupabaseQueryFilter[]
  data?: SupabaseQueryData[]
  upsertConflict?: string        // "column1,column2"
  limit?: number
  single?: boolean
  // Para RPC
  rpcFunction?: string
  rpcParams?: SupabaseQueryRpcParam[]
  // Saída
  outputVariable?: string        // Nome da variável com resultado
}

// ── Task Lookup (Buscar/Criar Lead) ──
export interface TaskLookupInitialField {
  column: string
  valueVariable: string          // {{variável}} ou valor fixo
}

export interface TaskLookupNodeData {
  label: string
  type: "task_lookup"
  entityType: "lead" | "owner" | "user"   // Que tabela pesquisar
  lookupField: string                      // "email", "telefone", "nif"
  lookupVariable: string                   // Variável com o valor de busca
  createIfNotFound: boolean
  initialFields?: TaskLookupInitialField[]
  outputVariable?: string                  // Default: "entity_id"
}

// ── Set Variable ──
export interface VariableAssignment {
  key: string                    // Nome da variável
  value: string                  // Valor ou expressão com {{variáveis}}
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
  url: string                    // Suporta {{variáveis}}
  headers?: string               // JSON string
  body?: string                  // JSON string com {{variáveis}}
  outputVariable?: string
}

// ── Webhook Response ──
export interface WebhookResponseNodeData {
  label: string
  type: "webhook_response"
  statusCode: number             // 200, 201, 400, etc.
  responseBody: string           // JSON template com {{variáveis}}
  continueAfterResponse: boolean // Se true, nodes seguintes rodam async
}

// ── Notification ──
export interface NotificationNodeData {
  label: string
  type: "notification"
  recipientType: "user" | "role" | "variable"
  recipientId?: string           // UUID do user ou role
  recipientVariable?: string     // Variável com o user_id
  title: string                  // Suporta {{variáveis}}
  body: string                   // Suporta {{variáveis}}
  entityType?: string            // Para link na notificação
  entityIdVariable?: string
}
```

### Union Type e Flow Definition

```typescript
// Union de todos os dados de node
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

// Tipos React Flow
import type { Node, Edge } from "@xyflow/react"
export type AutomationNode = Node<AutomationNodeData, AutomationNodeType>
export type AutomationEdge = Edge

// Definição completa do fluxo (armazenada em auto_flows.flow_definition)
export interface FlowDefinition {
  version: number                // 1 = inicial
  nodes: AutomationNode[]
  edges: AutomationEdge[]
}
```

### Mapas de Cores por Tipo de Node

```typescript
// ── Cor do border-left do node ──
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

// ── Background do ícone ──
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

// ── Cor do texto do ícone ──
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

// ── Cores da sidebar (hover) ──
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
```

---

## 📦 `lib/template-engine.ts`

Motor centralizado para substituição de variáveis em templates de mensagens, emails e respostas webhook.

```typescript
/**
 * Template Engine do ERP Infinity
 *
 * Suporta:
 * - {{variável}}                    — substituição simples
 * - {{variável|texto alternativo}}  — fallback quando variável não tem valor
 * - {{#se variável}}...{{/se}}      — condicional simples
 * - {{#se variável}}...{{senão}}...{{/se}} — condicional com else
 *
 * NOTA: Internamente usa {{var}} mas o utilizador nunca vê esta sintaxe.
 * A UI mostra pills visuais que são convertidas para {{var}} no save.
 */

export function renderTemplate(
  template: string,
  variables: Record<string, string | null | undefined>
): string {
  let result = template

  // 1. Processar condicionais {{#se campo}}...{{senão}}...{{/se}}
  result = result.replace(
    /\{\{#se\s+(\w+)\}\}([\s\S]*?)(?:\{\{senão\}\}([\s\S]*?))?\{\{\/se\}\}/g,
    (_match, key: string, ifBlock: string, elseBlock?: string) => {
      const value = variables[key]
      const hasValue = value !== null && value !== undefined && value.trim() !== ""
      return hasValue ? ifBlock.trim() : (elseBlock?.trim() ?? "")
    }
  )

  // 2. Processar variáveis com fallback {{variável|fallback}}
  result = result.replace(
    /\{\{(\w+)\|([^}]+)\}\}/g,
    (_match, key: string, fallback: string) => {
      const value = variables[key]
      return value !== null && value !== undefined && value.trim() !== ""
        ? value
        : fallback.trim()
    }
  )

  // 3. Processar variáveis simples {{variável}}
  result = result.replace(
    /\{\{(\w+)\}\}/g,
    (_match, key: string) => variables[key] ?? ""
  )

  return result
}

/**
 * Extrai todas as variáveis únicas de um template.
 */
export function extractVariables(template: string): string[] {
  const vars = new Set<string>()
  const patterns = [
    /\{\{(\w+)\}\}/g,
    /\{\{(\w+)\|[^}]+\}\}/g,
    /\{\{#se\s+(\w+)\}\}/g,
  ]
  for (const pattern of patterns) {
    let match
    while ((match = pattern.exec(template)) !== null) {
      vars.add(match[1])
    }
  }
  return Array.from(vars).sort()
}

/**
 * Extrai variáveis de todos os nodes de um fluxo.
 * Percorre mensagens WhatsApp, emails, condições, queries, etc.
 */
export function extractVariablesFromNodes(
  nodes: Array<{ data: Record<string, unknown> }>
): string[] {
  const allVars = new Set<string>()

  for (const node of nodes) {
    const d = node.data
    const type = d.type as string

    // WhatsApp — mensagens inline
    if (type === "whatsapp" && Array.isArray(d.messages)) {
      for (const msg of d.messages as Array<{ content?: string; caption?: string }>) {
        for (const v of extractVariables(msg.content || "")) allVars.add(v)
        for (const v of extractVariables(msg.caption || "")) allVars.add(v)
      }
    }

    // Email
    if (type === "email") {
      for (const v of extractVariables((d.subject as string) || "")) allVars.add(v)
      for (const v of extractVariables((d.bodyHtml as string) || "")) allVars.add(v)
    }

    // Webhook Response
    if (type === "webhook_response") {
      for (const v of extractVariables((d.responseBody as string) || "")) allVars.add(v)
    }

    // HTTP Request
    if (type === "http_request") {
      for (const v of extractVariables((d.url as string) || "")) allVars.add(v)
      for (const v of extractVariables((d.body as string) || "")) allVars.add(v)
      for (const v of extractVariables((d.headers as string) || "")) allVars.add(v)
    }

    // Notification
    if (type === "notification") {
      for (const v of extractVariables((d.title as string) || "")) allVars.add(v)
      for (const v of extractVariables((d.body as string) || "")) allVars.add(v)
    }

    // Set Variable — valores
    if (type === "set_variable" && Array.isArray(d.assignments)) {
      for (const a of d.assignments as Array<{ value?: string }>) {
        for (const v of extractVariables(a.value || "")) allVars.add(v)
      }
    }

    // Supabase Query — filtros e dados
    if (type === "supabase_query") {
      for (const f of (d.filters as Array<{ value?: string }>) || []) {
        for (const v of extractVariables(f.value || "")) allVars.add(v)
      }
      for (const item of (d.data as Array<{ value?: string }>) || []) {
        for (const v of extractVariables(item.value || "")) allVars.add(v)
      }
      for (const p of (d.rpcParams as Array<{ value?: string }>) || []) {
        for (const v of extractVariables(p.value || "")) allVars.add(v)
      }
    }

    // Condition — campos
    if (type === "condition" && Array.isArray(d.rules)) {
      for (const r of d.rules as Array<{ field?: string; value?: string }>) {
        if (r.field) allVars.add(r.field)
      }
    }

    // Task Lookup
    if (type === "task_lookup") {
      const lv = d.lookupVariable as string
      if (lv) for (const v of extractVariables(lv)) allVars.add(v)
    }

    // Webhook Trigger — mappings produzem variáveis
    if (type === "trigger_webhook" && Array.isArray(d.webhookMappings)) {
      for (const m of d.webhookMappings as Array<{ variableKey?: string }>) {
        if (m.variableKey) allVars.add(m.variableKey)
      }
    }
  }

  return Array.from(allVars).sort()
}
```

---

## 📦 `lib/condition-evaluator.ts`

```typescript
import type { ConditionRule, ConditionOperator } from "@/lib/types/automation-flow"

/**
 * Avalia um conjunto de regras condicionais.
 * Usado pelo worker (execução real) e pelo frontend (preview).
 */
export function evaluateCondition(
  rules: ConditionRule[],
  logic: "and" | "or",
  variables: Record<string, string | null | undefined>
): boolean {
  if (rules.length === 0) return true

  const results = rules.map((rule) => {
    const value = (variables[rule.field] ?? "").toString()
    const target = rule.value ?? ""

    switch (rule.operator) {
      case "equals":      return value === target
      case "not_equals":  return value !== target
      case "contains":    return value.toLowerCase().includes(target.toLowerCase())
      case "not_contains": return !value.toLowerCase().includes(target.toLowerCase())
      case "greater":     return Number(value) > Number(target)
      case "less":        return Number(value) < Number(target)
      case "empty":       return !value || value.trim() === ""
      case "not_empty":   return !!value && value.trim() !== ""
      case "starts_with": return value.toLowerCase().startsWith(target.toLowerCase())
      case "ends_with":   return value.toLowerCase().endsWith(target.toLowerCase())
      default:            return false
    }
  })

  return logic === "and" ? results.every(Boolean) : results.some(Boolean)
}
```

---

## 📦 `lib/webhook-mapping.ts`

```typescript
export interface WebhookFieldMapping {
  webhookPath: string       // "data.customer.email"
  variableKey: string       // "lead_email"
  transform?: "uppercase" | "lowercase" | "trim" | "none"
}

/**
 * Extrai valor de um objecto por path em dot notation.
 * Suporta arrays: "items[0].name"
 */
export function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  return path.split(".").reduce((current: unknown, key: string) => {
    if (current === null || current === undefined) return undefined
    // Suporte a arrays: "items[0]"
    const arrayMatch = key.match(/^(\w+)\[(\d+)\]$/)
    if (arrayMatch) {
      const arr = (current as Record<string, unknown>)[arrayMatch[1]]
      return Array.isArray(arr) ? arr[Number(arrayMatch[2])] : undefined
    }
    return (current as Record<string, unknown>)[key]
  }, obj)
}

/**
 * Resolve mapeamento de payload webhook para variáveis.
 */
export function resolveWebhookMapping(
  payload: Record<string, unknown>,
  mappings: WebhookFieldMapping[]
): Record<string, string> {
  const result: Record<string, string> = {}

  for (const mapping of mappings) {
    const value = getNestedValue(payload, mapping.webhookPath)
    if (value !== null && value !== undefined) {
      let strValue = String(value)
      switch (mapping.transform) {
        case "uppercase": strValue = strValue.toUpperCase(); break
        case "lowercase": strValue = strValue.toLowerCase(); break
        case "trim":      strValue = strValue.trim(); break
      }
      result[mapping.variableKey] = strValue
    }
  }

  return result
}

/**
 * Extrai recursivamente todos os caminhos de um objecto JSON.
 * Usado para popular o seletor de campos no mapeamento de webhook.
 */
export function extractAllPaths(
  obj: Record<string, unknown>,
  prefix = "",
  maxDepth = 5
): Array<{ path: string; value: unknown; type: string }> {
  const paths: Array<{ path: string; value: unknown; type: string }> = []
  if (maxDepth <= 0) return paths

  for (const [key, value] of Object.entries(obj)) {
    const currentPath = prefix ? `${prefix}.${key}` : key
    const valueType = Array.isArray(value) ? "array"
      : value === null ? "null"
      : typeof value

    paths.push({ path: currentPath, value, type: valueType })

    if (value && typeof value === "object" && !Array.isArray(value)) {
      paths.push(...extractAllPaths(value as Record<string, unknown>, currentPath, maxDepth - 1))
    }
  }

  return paths
}
```

---

## 📦 `lib/retry.ts`

```typescript
export interface RetryConfig {
  maxRetries: number
  baseDelayMs: number
  maxDelayMs: number
  backoffMultiplier: number
}

export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 300_000,     // 5 minutos
  backoffMultiplier: 2,
}

/**
 * Calcula o delay para a próxima tentativa.
 * Exponential backoff + jitter aleatório.
 */
export function calculateRetryDelay(
  attempt: number,
  config: RetryConfig = DEFAULT_RETRY_CONFIG
): number {
  const exponentialDelay = config.baseDelayMs * Math.pow(config.backoffMultiplier, attempt)
  const jitter = Math.random() * 1000
  return Math.min(exponentialDelay + jitter, config.maxDelayMs)
}

/**
 * Calcula o timestamp da próxima tentativa.
 */
export function calculateNextRetryAt(
  attempt: number,
  config: RetryConfig = DEFAULT_RETRY_CONFIG
): Date {
  const delayMs = calculateRetryDelay(attempt, config)
  return new Date(Date.now() + delayMs)
}
```

---

## 📦 `components/automations/variable-picker.tsx`

Componente de seletor de variáveis com pills visuais coloridas por categoria. O utilizador clica num botão "+" ou digita "/" para abrir o seletor, navega por categorias, e seleciona uma variável que aparece como pill não-editável no campo.

### Comportamento

1. **Abrir seletor:** Clicar no botão `{ }` junto ao campo, ou digitar `/` dentro do campo
2. **Navegar:** Categorias em tabs horizontais (Lead, Imóvel, Consultor, Proprietário, Sistema)
3. **Pesquisar:** Campo de busca no topo do dropdown filtra por label
4. **Selecionar:** Clicar numa variável insere uma pill no campo
5. **Pill visual:** Badge colorido com ícone da categoria + label, não editável, apaga como unidade
6. **Valor de exemplo:** Ao lado de cada variável no dropdown, mostra valor de amostra em cinza

### Interface do componente

```typescript
interface VariablePickerProps {
  onSelect: (variable: { key: string; label: string; category: string; color: string }) => void
  // Variáveis disponíveis filtradas por contexto (ex: variáveis de webhook só aparecem em fluxos com webhook trigger)
  additionalVariables?: Array<{ key: string; label: string; category: string; color: string }>
  // Se true, mostra versão compacta (ícone apenas, sem dropdown inline)
  compact?: boolean
}
```

### Fonte de dados

O componente carrega variáveis de duas fontes:
1. **`tpl_variables`** — Variáveis do sistema (consulta via API ao montar)
2. **Variáveis de webhook** — Passadas via prop `additionalVariables` (vindas dos mapeamentos do trigger)

### Estrutura visual do dropdown

```
┌─────────────────────────────────────────────┐
│ 🔍 Pesquisar variável...                    │
├─────────────────────────────────────────────┤
│ Lead  Imóvel  Consultor  Proprietário  ...  │  ← Tabs
├─────────────────────────────────────────────┤
│ 🔵 Nome do Lead          "João Silva"      │
│ 🔵 Email do Lead         "joao@email.com"  │
│ 🔵 Telefone do Lead      "+351 912..."     │
│ 🔵 Telemóvel do Lead     "+351 963..."     │
│ 🔵 Origem do Lead        "Website"         │
│ 🔵 Estado do Lead        "Novo"            │
│ 🔵 Temperatura do Lead   "Quente"          │
└─────────────────────────────────────────────┘
```

### Padrão a seguir

Reutilizar o padrão de `Popover` + `Command` (cmdk) já usado no projecto (ex: `store-node.tsx` do LeveMãe). O `Command` fornece pesquisa integrada, agrupamento por `CommandGroup`, e selecção com teclado.

```typescript
// Pseudo-estrutura do componente
<Popover>
  <PopoverTrigger>
    <Button variant="outline" size="sm">
      <Braces className="h-3 w-3" />
      Variável
    </Button>
  </PopoverTrigger>
  <PopoverContent>
    <Command>
      <CommandInput placeholder="Pesquisar variável..." />
      <CommandList>
        <CommandGroup heading="Lead">
          {leadVars.map(v => (
            <CommandItem onSelect={() => onSelect(v)}>
              <Badge style={{ background: v.color }}>
                {v.label}
              </Badge>
              <span className="text-muted-foreground text-xs ml-auto">
                {v.sampleValue}
              </span>
            </CommandItem>
          ))}
        </CommandGroup>
        {/* Mais grupos... */}
      </CommandList>
    </Command>
  </PopoverContent>
</Popover>
```

---

## ✅ Critérios de Aceitação

### Verificação Automática
- [ ] `npm run build` passa sem erros de tipo
- [ ] Todos os tipos exportados são utilizáveis: importar em ficheiro de teste
- [ ] `renderTemplate("Olá {{nome}}", { nome: "João" })` retorna `"Olá João"`
- [ ] `renderTemplate("{{nome|Cliente}}", {})` retorna `"Cliente"`
- [ ] `extractVariables("{{a}} {{b|x}} {{#se c}}{{/se}}")` retorna `["a", "b", "c"]`
- [ ] `evaluateCondition([{field:"x",operator:"equals",value:"1"}], "and", {x:"1"})` retorna `true`
- [ ] `resolveWebhookMapping({data:{email:"a@b.com"}}, [{webhookPath:"data.email",variableKey:"email"}])` retorna `{email:"a@b.com"}`
- [ ] `extractAllPaths({a:{b:1}})` retorna entries para "a" e "a.b"

### Verificação Manual
- [ ] O `variable-picker` mostra categorias com cores correctas
- [ ] A pesquisa filtra variáveis em tempo real
- [ ] Selecionar variável chama `onSelect` com dados correctos
- [ ] As pills são visualmente distintas por categoria (cores diferentes)

---

## 📝 Notas para o Claude Code

1. **Criar ficheiros na ordem listada** — tipos primeiro, depois engine, depois componentes
2. **Os tipos devem ser exportados com `export`**, não `export default`
3. **Os mapas de cores (nodeAccentMap, etc.) devem cobrir TODOS os tipos** do union — TypeScript dará erro se faltar algum
4. **O template engine usa `{{}}` internamente** mas a UI nunca mostra esta sintaxe ao utilizador
5. **O variable-picker precisa de uma API route** para carregar variáveis do `tpl_variables` — criar `GET /api/automacao/variaveis`
6. **Testar o template engine com edge cases:** variáveis inexistentes, valores null, templates vazios, variáveis aninhadas
