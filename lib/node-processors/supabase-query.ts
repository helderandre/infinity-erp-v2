import type { SupabaseClient } from "@supabase/supabase-js"
import type { AutomationNode, SupabaseQueryNodeData } from "@/lib/types/automation-flow"
import type { NodeProcessResult, ExecutionContext } from "./index"
import { resolveVariablesInString } from "./index"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SA = any

export const processSupabaseQuery: (
  supabase: SupabaseClient,
  node: AutomationNode,
  context: ExecutionContext,
  flowMeta: { flowId: string; runId: string }
) => Promise<NodeProcessResult> = async (supabase, node, context) => {
  const start = Date.now()
  const d = node.data as SupabaseQueryNodeData
  const vars = context.variables

  const resolve = (v: string) => resolveVariablesInString(v, vars)

  let result: SA = null

  switch (d.operation) {
    case "select": {
      let q = (supabase as SA).from(d.table).select(d.columns || "*")
      q = applyFilters(q, d.filters, vars)
      if (d.limit) q = q.limit(d.limit)
      if (d.single) q = q.single()
      const { data, error } = await q
      if (error) throw new Error(`Supabase select error: ${error.message}`)
      result = data
      break
    }
    case "insert": {
      const row: Record<string, string> = {}
      for (const item of d.data || []) row[item.column] = resolve(item.value)
      const { data, error } = await (supabase as SA).from(d.table).insert(row).select()
      if (error) throw new Error(`Supabase insert error: ${error.message}`)
      result = data
      break
    }
    case "update": {
      const updates: Record<string, string> = {}
      for (const item of d.data || []) updates[item.column] = resolve(item.value)
      let q = (supabase as SA).from(d.table).update(updates)
      q = applyFilters(q, d.filters, vars)
      const { data, error } = await q.select()
      if (error) throw new Error(`Supabase update error: ${error.message}`)
      result = data
      break
    }
    case "upsert": {
      const row: Record<string, string> = {}
      for (const item of d.data || []) row[item.column] = resolve(item.value)
      const opts: SA = {}
      if (d.upsertConflict) opts.onConflict = d.upsertConflict
      const { data, error } = await (supabase as SA).from(d.table).upsert(row, opts).select()
      if (!error) {
        result = data
        break
      }
      // Fallback for partial unique indexes: SELECT + INSERT/UPDATE
      const isConstraintError = error.message.includes("ON CONFLICT") ||
        error.message.includes("unique") ||
        error.message.includes("constraint") ||
        error.code === "42P10"
      if (!isConstraintError) throw new Error(`Supabase upsert error: ${error.message}`)

      const conflictCol = (d.upsertConflict || "").split(",")[0].trim()
      const conflictVal = row[conflictCol]
      if (!conflictCol || !conflictVal) {
        throw new Error(`Upsert fallback: conflict column "${conflictCol}" has no value`)
      }
      const { data: existing } = await (supabase as SA)
        .from(d.table).select("id").eq(conflictCol, conflictVal).maybeSingle()
      if (existing) {
        const { data: updated, error: updErr } = await (supabase as SA)
          .from(d.table).update(row).eq(conflictCol, conflictVal).select()
        if (updErr) throw new Error(`Supabase upsert-update fallback error: ${updErr.message}`)
        result = updated
      } else {
        const { data: inserted, error: insErr } = await (supabase as SA)
          .from(d.table).insert(row).select()
        if (insErr) throw new Error(`Supabase upsert-insert fallback error: ${insErr.message}`)
        result = inserted
      }
      break
    }
    case "delete": {
      let q = (supabase as SA).from(d.table).delete()
      q = applyFilters(q, d.filters, vars)
      const { error } = await q
      if (error) throw new Error(`Supabase delete error: ${error.message}`)
      result = { deleted: true }
      break
    }
    case "rpc": {
      const params: Record<string, SA> = {}
      for (const p of d.rpcParams || []) {
        let val: SA = resolve(p.value)
        if (p.type === "int") val = parseInt(val, 10)
        else if (p.type === "boolean") val = val === "true"
        else if (p.type === "jsonb") val = JSON.parse(val)
        params[p.name] = val
      }
      const { data, error } = await supabase.rpc(d.rpcFunction!, params)
      if (error) throw new Error(`Supabase rpc error: ${error.message}`)
      result = data
      break
    }
  }

  const contextUpdates: Record<string, string> = {}
  if (d.outputVariable && result !== null) {
    contextUpdates[d.outputVariable] = typeof result === "string" ? result : JSON.stringify(result)
  }

  return {
    output: { operation: d.operation, table: d.table, result },
    contextUpdates,
    durationMs: Date.now() - start,
  }
}

function applyFilters(
  query: SA,
  filters: SupabaseQueryNodeData["filters"],
  vars: Record<string, string>
): SA {
  let q = query
  for (const f of filters || []) {
    const val = resolveVariablesInString(f.value, vars)
    switch (f.operator) {
      case "eq": q = q.eq(f.column, val); break
      case "neq": q = q.neq(f.column, val); break
      case "gt": q = q.gt(f.column, val); break
      case "lt": q = q.lt(f.column, val); break
      case "gte": q = q.gte(f.column, val); break
      case "lte": q = q.lte(f.column, val); break
      case "in": q = q.in(f.column, val.split(",")); break
      case "like": q = q.like(f.column, val); break
      case "is": q = q.is(f.column, val === "null" ? null : val); break
      case "not_is": q = q.not(f.column, "is", val === "null" ? null : val); break
    }
  }
  return q
}
