import { createAdminClient } from "@/lib/supabase/admin"
import { NextResponse } from "next/server"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseAny = any

// POST /api/automacao/fluxos/[flowId]/test — Testar fluxo
export async function POST(
  request: Request,
  { params }: { params: Promise<{ flowId: string }> }
) {
  try {
    const { flowId } = await params
    const supabase = createAdminClient()
    const body = await request.json()

    const { entity_type, entity_id, test_variables } = body

    // Buscar flow
    const { data: flow, error: flowError } = await (supabase as SupabaseAny)
      .from("auto_flows")
      .select("id, flow_definition")
      .eq("id", flowId)
      .single()

    if (flowError || !flow) {
      return NextResponse.json(
        { error: "Fluxo não encontrado" },
        { status: 404 }
      )
    }

    const definition = flow.flow_definition
    if (!definition?.nodes?.length) {
      return NextResponse.json(
        { error: "Fluxo sem nodes definidos" },
        { status: 400 }
      )
    }

    // Criar run de teste
    const { data: run, error: runError } = await (supabase as SupabaseAny)
      .from("auto_runs")
      .insert({
        flow_id: flowId,
        status: "running",
        entity_type: entity_type || null,
        entity_id: entity_id || null,
        context: test_variables || {},
        is_test: true,
      })
      .select()
      .single()

    if (runError) {
      return NextResponse.json({ error: runError.message }, { status: 500 })
    }

    // Encontrar primeiro node após trigger
    const triggerNode = definition.nodes.find((n: SupabaseAny) =>
      n.type?.startsWith("trigger_")
    )

    if (!triggerNode) {
      return NextResponse.json(
        { error: "Fluxo sem trigger definido" },
        { status: 400 }
      )
    }

    // Criar step_run para o trigger (marcado como completed)
    await (supabase as SupabaseAny)
      .from("auto_step_runs")
      .insert({
        run_id: run.id,
        flow_id: flowId,
        node_id: triggerNode.id,
        node_type: triggerNode.type,
        status: "completed",
        started_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
      })

    // Encontrar nodes seguintes ao trigger
    const nextEdges = definition.edges.filter(
      (e: SupabaseAny) => e.source === triggerNode.id
    )

    for (const edge of nextEdges) {
      await (supabase as SupabaseAny)
        .from("auto_step_runs")
        .insert({
          run_id: run.id,
          flow_id: flowId,
          node_id: edge.target,
          node_type:
            definition.nodes.find((n: SupabaseAny) => n.id === edge.target)
              ?.type || "unknown",
          status: "pending",
        })
    }

    return NextResponse.json({
      run_id: run.id,
      first_step_id: triggerNode.id,
    })
  } catch (err) {
    console.error("[fluxos/[flowId]/test] POST error:", err)
    return NextResponse.json(
      { error: "Erro interno ao testar fluxo" },
      { status: 500 }
    )
  }
}
