import { NextRequest, NextResponse } from "next/server"
import { createCrmAdminClient } from "@/lib/supabase/admin-untyped"
import { requirePermission } from "@/lib/auth/permissions"

export async function GET(req: NextRequest) {
  const auth = await requirePermission("recruitment")
  if (!auth.authorized) return auth.response

  const db = createCrmAdminClient()
  const recruiterId = req.nextUrl.searchParams.get("consultant_id")

  let query = db
    .from("recruitment_candidates")
    .select(`
      id, full_name, email, phone, source, status,
      assigned_recruiter_id, decision, decision_date,
      first_contact_date, last_interaction_date,
      notes, created_at, updated_at,
      dev_users!assigned_recruiter_id(commercial_name)
    `)
    .order("created_at", { ascending: false })

  if (recruiterId) query = query.eq("assigned_recruiter_id", recruiterId)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const headers = [
    "Nome", "Email", "Telefone", "Origem", "Estado",
    "Recrutador", "Decisão", "Data Decisão",
    "Primeiro Contacto", "Última Interacção",
    "Notas", "Data Criação",
  ]

  const rows = (data ?? []).map((c: Record<string, unknown>) => {
    const recruiter = c.dev_users as { commercial_name: string } | null
    return [
      c.full_name, c.email, c.phone, c.source, c.status,
      recruiter?.commercial_name, c.decision, fmtDate(c.decision_date),
      fmtDate(c.first_contact_date), fmtDate(c.last_interaction_date),
      c.notes, fmtDate(c.created_at),
    ]
  })

  return csvResponse("candidatos", headers, rows)
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
