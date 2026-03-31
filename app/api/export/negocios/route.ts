import { NextRequest, NextResponse } from "next/server"
import { createCrmAdminClient } from "@/lib/supabase/admin-untyped"
import { requirePermission } from "@/lib/auth/permissions"

export async function GET(req: NextRequest) {
  const auth = await requirePermission("leads")
  if (!auth.authorized) return auth.response

  const db = createCrmAdminClient()
  const consultantId = req.nextUrl.searchParams.get("consultant_id")

  let query = db
    .from("negocios")
    .select(`
      id, tipo, estado, orcamento, preco_venda, expected_value,
      pipeline_stage_id, won_date, lost_date, lost_reason,
      assigned_consultant_id, created_at, updated_at,
      leads!lead_id(nome, email, telemovel),
      dev_users!assigned_consultant_id(commercial_name),
      leads_pipeline_stages!pipeline_stage_id(name, pipeline_type)
    `)
    .order("created_at", { ascending: false })

  if (consultantId) query = query.eq("assigned_consultant_id", consultantId)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const headers = [
    "Tipo", "Pipeline", "Fase Actual", "Estado Legacy",
    "Contacto", "Email", "Telemóvel",
    "Orçamento", "Preço Venda", "Valor Esperado",
    "Consultor",
    "Data Ganho", "Data Perdido", "Motivo Perda",
    "Data Criação", "Última Actualização",
  ]

  const rows = (data ?? []).map((n: Record<string, unknown>) => {
    const contact = n.leads as Record<string, unknown> | null
    const agent = n.dev_users as { commercial_name: string } | null
    const stage = n.leads_pipeline_stages as { name: string; pipeline_type: string } | null
    return [
      n.tipo, stage?.pipeline_type, stage?.name, n.estado,
      contact?.nome, contact?.email, contact?.telemovel,
      n.orcamento, n.preco_venda, n.expected_value,
      agent?.commercial_name,
      fmtDate(n.won_date), fmtDate(n.lost_date), n.lost_reason,
      fmtDate(n.created_at), fmtDate(n.updated_at),
    ]
  })

  return csvResponse("negocios", headers, rows)
}

function fmtDate(v: unknown) { return v ? new Date(v as string).toLocaleDateString("pt-PT") : "" }
function csvResponse(name: string, headers: string[], rows: unknown[][]) {
  const BOM = "\uFEFF"
  const esc = (v: unknown) => { if (v == null) return ""; const s = String(v); return s.includes(";") || s.includes('"') || s.includes("\n") ? `"${s.replace(/"/g, '""')}"` : s }
  const lines = [headers.map(esc).join(";"), ...rows.map(r => r.map(esc).join(";"))]
  return new NextResponse(BOM + lines.join("\r\n"), {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${name}-${new Date().toISOString().split("T")[0]}.csv"` },
  })
}
