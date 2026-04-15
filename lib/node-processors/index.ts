// ============================================================
// Node Processors — Registry + Interface comum
// Fase 6 do Sistema de Automações
// ============================================================

import type { SupabaseClient } from "@supabase/supabase-js"
import type { AutomationNode } from "@/lib/types/automation-flow"

// ── Interface de resultado comum ──

export interface NodeProcessResult {
  output?: Record<string, unknown>
  contextUpdates?: Record<string, string>
  nextHandle?: string // "true"/"false" para condition, "found"/"created"/"error" para task_lookup
  scheduledFor?: string // ISO timestamp para delay nodes
  durationMs?: number
  deliveries?: DeliveryEntry[]
}

export interface DeliveryEntry {
  channel: "whatsapp" | "email" | "notification"
  recipientAddress: string
  messageType?: string
  finalContent?: string
  mediaUrl?: string
  status: "sent" | "failed"
  externalMessageId?: string
  errorMessage?: string
}

// ── Contexto de execução ──

export interface ExecutionContext {
  variables: Record<string, string>
  webhook_payload?: Record<string, unknown>
  [key: string]: unknown
}

// ── Interface do processador ──

export type NodeProcessor = (
  supabase: SupabaseClient,
  node: AutomationNode,
  context: ExecutionContext,
  flowMeta: {
    flowId: string
    runId: string
    stepRunId?: string
    wppInstanceId?: string | null
  }
) => Promise<NodeProcessResult>

// ── Registry ──

import { processCondition } from "./condition"
import { processSetVariable } from "./set-variable"
import { processDelay } from "./delay"
import { processSupabaseQuery } from "./supabase-query"
import { processTaskLookup } from "./task-lookup"
import { processWhatsApp } from "./whatsapp"
import { processEmail } from "./email"
import { processHttpRequest } from "./http-request"
import { processWebhookResponse } from "./webhook-response"
import { processNotification } from "./notification"

const processors: Record<string, NodeProcessor> = {
  condition: processCondition,
  set_variable: processSetVariable,
  delay: processDelay,
  supabase_query: processSupabaseQuery,
  task_lookup: processTaskLookup,
  whatsapp: processWhatsApp,
  email: processEmail,
  http_request: processHttpRequest,
  webhook_response: processWebhookResponse,
  notification: processNotification,
}

export function getNodeProcessor(nodeType: string): NodeProcessor | null {
  return processors[nodeType] || null
}

// ── Utilidades ──

export function resolveVariablesInString(
  template: string,
  variables: Record<string, string>
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_match, key: string) => variables[key] ?? "")
}

export function calculateRetryDelay(retryCount: number): Date {
  // Exponential backoff: 30s, 2min, 8min, 32min
  const delayMs = Math.min(30_000 * Math.pow(4, retryCount), 30 * 60_000)
  return new Date(Date.now() + delayMs)
}
