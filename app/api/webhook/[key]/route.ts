// ============================================================
// Webhook Receiver — Recebe webhooks externos e dispara fluxos
// Fase 6 do Sistema de Automacoes
//
// Suporta 3 modos:
// 1. Teste (trigger inactivo) — captura payload para inspecao
// 2. Sincrono — quando fluxo tem Webhook Response node
// 3. Assincrono (padrao) — enfileira para o worker processar
//
// Proteccoes:
// - Deduplicacao de webhooks (10s)
// - Logging estruturado [WEBHOOK]
// ============================================================

import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import type { FlowDefinition } from "@/lib/types/automation-flow"
import { resolveWebhookMapping } from "@/lib/webhook-mapping"
import { SyncFlowExecutor } from "@/lib/sync-flow-executor"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SA = any

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  try {
    const supabase = createAdminClient() as SA
    const { key } = await params

    // Parse payload
    let payload: Record<string, unknown>
    const contentType = request.headers.get("content-type") || ""
    if (contentType.includes("application/json")) {
      payload = await request.json()
    } else if (contentType.includes("application/x-www-form-urlencoded")) {
      const formData = await request.formData()
      payload = Object.fromEntries(formData.entries()) as Record<string, unknown>
    } else {
      payload = { raw: await request.text() }
    }

    console.log(`[WEBHOOK] POST /api/webhook/${key} payload_size=${JSON.stringify(payload).length}`)

    // 1. Find associated trigger (active, from active flow with published_definition)
    const { data: trigger } = await supabase
      .from("auto_triggers")
      .select("*, auto_flows!inner(id, name, published_definition, wpp_instance_id, is_active)")
      .eq("trigger_source", key)
      .eq("source_type", "webhook")
      .eq("active", true)
      .single()

    console.log(`[WEBHOOK] Trigger found: ${trigger?.id || "NONE"} flow_active=${trigger?.auto_flows?.is_active}`)

    // 2. Always capture payload for inspection
    await supabase.from("auto_webhook_captures").upsert({
      source_id: key,
      flow_name: trigger?.auto_flows?.name || "Desconhecido",
      payload,
      received_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })

    // 3. If no active trigger found -> 410 Gone
    if (!trigger) {
      console.log(`[WEBHOOK] No active trigger for key=${key}. Returning 410.`)
      return NextResponse.json({
        error: "Webhook nao encontrado ou desactivado",
        hint: "Este webhook pode ter sido desactivado ou o fluxo nao esta publicado.",
      }, { status: 410 })
    }

    // 4. If flow not active -> capture but don't execute
    if (!trigger.auto_flows.is_active) {
      console.log(`[WEBHOOK] Flow inactive for key=${key}. Payload captured.`)
      return NextResponse.json({
        ok: true,
        mode: "inactive",
        message: "Fluxo nao esta activo. Payload capturado mas nao executado.",
      })
    }

    // 5. If no published_definition -> capture but don't execute
    if (!trigger.auto_flows.published_definition) {
      console.log(`[WEBHOOK] Flow unpublished for key=${key}. Payload captured.`)
      return NextResponse.json({
        ok: true,
        mode: "unpublished",
        message: "Fluxo nao publicado. Payload capturado mas nao executado.",
      })
    }

    // Proteccao: Deduplicacao de webhooks (10s)
    // Verifica se ja existe run recente para este fluxo via webhook
    const { data: recentRun } = await supabase
      .from("auto_runs")
      .select("id")
      .eq("flow_id", trigger.flow_id)
      .eq("triggered_by", "webhook")
      .gte("created_at", new Date(Date.now() - 10000).toISOString())
      .limit(1)

    if (recentRun && recentRun.length > 0) {
      console.log(`[WEBHOOK] Deduplicated: run ${recentRun[0].id} exists within 10s for flow ${trigger.flow_id}`)
      return NextResponse.json({
        ok: true,
        mode: "deduplicated",
        message: "Webhook recebido mas execucao recente ja existe. Payload capturado.",
        existing_run_id: recentRun[0].id,
      })
    }

    // 6. Resolve webhook mappings
    const mappings = trigger.payload_mapping || []
    const mappedVariables = resolveWebhookMapping(payload, mappings)

    // 7. Use published_definition (NOT draft)
    const flowDef = trigger.auto_flows.published_definition as FlowDefinition
    const hasWebhookResponse = flowDef.nodes.some(
      (n: SA) => (n.data as SA).type === "webhook_response"
    )

    const runId = crypto.randomUUID()

    if (hasWebhookResponse) {
      // -- SYNC MODE --
      console.log(`[WEBHOOK] Sync mode: run ${runId} for flow ${trigger.flow_id}`)
      await supabase.from("auto_runs").insert({
        id: runId,
        flow_id: trigger.flow_id,
        trigger_id: trigger.id,
        triggered_by: "webhook",
        status: "running",
        context: { webhook_payload: payload, variables: mappedVariables },
        started_at: new Date().toISOString(),
      })

      const executor = new SyncFlowExecutor(
        supabase,
        flowDef,
        { webhook_payload: payload, variables: mappedVariables },
        { flowId: trigger.flow_id, runId, wppInstanceId: trigger.auto_flows.wpp_instance_id }
      )
      const result = await executor.run()

      // Record executed steps
      for (const step of result.stepsExecuted) {
        await supabase.from("auto_step_runs").insert({
          run_id: runId,
          flow_id: trigger.flow_id,
          node_id: step.nodeId,
          node_type: step.nodeType,
          status: step.status,
          output_data: step.output || {},
          duration_ms: step.durationMs || 0,
          error_message: step.errorMessage || null,
          started_at: new Date().toISOString(),
          completed_at: new Date().toISOString(),
        })
      }

      // Enqueue remaining async nodes
      if (result.asyncNodes.length > 0) {
        for (const node of result.asyncNodes) {
          await supabase.from("auto_step_runs").insert({
            run_id: runId,
            flow_id: trigger.flow_id,
            node_id: node.id,
            node_type: node.type,
            node_label: node.label,
            status: "pending",
            scheduled_for: node.scheduledFor || new Date().toISOString(),
            input_data: result.context,
          })
        }
      }

      await supabase.rpc("auto_update_run_counts", { p_run_id: runId })
      console.log(`[WEBHOOK] Sync run ${runId} completed: ${result.stepsExecuted.length} steps, status=${result.response.statusCode}`)
      return NextResponse.json(result.response.body, { status: result.response.statusCode })
    }

    // -- ASYNC MODE (default) --
    const triggerNode = flowDef.nodes.find((n: SA) =>
      (n.data as SA).type?.startsWith("trigger_")
    )
    const firstEdge = flowDef.edges.find((e: SA) => e.source === triggerNode?.id)
    if (!firstEdge) {
      console.error(`[WEBHOOK] Flow ${trigger.flow_id} has no edges after trigger`)
      return NextResponse.json({ error: "Fluxo sem nodes apos trigger" }, { status: 422 })
    }

    await supabase.from("auto_runs").insert({
      id: runId,
      flow_id: trigger.flow_id,
      trigger_id: trigger.id,
      triggered_by: "webhook",
      status: "running",
      context: { webhook_payload: payload, variables: mappedVariables },
      started_at: new Date().toISOString(),
    })

    const firstNode = flowDef.nodes.find((n: SA) => n.id === firstEdge.target)
    const firstNodeData = firstNode?.data as SA
    await supabase.from("auto_step_runs").insert({
      run_id: runId,
      flow_id: trigger.flow_id,
      node_id: firstEdge.target,
      node_type: firstNodeData?.type || firstNode?.type || "unknown",
      node_label: firstNodeData?.label || "",
      status: "pending",
      scheduled_for: new Date().toISOString(),
      priority: 5,
      input_data: { webhook_payload: payload, variables: mappedVariables },
    })

    await supabase.rpc("auto_update_run_counts", { p_run_id: runId })
    console.log(`[WEBHOOK] Async run created: ${runId} mode=async`)
    return NextResponse.json({ ok: true, run_id: runId })
  } catch (error) {
    console.error("[WEBHOOK] POST error:", error)
    return NextResponse.json(
      { ok: false, error: "Erro ao processar webhook" },
      { status: 500 }
    )
  }
}

export async function GET() {
  return NextResponse.json({ ok: true, message: "Webhook endpoint activo" })
}
