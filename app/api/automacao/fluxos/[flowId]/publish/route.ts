import { createAdminClient } from "@/lib/supabase/admin"
import { NextResponse } from "next/server"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SA = any

// POST /api/automacao/fluxos/[flowId]/publish — Publicar draft para producao
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ flowId: string }> }
) {
  try {
    const { flowId } = await params
    const supabase = createAdminClient() as SA

    // 1. Buscar o flow
    const { data: flow, error: flowError } = await supabase
      .from("auto_flows")
      .select("draft_definition, wpp_instance_id")
      .eq("id", flowId)
      .single()

    if (flowError || !flow) {
      return NextResponse.json(
        { error: "Fluxo nao encontrado" },
        { status: 404 }
      )
    }

    const draftDef = flow.draft_definition
    if (!draftDef?.nodes?.length) {
      return NextResponse.json(
        { error: "Fluxo sem nodes definidos", errors: ["O fluxo precisa de pelo menos um node"] },
        { status: 422 }
      )
    }

    // 2. Validar — tem trigger?
    const errors: string[] = []
    const hasTrigger = draftDef.nodes.some(
      (n: SA) => (n.data as SA)?.type?.startsWith("trigger_")
    )
    if (!hasTrigger) {
      errors.push("O fluxo precisa de pelo menos um trigger")
    }

    // Validar WhatsApp nodes sem instancia
    const hasWppNode = draftDef.nodes.some(
      (n: SA) => (n.data as SA)?.type === "whatsapp"
    )
    if (hasWppNode && !flow.wpp_instance_id) {
      errors.push("O fluxo tem nodes WhatsApp mas nenhuma instancia WhatsApp seleccionada")
    }

    if (errors.length > 0) {
      return NextResponse.json(
        { error: "Fluxo tem erros", errors },
        { status: 422 }
      )
    }

    // 3. Extrair triggers do draft
    const triggers = extractTriggersFromDefinition(draftDef)

    // 4. Publicar: copiar draft -> published
    const { error: updateError } = await supabase
      .from("auto_flows")
      .update({
        published_definition: draftDef,
        published_at: new Date().toISOString(),
        published_triggers: triggers,
        updated_at: new Date().toISOString(),
      })
      .eq("id", flowId)

    if (updateError) {
      return NextResponse.json(
        { error: updateError.message },
        { status: 500 }
      )
    }

    // 5. Sincronizar auto_triggers (producao)
    await supabase
      .from("auto_triggers")
      .delete()
      .eq("flow_id", flowId)

    if (triggers.length > 0) {
      const triggersToInsert = triggers.map((t: SA) => ({
        flow_id: flowId,
        source_type: t.source_type,
        trigger_source: t.trigger_source || null,
        trigger_condition: t.trigger_condition || {},
        payload_mapping: t.payload_mapping || null,
        active: true,
      }))

      await supabase.from("auto_triggers").insert(triggersToInsert)
    }

    return NextResponse.json({
      ok: true,
      published_at: new Date().toISOString(),
      triggers_count: triggers.length,
    })
  } catch (err) {
    console.error("[fluxos/[flowId]/publish] POST error:", err)
    return NextResponse.json(
      { error: "Erro interno ao publicar fluxo" },
      { status: 500 }
    )
  }
}

function extractTriggersFromDefinition(definition: SA) {
  const triggers: SA[] = []
  for (const node of definition.nodes || []) {
    const d = node.data as SA
    if (d?.type === "trigger_webhook" && d.webhookKey) {
      triggers.push({
        source_type: "webhook",
        trigger_source: d.webhookKey,
        trigger_condition: {},
        payload_mapping: d.webhookMappings || [],
      })
    }
    if (d?.type === "trigger_schedule" && d.cronExpression) {
      triggers.push({
        source_type: "schedule",
        trigger_source: null,
        trigger_condition: {
          cron: d.cronExpression,
          timezone: d.timezone || "Europe/Lisbon",
        },
      })
    }
    if (d?.type === "trigger_status" && d.triggerCondition) {
      triggers.push({
        source_type: "status_change",
        trigger_source: null,
        trigger_condition: d.triggerCondition,
      })
    }
    if (d?.type === "trigger_manual") {
      triggers.push({
        source_type: "manual",
        trigger_source: null,
        trigger_condition: {},
      })
    }
  }
  return triggers
}
