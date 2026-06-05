import type { SupabaseClient } from "@supabase/supabase-js"
import type { AutomationNode, SetVariableNodeData } from "@/lib/types/automation-flow"
import type { NodeProcessResult, ExecutionContext } from "./index"
import { resolveVariablesInString } from "./index"

export const processSetVariable: (
  supabase: SupabaseClient,
  node: AutomationNode,
  context: ExecutionContext,
  flowMeta: { flowId: string; runId: string }
) => Promise<NodeProcessResult> = async (_supabase, node, context) => {
  const start = Date.now()
  const data = node.data as SetVariableNodeData
  const updates: Record<string, string> = {}

  for (const assignment of data.assignments || []) {
    updates[assignment.key] = resolveVariablesInString(assignment.value, context.variables)
  }

  return {
    output: { assigned: Object.keys(updates) },
    contextUpdates: updates,
    durationMs: Date.now() - start,
  }
}
