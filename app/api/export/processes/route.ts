import { NextRequest, NextResponse } from "next/server"
import { createCrmAdminClient } from "@/lib/supabase/admin-untyped"
import { requirePermission } from "@/lib/auth/permissions"

export async function GET(req: NextRequest) {
  const auth = await requirePermission("processes")
  if (!auth.authorized) return auth.response

  const db = createCrmAdminClient()
  const consultantId = req.nextUrl.searchParams.get("consultant_id")

  let query = db
    .from("proc_instances")
    .select(`
      id, external_ref, process_type, current_status, percent_complete,
      created_at, updated_at, started_at, completed_at,
      dev_properties!property_id(title, external_ref, city, listing_price),
      dev_users!requested_by_user(commercial_name)
    `)
    .order("created_at", { ascending: false })

  if (consultantId) query = query.eq("requested_by_user", consultantId)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const headers = [
    "Referência", "Tipo", "Estado", "Progresso (%)",
    "Imóvel", "Ref. Imóvel", "Cidade", "Preço",
    "Solicitado por",
    "Data Criação", "Data Início", "Data Conclusão",
  ]

  const rows = (data ?? []).map((p: Record<string, unknown>) => {
    const prop = p.dev_properties as Record<string, unknown> | null
    const user = p.dev_users as { commercial_name: string } | null
    return [
      p.external_ref, p.process_type, p.current_status, p.percent_complete,
      prop?.title, prop?.external_ref, prop?.city, prop?.listing_price,
      user?.commercial_name,
      fmtDate(p.created_at), fmtDate(p.started_at), fmtDate(p.completed_at),
    ]
  })

  return csvResponse("processos", headers, rows)
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
