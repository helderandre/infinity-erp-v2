import type { SupabaseClient } from "@supabase/supabase-js"
import type { AutomationNode, HttpRequestNodeData } from "@/lib/types/automation-flow"
import type { NodeProcessResult, ExecutionContext } from "./index"
import { resolveVariablesInString } from "./index"

export const processHttpRequest: (
  supabase: SupabaseClient,
  node: AutomationNode,
  context: ExecutionContext,
  flowMeta: { flowId: string; runId: string }
) => Promise<NodeProcessResult> = async (_supabase, node, context) => {
  const start = Date.now()
  const d = node.data as HttpRequestNodeData
  const vars = context.variables

  const url = resolveVariablesInString(d.url || "", vars)
  if (!url) throw new Error("URL não configurado no HTTP Request")

  const headers: Record<string, string> = { "Content-Type": "application/json" }
  if (d.headers) {
    try {
      const parsed = JSON.parse(resolveVariablesInString(d.headers, vars))
      Object.assign(headers, parsed)
    } catch {
      // Headers as key:value lines
      for (const line of d.headers.split("\n")) {
        const [key, ...rest] = line.split(":")
        if (key && rest.length) headers[key.trim()] = resolveVariablesInString(rest.join(":").trim(), vars)
      }
    }
  }

  const fetchOpts: RequestInit = { method: d.method || "GET", headers }
  if (d.body && d.method !== "GET") {
    fetchOpts.body = resolveVariablesInString(d.body, vars)
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 25_000)
  fetchOpts.signal = controller.signal

  let responseData: unknown
  let statusCode: number

  try {
    const response = await fetch(url, fetchOpts)
    statusCode = response.status
    const contentType = response.headers.get("content-type") || ""
    responseData = contentType.includes("application/json")
      ? await response.json()
      : await response.text()
  } finally {
    clearTimeout(timeout)
  }

  const contextUpdates: Record<string, string> = {}
  if (d.outputVariable) {
    contextUpdates[d.outputVariable] = typeof responseData === "string"
      ? responseData
      : JSON.stringify(responseData)
  }

  return {
    output: { statusCode, response: responseData, url },
    contextUpdates,
    durationMs: Date.now() - start,
  }
}
