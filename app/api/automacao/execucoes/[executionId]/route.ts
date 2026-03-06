// ============================================================
// Execucao Detail API — Detalhe de uma execucao + steps
// Fase 6 do Sistema de Automacoes
//
// GET  — Detalhe com steps e deliveries
// POST — Retry: se body tem step_id, retenta step individual;
//        caso contrario retenta todos os steps falhados
// ============================================================

import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SA = any

// GET /api/automacao/execucoes/[executionId] — Detalhe com steps
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ executionId: string }> }
) {
  try {
    const { executionId } = await params
    const supabase = createAdminClient() as SA

    const { data: run, error: runError } = await supabase
      .from("auto_runs")
      .select("*, auto_flows!inner(name, draft_definition)")
      .eq("id", executionId)
      .single()

    if (runError || !run) {
      return NextResponse.json({ error: "Execucao nao encontrada" }, { status: 404 })
    }

    const { data: steps } = await supabase
      .from("auto_step_runs")
      .select("*")
      .eq("run_id", executionId)
      .order("created_at", { ascending: true })

    const { data: deliveries } = await supabase
      .from("auto_delivery_log")
      .select("*")
      .eq("run_id", executionId)
      .order("created_at", { ascending: true })

    return NextResponse.json({
      run,
      steps: steps || [],
      deliveries: deliveries || [],
    })
  } catch (err) {
    console.error("[execucoes/[id]] GET error:", err)
    return NextResponse.json({ error: "Erro ao obter execucao" }, { status: 500 })
  }
}

// POST /api/automacao/execucoes/[executionId] — Retry de steps falhados
// Body opcional: { step_id: string } — se fornecido, retenta apenas esse step
export async function POST(
  request: Request,
  { params }: { params: Promise<{ executionId: string }> }
) {
  try {
    const { executionId } = await params
    const supabase = createAdminClient() as SA

    // Parse body (pode ser vazio para retry de todos os falhados)
    let body: { step_id?: string } = {}
    try {
      body = await request.json()
    } catch {
      // empty body is fine — retry all failed
    }

    if (body.step_id) {
      // Retry de step individual
      const { data: step, error } = await supabase
        .from("auto_step_runs")
        .select("id, status, output_data")
        .eq("id", body.step_id)
        .eq("run_id", executionId)
        .single()

      if (error || !step) {
        return NextResponse.json({ error: "Step nao encontrado" }, { status: 404 })
      }

      if (step.status !== "failed") {
        return NextResponse.json({ error: "Step nao esta falhado" }, { status: 400 })
      }

      // Reset step para pending
      await supabase.from("auto_step_runs").update({
        status: "pending",
        retry_count: 0,
        scheduled_for: new Date().toISOString(),
        error_message: null,
        output_data: null,
        started_at: null,
        completed_at: null,
      }).eq("id", body.step_id)

      // Update run status back to running
      await supabase.from("auto_runs").update({
        status: "running",
        completed_at: null,
        error_message: null,
        updated_at: new Date().toISOString(),
      }).eq("id", executionId)

      console.log(`[RETRY] Step ${body.step_id} re-enfileirado manualmente para run ${executionId}`)
      return NextResponse.json({ ok: true, retriedSteps: 1, step_id: body.step_id })
    }

    // Retry de todos os steps falhados
    const { data: failedSteps, error } = await supabase
      .from("auto_step_runs")
      .select("id")
      .eq("run_id", executionId)
      .eq("status", "failed")

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!failedSteps?.length) {
      return NextResponse.json({ error: "Sem steps falhados para repetir" }, { status: 400 })
    }

    // Reset failed steps
    for (const step of failedSteps) {
      await supabase.from("auto_step_runs").update({
        status: "pending",
        error_message: null,
        output_data: null,
        completed_at: null,
        started_at: null,
        retry_count: 0,
        scheduled_for: new Date().toISOString(),
      }).eq("id", step.id)
    }

    // Update run status back to running
    await supabase.from("auto_runs").update({
      status: "running",
      completed_at: null,
      error_message: null,
      updated_at: new Date().toISOString(),
    }).eq("id", executionId)

    console.log(`[RETRY] ${failedSteps.length} steps re-enfileirados para run ${executionId}`)
    return NextResponse.json({ ok: true, retriedSteps: failedSteps.length })
  } catch (err) {
    console.error("[execucoes/[id]] POST retry error:", err)
    return NextResponse.json({ error: "Erro ao repetir execucao" }, { status: 500 })
  }
}
