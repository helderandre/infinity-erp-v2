import type { SupabaseClient } from "@supabase/supabase-js"
import type { AutomationNode, NotificationNodeData } from "@/lib/types/automation-flow"
import type { NodeProcessResult, ExecutionContext, DeliveryEntry } from "./index"
import { resolveVariablesInString } from "./index"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SA = any

export const processNotification: (
  supabase: SupabaseClient,
  node: AutomationNode,
  context: ExecutionContext,
  flowMeta: { flowId: string; runId: string }
) => Promise<NodeProcessResult> = async (supabase, node, context, flowMeta) => {
  const start = Date.now()
  const d = node.data as NotificationNodeData
  const vars = context.variables

  const title = resolveVariablesInString(d.title || "", vars)
  const body = resolveVariablesInString(d.body || "", vars)

  // Determine recipients
  const recipientIds: string[] = []

  if (d.recipientType === "user" && d.recipientId) {
    recipientIds.push(d.recipientId)
  } else if (d.recipientType === "variable" && d.recipientVariable) {
    const val = resolveVariablesInString(`{{${d.recipientVariable}}}`, vars)
    if (val) recipientIds.push(val)
  } else if (d.recipientType === "role" && d.recipientId) {
    // Find all users with this role
    const { data: users } = await (supabase as SA)
      .from("dev_users")
      .select("id")
      .eq("role_id", d.recipientId)
      .eq("is_active", true)
    if (users) recipientIds.push(...users.map((u: SA) => u.id))
  }

  if (recipientIds.length === 0) throw new Error("Sem destinatários para notificação")

  const entityId = d.entityIdVariable
    ? resolveVariablesInString(`{{${d.entityIdVariable}}}`, vars)
    : null

  const deliveries: DeliveryEntry[] = []

  for (const recipientId of recipientIds) {
    const { error } = await (supabase as SA).from("notifications").insert({
      recipient_id: recipientId,
      title,
      body,
      entity_type: d.entityType || null,
      entity_id: entityId || null,
      source: "automation",
      metadata: { flow_id: flowMeta.flowId, run_id: flowMeta.runId },
    })

    deliveries.push({
      channel: "notification",
      recipientAddress: recipientId,
      finalContent: title,
      status: error ? "failed" : "sent",
      errorMessage: error?.message,
    })
  }

  // Log deliveries
  for (const del of deliveries) {
    await (supabase as SA).from("auto_delivery_log").insert({
      run_id: flowMeta.runId,
      flow_id: flowMeta.flowId,
      channel: "notification",
      recipient_address: del.recipientAddress,
      message_type: "notification",
      final_content: del.finalContent,
      status: del.status === "sent" ? "sent" : "failed",
      error_message: del.errorMessage,
      sent_at: del.status === "sent" ? new Date().toISOString() : null,
    })
  }

  return {
    output: { notified: recipientIds.length, title },
    deliveries,
    durationMs: Date.now() - start,
  }
}
