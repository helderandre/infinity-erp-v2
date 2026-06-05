import type { SupabaseClient } from "@supabase/supabase-js"
import type { AutomationNode, ConditionNodeData } from "@/lib/types/automation-flow"
import type { NodeProcessResult, ExecutionContext } from "./index"
import { evaluateCondition } from "@/lib/condition-evaluator"

export const processCondition: (
  supabase: SupabaseClient,
  node: AutomationNode,
  context: ExecutionContext,
  flowMeta: { flowId: string; runId: string }
) => Promise<NodeProcessResult> = async (_supabase, node, context) => {
  const start = Date.now()
  const data = node.data as ConditionNodeData
  const result = evaluateCondition(data.rules || [], data.logic || "and", context.variables)

  return {
    output: { result, evaluatedRules: data.rules?.length ?? 0 },
    nextHandle: result ? "true" : "false",
    durationMs: Date.now() - start,
  }
}
