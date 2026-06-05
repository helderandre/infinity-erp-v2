import type { SupabaseClient } from "@supabase/supabase-js"
import type { AutomationNode, TaskLookupNodeData } from "@/lib/types/automation-flow"
import type { NodeProcessResult, ExecutionContext } from "./index"
import { resolveVariablesInString } from "./index"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SA = any

const ENTITY_TABLE: Record<string, string> = {
  lead: "leads",
  owner: "owners",
  user: "dev_users",
}

export const processTaskLookup: (
  supabase: SupabaseClient,
  node: AutomationNode,
  context: ExecutionContext,
  flowMeta: { flowId: string; runId: string }
) => Promise<NodeProcessResult> = async (supabase, node, context) => {
  const start = Date.now()
  const d = node.data as TaskLookupNodeData
  const vars = context.variables
  const table = ENTITY_TABLE[d.entityType]
  if (!table) throw new Error(`Tipo de entidade desconhecido: ${d.entityType}`)

  const lookupValue = resolveVariablesInString(d.lookupVariable || "", vars)
  if (!lookupValue) throw new Error("Valor de lookup vazio")

  // Search
  const { data: found } = await (supabase as SA)
    .from(table)
    .select("id")
    .eq(d.lookupField, lookupValue)
    .limit(1)
    .maybeSingle()

  const contextUpdates: Record<string, string> = {}

  if (found) {
    if (d.outputVariable) contextUpdates[d.outputVariable] = found.id
    return {
      output: { action: "found", entityId: found.id },
      nextHandle: "found",
      contextUpdates,
      durationMs: Date.now() - start,
    }
  }

  if (d.createIfNotFound) {
    const row: Record<string, string> = {}
    row[d.lookupField] = lookupValue
    for (const f of d.initialFields || []) {
      row[f.column] = resolveVariablesInString(f.valueVariable, vars)
    }
    const { data: created, error } = await (supabase as SA)
      .from(table)
      .insert(row)
      .select("id")
      .single()
    if (error) throw new Error(`Erro ao criar ${d.entityType}: ${error.message}`)
    if (d.outputVariable) contextUpdates[d.outputVariable] = created.id
    return {
      output: { action: "created", entityId: created.id },
      nextHandle: "created",
      contextUpdates,
      durationMs: Date.now() - start,
    }
  }

  return {
    output: { action: "not_found" },
    nextHandle: "error",
    durationMs: Date.now() - start,
  }
}
