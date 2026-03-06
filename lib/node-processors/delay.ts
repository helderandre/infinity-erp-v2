import type { SupabaseClient } from "@supabase/supabase-js"
import type { AutomationNode, DelayNodeData } from "@/lib/types/automation-flow"
import type { NodeProcessResult, ExecutionContext } from "./index"

const UNIT_TO_MS: Record<string, number> = {
  minutes: 60_000,
  hours: 3_600_000,
  days: 86_400_000,
}

export const processDelay: (
  supabase: SupabaseClient,
  node: AutomationNode,
  context: ExecutionContext,
  flowMeta: { flowId: string; runId: string }
) => Promise<NodeProcessResult> = async (_supabase, node) => {
  const start = Date.now()
  const data = node.data as DelayNodeData
  const ms = (data.value || 1) * (UNIT_TO_MS[data.unit] || UNIT_TO_MS.minutes)
  const scheduledFor = new Date(Date.now() + ms).toISOString()

  return {
    output: { delayMs: ms, scheduledFor },
    scheduledFor,
    durationMs: Date.now() - start,
  }
}
