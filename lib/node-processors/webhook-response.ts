import type { SupabaseClient } from "@supabase/supabase-js"
import type { AutomationNode, WebhookResponseNodeData } from "@/lib/types/automation-flow"
import type { NodeProcessResult, ExecutionContext } from "./index"
import { resolveVariablesInString } from "./index"

export const processWebhookResponse: (
  supabase: SupabaseClient,
  node: AutomationNode,
  context: ExecutionContext,
  flowMeta: { flowId: string; runId: string }
) => Promise<NodeProcessResult> = async (_supabase, node, context) => {
  const start = Date.now()
  const d = node.data as WebhookResponseNodeData
  const vars = context.variables

  let body: unknown
  const rawBody = resolveVariablesInString(d.responseBody || "{}", vars)
  try {
    body = JSON.parse(rawBody)
  } catch {
    body = rawBody
  }

  return {
    output: {
      statusCode: d.statusCode || 200,
      body,
      continueAfterResponse: d.continueAfterResponse,
    },
    durationMs: Date.now() - start,
  }
}
