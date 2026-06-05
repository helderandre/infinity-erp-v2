// ============================================================
// Test Flow — Disparo manual de teste com execucao real
// Fase 6 do Sistema de Automacoes
// ============================================================

import { createAdminClient } from "@/lib/supabase/admin"
import { NextResponse } from "next/server"
import type { FlowDefinition } from "@/lib/types/automation-flow"
import { SyncFlowExecutor } from "@/lib/sync-flow-executor"
import { resolveWebhookMapping } from "@/lib/webhook-mapping"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SA = any

// POST /api/automacao/fluxos/[flowId]/test — Testar fluxo com execucao real
export async function POST(
  request: Request,
  { params }: { params: Promise<{ flowId: string }> }
) {
  try {
    const { flowId } = await params
    const supabase = createAdminClient() as SA
    const body = await request.json()

    const { entity_type, entity_id, test_variables } = body

    console.log(`[TEST] Flow ${flowId} test initiated with ${Object.keys(test_variables || {}).length} variables`)

    // Buscar flow
    const { data: flow, error: flowError } = await supabase
      .from("auto_flows")
      .select("id, draft_definition, wpp_instance_id")
      .eq("id", flowId)
      .single()

    if (flowError || !flow) {
      return NextResponse.json({ error: "Fluxo nao encontrado" }, { status: 404 })
    }

    const definition = flow.draft_definition as FlowDefinition
    if (!definition?.nodes?.length) {
      return NextResponse.json({ error: "Fluxo sem nodes definidos" }, { status: 400 })
    }

    const triggerNode = definition.nodes.find((n: SA) =>
      (n.data as SA).type?.startsWith("trigger_")
    )
    if (!triggerNode) {
      return NextResponse.json({ error: "Fluxo sem trigger definido" }, { status: 400 })
    }

    // Resolve webhook variables from samplePayload + mappings
    let webhookVars: Record<string, string> = {}
    const triggerData = triggerNode.data as SA
    if (triggerData?.type === "trigger_webhook" && triggerData.samplePayload && triggerData.webhookMappings) {
      try {
        webhookVars = resolveWebhookMapping(triggerData.samplePayload, triggerData.webhookMappings)
      } catch {
        // Non-critical — proceed without webhook vars
      }
    }

    // Merge: test_variables from body override webhook vars
    const mergedVariables = {
      ...webhookVars,
      ...(test_variables || {}),
    }

    const runId = crypto.randomUUID()

    // Create test run
    const { error: runError } = await supabase.from("auto_runs").insert({
      id: runId,
      flow_id: flowId,
      status: "running",
      triggered_by: "manual",
      is_test: true,
      entity_type: entity_type || null,
      entity_id: entity_id || null,
      context: { variables: mergedVariables },
      started_at: new Date().toISOString(),
    })

    if (runError) {
      return NextResponse.json({ error: runError.message }, { status: 500 })
    }

    // Mark trigger as completed
    await supabase.from("auto_step_runs").insert({
      run_id: runId,
      flow_id: flowId,
      node_id: triggerNode.id,
      node_type: (triggerNode.data as SA).type || triggerNode.type,
      node_label: (triggerNode.data as SA).label || "Trigger",
      status: "completed",
      started_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
      duration_ms: 0,
    })

    // Execute flow synchronously for test mode — executeAll ensures
    // WhatsApp, Email and Delay nodes run inline instead of being queued
    const executor = new SyncFlowExecutor(
      supabase,
      definition,
      { variables: mergedVariables },
      { flowId, runId, wppInstanceId: flow.wpp_instance_id },
      { executeAll: true }
    )
    const result = await executor.run()

    // Record executed steps (with node_label from definition)
    let hasFailed = false
    for (const step of result.stepsExecuted) {
      const nodeDef = definition.nodes.find((n: SA) => n.id === step.nodeId)
      const nodeLabel = (nodeDef?.data as SA)?.label || step.nodeType

      if (step.status === "failed") hasFailed = true

      await supabase.from("auto_step_runs").insert({
        run_id: runId,
        flow_id: flowId,
        node_id: step.nodeId,
        node_type: step.nodeType,
        node_label: nodeLabel,
        status: step.status,
        output_data: step.output || {},
        duration_ms: step.durationMs || 0,
        error_message: step.errorMessage || null,
        started_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
      })
    }

    // Enqueue remaining async nodes (should be empty in executeAll mode)
    for (const node of result.asyncNodes) {
      await supabase.from("auto_step_runs").insert({
        run_id: runId,
        flow_id: flowId,
        node_id: node.id,
        node_type: node.type,
        node_label: node.label,
        status: "pending",
        scheduled_for: node.scheduledFor || new Date().toISOString(),
        input_data: result.context,
      })
    }

    // Update run status to completed/failed
    const finalStatus = hasFailed ? "failed" : (result.asyncNodes.length > 0 ? "running" : "completed")
    await supabase.from("auto_runs").update({
      status: finalStatus,
      completed_at: finalStatus !== "running" ? new Date().toISOString() : null,
    }).eq("id", runId)

    // Update run counts
    await supabase.rpc("auto_update_run_counts", { p_run_id: runId })

    // Collect error details from failed steps
    const failedSteps = result.stepsExecuted.filter(s => s.status === "failed")
    const errors = failedSteps.map(s => {
      const nodeDef = definition.nodes.find((n: SA) => n.id === s.nodeId)
      return {
        node: (nodeDef?.data as SA)?.label || s.nodeType,
        message: s.errorMessage || "Erro desconhecido",
      }
    })

    // Summary counts
    const whatsappSent = result.stepsExecuted.filter(s => s.nodeType === "whatsapp" && s.status === "completed").length
    const emailsSent = result.stepsExecuted.filter(s => s.nodeType === "email" && s.status === "completed").length

    console.log(`[TEST] Flow ${flowId} completed: ${result.stepsExecuted.length} steps executed, ${result.asyncNodes.length} async queued, status=${finalStatus}`)

    return NextResponse.json({
      run_id: runId,
      first_step_id: triggerNode.id,
      steps_executed: result.stepsExecuted.length,
      async_nodes_queued: result.asyncNodes.length,
      status: finalStatus,
      errors,
      summary: finalStatus === "completed" ? { whatsapp_sent: whatsappSent, emails_sent: emailsSent } : undefined,
    })
  } catch (err) {
    console.error("[TEST] POST error:", err)
    return NextResponse.json(
      { error: "Erro interno ao testar fluxo" },
      { status: 500 }
    )
  }
}
