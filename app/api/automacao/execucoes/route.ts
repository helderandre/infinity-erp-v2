// ============================================================
// Execucoes API — Historico de execucoes de fluxos
// Fase 6 do Sistema de Automacoes
// ============================================================

import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SA = any

// GET /api/automacao/execucoes — Lista execucoes com filtros
export async function GET(request: NextRequest) {
  try {
    const supabase = createAdminClient() as SA
    const { searchParams } = new URL(request.url)

    const flowId = searchParams.get("flow_id")
    const status = searchParams.get("status")
    const limit = parseInt(searchParams.get("limit") || "50", 10)
    const offset = parseInt(searchParams.get("offset") || "0", 10)

    let query = supabase
      .from("auto_runs")
      .select("*, auto_flows!inner(name, description)", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1)

    if (flowId) query = query.eq("flow_id", flowId)
    if (status) query = query.eq("status", status)

    const { data, error, count } = await query

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ executions: data || [], total: count || 0 })
  } catch (err) {
    console.error("[execucoes] GET error:", err)
    return NextResponse.json({ error: "Erro ao listar execuções" }, { status: 500 })
  }
}
