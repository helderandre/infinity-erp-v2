// ============================================================
// Worker API Route — Processa steps pendentes da fila
// Fase 6 do Sistema de Automacoes
//
// Invocado por cron (Vercel Cron ou pg_cron via pg_net) a cada minuto.
// Reclama batch de steps pendentes e processa-os sequencialmente.
//
// Proteccoes anti-loop:
// 1. Retry inteligente: 1 retry auto, depois bloqueio manual
// 2. Rate limit: max 20 runs por fluxo em 5 min
// 3. Max 50 steps por run (previne grafos ciclicos)
// 4. Batch unico por invocacao (sem loop interno)
// 5. Logging estruturado [WORKER]
// ============================================================

import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import type { FlowDefinition, AutomationNode } from "@/lib/types/automation-flow"
import { getNodeProcessor } from "@/lib/node-processors"
import type { ExecutionContext } from "@/lib/node-processors"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SA = any

// Secret to protect the worker endpoint
const WORKER_SECRET = process.env.CRON_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY

// Proteccao 2: Limites
const MAX_RUNS_PER_FLOW_5MIN = 20
const MAX_STEPS_PER_RUN = 50

export async function POST(request: Request) {
  const startTime = Date.now()

  // Verify authorization
  const authHeader = request.headers.get("authorization")
  if (WORKER_SECRET && authHeader !== `Bearer ${WORKER_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Parse body for source tracking
  let source = "unknown"
  try {
    const body = await request.json().catch(() => ({}))
    source = (body as SA)?.source || "cron"
  } catch {
    // empty body is fine
  }

  console.log(`[WORKER] Invocado as ${new Date().toISOString()} source=${source}`)

  const supabase = createAdminClient()
  let processed = 0
  const errors: string[] = []

  try {
    // Proteccao 4: Batch unico — claim batch e processar, sem loop
    const { data: steps, error: claimError } = await (supabase as SA).rpc("auto_claim_steps", {
      batch_size: 5,
    })

    if (claimError) {
      console.error(`[WORKER] Erro ao reclamar steps: ${claimError.message}`)
      return NextResponse.json({ processed: 0, error: claimError.message })
    }

    if (!steps || steps.length === 0) {
      console.log(`[WORKER] Sem steps pendentes. Concluido em ${Date.now() - startTime}ms`)
      return NextResponse.json({ processed: 0, message: "Sem steps pendentes" })
    }

    console.log(`[WORKER] Claimed ${steps.length} steps`)

    for (const step of steps) {
      const stepStart = Date.now()
      console.log(`[WORKER] Processing step ${step.id} type=${step.node_type} flow=${step.flow_id} run=${step.run_id}`)

      try {
        // Proteccao 2a: Rate limit por fluxo (max 20 runs em 5 min)
        const { data: recentRuns } = await (supabase as SA)
          .from("auto_runs")
          .select("id")
          .eq("flow_id", step.flow_id)
          .gte("created_at", new Date(Date.now() - 5 * 60 * 1000).toISOString())
          .limit(MAX_RUNS_PER_FLOW_5MIN)

        if (recentRuns && recentRuns.length >= MAX_RUNS_PER_FLOW_5MIN) {
          const msg = `Rate limit: fluxo ${step.flow_id} tem ${recentRuns.length} runs em 5 min`
          console.error(`[WORKER] ${msg}`)
          await (supabase as SA).from("auto_step_runs").update({
            status: "failed",
            error_message: msg,
            output_data: { requires_manual_retry: true, reason: "rate_limit" },
            completed_at: new Date().toISOString(),
          }).eq("id", step.id)
          await (supabase as SA).rpc("auto_update_run_counts", { p_run_id: step.run_id })
          errors.push(`step ${step.id}: rate_limit`)
          continue
        }

        // Fetch flow definition
        const { data: flow } = await (supabase as SA)
          .from("auto_flows")
          .select("published_definition, wpp_instance_id")
          .eq("id", step.flow_id)
          .single()

        if (!flow) {
          await markStepFailed(supabase, step, "Fluxo nao encontrado")
          errors.push(`step ${step.id}: flow_not_found`)
          continue
        }

        // Fetch run context
        const { data: run } = await (supabase as SA)
          .from("auto_runs")
          .select("context")
          .eq("id", step.run_id)
          .single()

        const flowDef = flow.published_definition as FlowDefinition
        if (!flowDef) {
          await markStepFailed(supabase, step, "Fluxo nao publicado")
          errors.push(`step ${step.id}: flow_not_published`)
          continue
        }

        const node = flowDef.nodes.find((n: AutomationNode) => n.id === step.node_id)
        if (!node) {
          await markStepFailed(supabase, step, `Node ${step.node_id} nao encontrado`)
          errors.push(`step ${step.id}: node_not_found`)
          continue
        }

        const nodeType = (node.data as { type: string }).type
        const processor = getNodeProcessor(nodeType)
        if (!processor) {
          await markStepFailed(supabase, step, `Processador nao encontrado: ${nodeType}`)
          errors.push(`step ${step.id}: no_processor`)
          continue
        }

        // Build execution context
        const context: ExecutionContext = {
          variables: {},
          ...(run?.context || {}),
          ...(step.input_data || {}),
        }
        if (!context.variables) context.variables = {}

        // Process node
        const result = await processor(supabase, node, context, {
          flowId: step.flow_id,
          runId: step.run_id,
          wppInstanceId: flow.wpp_instance_id,
        })

        // Mark step as completed
        await (supabase as SA).from("auto_step_runs").update({
          status: "completed",
          output_data: result.output || {},
          completed_at: new Date().toISOString(),
          duration_ms: result.durationMs || 0,
        }).eq("id", step.id)

        console.log(`[WORKER] Step ${step.id} completed (${Date.now() - stepStart}ms)`)

        // Apply context updates to run
        if (result.contextUpdates && Object.keys(result.contextUpdates).length > 0) {
          const updatedContext = { ...context, variables: { ...context.variables, ...result.contextUpdates } }
          await (supabase as SA).from("auto_runs").update({
            context: updatedContext,
            updated_at: new Date().toISOString(),
          }).eq("id", step.run_id)
        }

        // Proteccao 2b: Max steps por run antes de enfileirar proximo
        const { count: stepCount } = await (supabase as SA)
          .from("auto_step_runs")
          .select("id", { count: "exact", head: true })
          .eq("run_id", step.run_id)

        if (stepCount && stepCount >= MAX_STEPS_PER_RUN) {
          const msg = `Run ${step.run_id} atingiu ${MAX_STEPS_PER_RUN} steps. A parar (possivel loop).`
          console.error(`[WORKER] ${msg}`)
          await (supabase as SA).from("auto_runs").update({
            status: "failed",
            error_message: msg,
            completed_at: new Date().toISOString(),
          }).eq("id", step.run_id)
          errors.push(`step ${step.id}: max_steps_reached`)
          // Still count as processed since this step completed
          processed++
          continue
        }

        // Find and enqueue next node(s)
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

        // Update run counts
        await (supabase as SA).rpc("auto_update_run_counts", { p_run_id: step.run_id })

        processed++
      } catch (error) {
        // Proteccao 1: Retry inteligente — 1 retry auto, depois bloqueio manual
        const retryCount = (step.retry_count || 0) + 1
        const errMsg = error instanceof Error ? error.message : "Erro desconhecido"

        if (retryCount <= 1) {
          // 1a falha: retry automatico apos 5 segundos
          console.log(`[WORKER] Step ${step.id} falhou (tentativa ${retryCount}). Retry auto em 5s.`)
          await (supabase as SA).from("auto_step_runs").update({
            status: "pending",
            retry_count: retryCount,
            scheduled_for: new Date(Date.now() + 5000).toISOString(),
            error_message: `Tentativa ${retryCount}: ${errMsg}`,
          }).eq("id", step.id)
        } else {
          // 2a falha: BLOQUEADO — so via dashboard
          console.error(`[WORKER] Step ${step.id} falhou ${retryCount}x. Bloqueado — requer retry manual.`)
          await (supabase as SA).from("auto_step_runs").update({
            status: "failed",
            retry_count: retryCount,
            completed_at: new Date().toISOString(),
            error_message: `Falhou apos ${retryCount} tentativas: ${errMsg}`,
            output_data: { requires_manual_retry: true, last_error: errMsg },
          }).eq("id", step.id)
          await (supabase as SA).rpc("auto_update_run_counts", { p_run_id: step.run_id })
        }

        errors.push(`step ${step.id}: ${errMsg}`)
      }
    }
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : "Erro desconhecido"
    console.error(`[WORKER] Fatal error: ${errMsg}`)
    return NextResponse.json(
      { error: "Erro fatal no worker", processed, errors },
      { status: 500 }
    )
  }

  console.log(`[WORKER] Concluido: ${processed} processados em ${Date.now() - startTime}ms`)
  return NextResponse.json({ processed, errors: errors.length > 0 ? errors : undefined })
}

// GET for health check
export async function GET() {
  return NextResponse.json({ ok: true, message: "Worker endpoint activo" })
}

// Helper: marca step como failed com requires_manual_retry
async function markStepFailed(supabase: SA, step: SA, errorMessage: string) {
  console.error(`[WORKER] Step ${step.id} FAILED: ${errorMessage}`)
  await supabase.from("auto_step_runs").update({
    status: "failed",
    completed_at: new Date().toISOString(),
    error_message: errorMessage,
    output_data: { requires_manual_retry: true, last_error: errorMessage },
  }).eq("id", step.id)
  await supabase.rpc("auto_update_run_counts", { p_run_id: step.run_id })
}
