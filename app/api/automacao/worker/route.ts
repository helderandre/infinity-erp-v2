// ============================================================
// Worker API Route — Processa steps pendentes da fila
// Fase 6 do Sistema de Automacoes
//
// Invocado por cron (Vercel Cron ou pg_cron via pg_net) a cada minuto.
// Reclama batch de steps pendentes e processa-os sequencialmente.
// ============================================================

import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import type { FlowDefinition, AutomationNode } from "@/lib/types/automation-flow"
import { getNodeProcessor, calculateRetryDelay } from "@/lib/node-processors"
import type { ExecutionContext } from "@/lib/node-processors"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SA = any

// Secret to protect the worker endpoint
const WORKER_SECRET = process.env.CRON_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY

export async function POST(request: Request) {
  // Verify authorization
  const authHeader = request.headers.get("authorization")
  if (WORKER_SECRET && authHeader !== `Bearer ${WORKER_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const supabase = createAdminClient()
  let processed = 0

  try {
    // 1. Claim batch of pending steps
    const { data: steps, error: claimError } = await (supabase as SA).rpc("auto_claim_steps", {
      batch_size: 5,
    })

    if (claimError || !steps || steps.length === 0) {
      return NextResponse.json({ processed: 0, message: claimError?.message || "Sem steps pendentes" })
    }

    for (const step of steps) {
      try {
        // 2. Fetch flow definition
        const { data: flow } = await (supabase as SA)
          .from("auto_flows")
          .select("published_definition, wpp_instance_id")
          .eq("id", step.flow_id)
          .single()

        if (!flow) {
          await markStepFailed(supabase, step.id, step.run_id, "Fluxo nao encontrado")
          continue
        }

        // 3. Fetch run context
        const { data: run } = await (supabase as SA)
          .from("auto_runs")
          .select("context")
          .eq("id", step.run_id)
          .single()

        const flowDef = flow.published_definition as FlowDefinition
        if (!flowDef) {
          await markStepFailed(supabase, step.id, step.run_id, "Fluxo nao publicado")
          continue
        }
        const node = flowDef.nodes.find((n: AutomationNode) => n.id === step.node_id)
        if (!node) {
          await markStepFailed(supabase, step.id, step.run_id, `Node ${step.node_id} nao encontrado`)
          continue
        }

        const nodeType = (node.data as { type: string }).type
        const processor = getNodeProcessor(nodeType)
        if (!processor) {
          await markStepFailed(supabase, step.id, step.run_id, `Processador nao encontrado: ${nodeType}`)
          continue
        }

        // 4. Build execution context
        const context: ExecutionContext = {
          variables: {},
          ...(run?.context || {}),
          ...(step.input_data || {}),
        }
        if (!context.variables) context.variables = {}

        // 5. Process node
        const result = await processor(supabase, node, context, {
          flowId: step.flow_id,
          runId: step.run_id,
          wppInstanceId: flow.wpp_instance_id,
        })

        // 6. Mark step as completed
        await (supabase as SA).from("auto_step_runs").update({
          status: "completed",
          output_data: result.output || {},
          completed_at: new Date().toISOString(),
          duration_ms: result.durationMs || 0,
        }).eq("id", step.id)

        // 7. Apply context updates to run
        if (result.contextUpdates && Object.keys(result.contextUpdates).length > 0) {
          const updatedContext = { ...context, variables: { ...context.variables, ...result.contextUpdates } }
          await (supabase as SA).from("auto_runs").update({
            context: updatedContext,
            updated_at: new Date().toISOString(),
          }).eq("id", step.run_id)
        }

        // 8. Find and enqueue next node(s)
        const nextEdges = flowDef.edges.filter(e => {
          if (e.source !== step.node_id) return false
          if (result.nextHandle && e.sourceHandle) return e.sourceHandle === result.nextHandle
          if (result.nextHandle && !e.sourceHandle) return false
          return true
        })

        for (const edge of nextEdges) {
          const nextNode = flowDef.nodes.find(n => n.id === edge.target)
          const nextData = nextNode?.data as { type?: string; label?: string } | undefined
          await (supabase as SA).from("auto_step_runs").insert({
            run_id: step.run_id,
            flow_id: step.flow_id,
            node_id: edge.target,
            node_type: nextData?.type || nextNode?.type || "unknown",
            node_label: nextData?.label || "",
            status: "pending",
            scheduled_for: result.scheduledFor || new Date().toISOString(),
            priority: step.priority || 3,
            input_data: {
              ...context,
              variables: { ...context.variables, ...(result.contextUpdates || {}) },
            },
          })
        }

        // 9. Update run counts
        await (supabase as SA).rpc("auto_update_run_counts", { p_run_id: step.run_id })

        processed++
      } catch (error) {
        // Retry logic
        const retryCount = (step.retry_count || 0) + 1
        const maxRetries = step.max_retries || 3
        const errMsg = error instanceof Error ? error.message : "Erro desconhecido"

        if (retryCount < maxRetries) {
          const nextRetryAt = calculateRetryDelay(retryCount)
          await (supabase as SA).from("auto_step_runs").update({
            status: "pending",
            retry_count: retryCount,
            scheduled_for: nextRetryAt.toISOString(),
            error_message: errMsg,
          }).eq("id", step.id)
        } else {
          await markStepFailed(
            supabase, step.id, step.run_id,
            `Falhou apos ${maxRetries} tentativas: ${errMsg}`
          )
        }
      }
    }
  } catch (error) {
    console.error("[worker] Fatal error:", error)
    return NextResponse.json(
      { error: "Erro fatal no worker", processed },
      { status: 500 }
    )
  }

  return NextResponse.json({ processed })
}

// GET for health check
export async function GET() {
  return NextResponse.json({ ok: true, message: "Worker endpoint activo" })
}

async function markStepFailed(supabase: SA, stepId: string, runId: string, errorMessage: string) {
  await supabase.from("auto_step_runs").update({
    status: "failed",
    completed_at: new Date().toISOString(),
    error_message: errorMessage,
  }).eq("id", stepId)
  await supabase.rpc("auto_update_run_counts", { p_run_id: runId })
}
