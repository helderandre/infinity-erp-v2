// ============================================================
// SyncFlowExecutor — Execução síncrona de fluxos
// Fase 6 do Sistema de Automações
//
// Percorre o grafo inline (sem fila) ate encontrar um
// Webhook Response node ou um node assincrono (WhatsApp, Email, Delay).
// Usado quando um webhook precisa de resposta imediata.
// ============================================================

import type { SupabaseClient } from "@supabase/supabase-js"
import type {
  FlowDefinition,
  AutomationNode,
  WebhookResponseNodeData,
} from "@/lib/types/automation-flow"
import {
  getNodeProcessor,
  type ExecutionContext,
  type NodeProcessResult,
} from "@/lib/node-processors"

// Nodes que devem ser executados de forma assincrona (quando não em modo executeAll)
const ASYNC_NODE_TYPES = new Set(["whatsapp", "email", "delay"])

export interface SyncExecutorOptions {
  /** Quando true, executa TODOS os nodes inline (incluindo WhatsApp, Email, Delay).
   *  Usado no modo de teste para obter resultado imediato. */
  executeAll?: boolean
}

export interface SyncExecutionResult {
  response: { statusCode: number; body: unknown }
  context: ExecutionContext
  asyncNodes: Array<{
    id: string
    type: string
    label: string
    scheduledFor?: string
  }>
  stepsExecuted: Array<{
    nodeId: string
    nodeType: string
    status: "completed" | "failed"
    output?: Record<string, unknown>
    durationMs?: number
    errorMessage?: string
  }>
}

const TIMEOUT_MS = 25_000

export class SyncFlowExecutor {
  private supabase: SupabaseClient
  private flowDef: FlowDefinition
  private context: ExecutionContext
  private flowId: string
  private runId: string
  private wppInstanceId?: string | null
  private executeAll: boolean

  constructor(
    supabase: SupabaseClient,
    flowDef: FlowDefinition,
    context: ExecutionContext,
    meta: { flowId: string; runId: string; wppInstanceId?: string | null },
    options?: SyncExecutorOptions
  ) {
    this.supabase = supabase
    this.flowDef = flowDef
    this.context = { ...context, variables: { ...context.variables } }
    this.flowId = meta.flowId
    this.runId = meta.runId
    this.wppInstanceId = meta.wppInstanceId
    this.executeAll = options?.executeAll ?? false
  }

  async run(): Promise<SyncExecutionResult> {
    const startTime = Date.now()
    const result: SyncExecutionResult = {
      response: { statusCode: 200, body: { ok: true } },
      context: this.context,
      asyncNodes: [],
      stepsExecuted: [],
    }

    // Find trigger node
    const triggerNode = this.flowDef.nodes.find(n =>
      (n.data as { type: string }).type?.startsWith("trigger_")
    )
    if (!triggerNode) {
      result.response = { statusCode: 422, body: { error: "Fluxo sem trigger" } }
      return result
    }

    // Walk the graph from trigger
    let currentNodeId = this.getNextNodeId(triggerNode.id)
    const visited = new Set<string>()

    while (currentNodeId) {
      // Timeout check
      if (Date.now() - startTime > TIMEOUT_MS) {
        result.response = { statusCode: 504, body: { error: "Timeout de execução" } }
        break
      }

      // Cycle detection
      if (visited.has(currentNodeId)) break
      visited.add(currentNodeId)

      const node = this.flowDef.nodes.find(n => n.id === currentNodeId)
      if (!node) break

      const nodeType = (node.data as { type: string }).type

      // If async node type and not in executeAll mode, collect for later processing
      if (ASYNC_NODE_TYPES.has(nodeType) && !this.executeAll) {
        this.collectAsyncNodes(currentNodeId, result.asyncNodes)
        break
      }

      // If it's a webhook response, execute and stop
      if (nodeType === "webhook_response") {
        const processor = getNodeProcessor(nodeType)
        if (processor) {
          const pResult = await processor(
            this.supabase, node, this.context,
            { flowId: this.flowId, runId: this.runId, wppInstanceId: this.wppInstanceId }
          )
          const output = pResult.output as {
            statusCode?: number
            body?: unknown
            continueAfterResponse?: boolean
          }
          result.response = {
            statusCode: output?.statusCode || 200,
            body: output?.body || { ok: true },
          }
          result.stepsExecuted.push({
            nodeId: currentNodeId,
            nodeType,
            status: "completed",
            output: pResult.output,
            durationMs: pResult.durationMs,
          })

          // Collect remaining async nodes if continueAfterResponse
          if (output?.continueAfterResponse) {
            const nextId = this.getNextNodeId(currentNodeId)
            if (nextId) this.collectAsyncNodes(nextId, result.asyncNodes)
          }
        }
        break
      }

      // Execute synchronous node
      const processor = getNodeProcessor(nodeType)
      if (!processor) {
        result.stepsExecuted.push({
          nodeId: currentNodeId,
          nodeType,
          status: "failed",
          errorMessage: `Processador nao encontrado: ${nodeType}`,
        })
        break
      }

      try {
        const pResult = await processor(
          this.supabase, node, this.context,
          { flowId: this.flowId, runId: this.runId, wppInstanceId: this.wppInstanceId }
        )

        // Apply context updates
        if (pResult.contextUpdates) {
          Object.assign(this.context.variables, pResult.contextUpdates)
        }

        result.stepsExecuted.push({
          nodeId: currentNodeId,
          nodeType,
          status: "completed",
          output: pResult.output,
          durationMs: pResult.durationMs,
        })

        // Determine next node
        currentNodeId = this.getNextNodeId(currentNodeId, pResult.nextHandle) || ""
      } catch (err) {
        result.stepsExecuted.push({
          nodeId: currentNodeId,
          nodeType,
          status: "failed",
          errorMessage: err instanceof Error ? err.message : "Erro desconhecido",
        })
        break
      }
    }

    result.context = this.context
    return result
  }

  private getNextNodeId(fromNodeId: string, handle?: string): string | null {
    const edges = this.flowDef.edges.filter(e => {
      if (e.source !== fromNodeId) return false
      if (handle && e.sourceHandle) return e.sourceHandle === handle
      if (handle && !e.sourceHandle) return false
      return true
    })
    return edges[0]?.target || null
  }

  private collectAsyncNodes(
    startNodeId: string,
    asyncNodes: SyncExecutionResult["asyncNodes"]
  ) {
    const visited = new Set<string>()
    const queue = [startNodeId]

    while (queue.length > 0) {
      const nodeId = queue.shift()!
      if (visited.has(nodeId)) continue
      visited.add(nodeId)

      const node = this.flowDef.nodes.find(n => n.id === nodeId)
      if (!node) continue

      const data = node.data as { type: string; label?: string }
      asyncNodes.push({
        id: node.id,
        type: data.type,
        label: data.label || data.type,
      })

      // Add all downstream nodes
      const nextEdges = this.flowDef.edges.filter(e => e.source === nodeId)
      for (const edge of nextEdges) {
        queue.push(edge.target)
      }
    }
  }
}
