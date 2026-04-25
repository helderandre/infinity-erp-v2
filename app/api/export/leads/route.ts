import { NextRequest, NextResponse } from "next/server"
import { createCrmAdminClient } from "@/lib/supabase/admin-untyped"
import { requirePermission } from "@/lib/auth/permissions"
import { logExportEvent } from "@/lib/audit/export-event"

/**
 * GET /api/export/leads?consultant_id=xxx
 * Exports leads with negócios info as CSV.
 */
export async function GET(req: NextRequest) {
  const auth = await requirePermission("leads")
  if (!auth.authorized) return auth.response

  const db = createCrmAdminClient()
  const consultantId = req.nextUrl.searchParams.get("consultant_id")

  let query = db
    .from("leads")
    .select(`
      id, nome, email, telemovel, telefone_fixo, nif,
      morada, codigo_postal, localidade,
      origem, estado, temperatura,
      agent_id, observacoes, created_at,
      dev_users!agent_id(commercial_name),
      negocios(id, tipo, estado, orcamento, preco_venda)
    `)
    .order("created_at", { ascending: false })

  if (consultantId) query = query.eq("agent_id", consultantId)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const headers = [
    "Nome", "Email", "Telemóvel", "Telefone Fixo", "NIF",
    "Morada", "Código Postal", "Localidade",
    "Origem", "Estado", "Temperatura",
    "Consultor", "Observações",
    "Nº Negócios", "Tipos Negócio", "Valor Negócios",
    "Data Criação",
  ]

  const rows = (data ?? []).map((c: Record<string, unknown>) => {
    const agent = c.dev_users as { commercial_name: string } | null
    const negocios = (c.negocios ?? []) as Array<{ tipo: string; orcamento: number | null; preco_venda: number | null }>
    const tipos = [...new Set(negocios.map(n => n.tipo))].join(", ")
    const valor = negocios.reduce((s, n) => s + (n.preco_venda ?? n.orcamento ?? 0), 0)

    return [
      c.nome, c.email, c.telemovel, c.telefone_fixo, c.nif,
      c.morada, c.codigo_postal, c.localidade,
      c.origem, c.estado, c.temperatura,
      agent?.commercial_name,
      c.observacoes,
      negocios.length, tipos, valor || "",
      c.created_at ? new Date(c.created_at as string).toLocaleDateString("pt-PT") : "",
    ]
  })

  const csv = buildCsv(headers, rows)
  await logExportEvent(req, auth.user.id, 'leads', { rowCount: rows.length, metadata: consultantId ? { consultant_id: consultantId } : {} })
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="leads-${new Date().toISOString().split("T")[0]}.csv"`,
    },
  })
}

function buildCsv(headers: string[], rows: (string | number | boolean | null | undefined)[][]): string {
  const BOM = "\uFEFF"
  const escape = (v: unknown) => {
    if (v === null || v === undefined) return ""
    const s = String(v)
    return s.includes(";") || s.includes('"') || s.includes("\n") ? `"${s.replace(/"/g, '""')}"` : s
  }
  const lines = [headers.map(escape).join(";")]
  for (const row of rows) lines.push(row.map(escape).join(";"))
  return BOM + lines.join("\r\n")
}
