import { NextRequest, NextResponse } from "next/server"
import { createCrmAdminClient } from "@/lib/supabase/admin-untyped"
import { requirePermission } from "@/lib/auth/permissions"
import { logExportEvent } from "@/lib/audit/export-event"

export async function GET(req: NextRequest) {
  const auth = await requirePermission("financial")
  if (!auth.authorized) return auth.response

  const db = createCrmAdminClient()
  const consultantId = req.nextUrl.searchParams.get("consultant_id")

  let query = db
    .from("temp_financial_transactions")
    .select(`
      id, transaction_type, transaction_date, reporting_month, status,
      deal_value, agency_commission_amount, consultant_commission_amount,
      is_shared_deal, share_type, share_pct,
      dev_users!consultant_id(commercial_name),
      dev_properties!property_id(title, external_ref, city, listing_price, business_type)
    `)
    .order("transaction_date", { ascending: false })

  if (consultantId) query = query.eq("consultant_id", consultantId)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const headers = [
    "Tipo Transacção", "Data", "Mês Reporte", "Estado",
    "Consultor",
    "Imóvel", "Ref. Imóvel", "Cidade", "Tipo Negócio",
    "Valor Negócio", "Comissão Agência", "Comissão Consultor",
    "Partilha", "Tipo Partilha", "Partilha (%)",
  ]

  const rows = (data ?? []).map((t: Record<string, unknown>) => {
    const agent = t.dev_users as { commercial_name: string } | null
    const prop = t.dev_properties as Record<string, unknown> | null
    return [
      t.transaction_type, fmtDate(t.transaction_date), t.reporting_month, t.status,
      agent?.commercial_name,
      prop?.title, prop?.external_ref, prop?.city, prop?.business_type,
      t.deal_value, t.agency_commission_amount, t.consultant_commission_amount,
      t.is_shared_deal ? "Sim" : "Não", t.share_type, t.share_pct,
    ]
  })

  await logExportEvent(req, auth.user.id, 'commissions', { rowCount: rows.length })
  return csvResponse("comissoes", headers, rows)
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
