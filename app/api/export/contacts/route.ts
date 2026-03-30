import { NextRequest, NextResponse } from "next/server"
import { createCrmAdminClient } from "@/lib/supabase/admin-untyped"
import { requirePermission } from "@/lib/auth/permissions"

/**
 * GET /api/export/contacts?consultant_id=xxx
 * Exports CRM contacts (leads table) as CSV.
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
      nacionalidade, data_nascimento,
      morada, codigo_postal, localidade,
      tem_empresa, empresa, nipc, email_empresa, telefone_empresa,
      origem, estado, temperatura,
      agent_id, observacoes, created_at,
      dev_users!agent_id(commercial_name)
    `)
    .order("nome", { ascending: true })

  if (consultantId) query = query.eq("agent_id", consultantId)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const headers = [
    "Nome", "Email", "Telemóvel", "Telefone Fixo", "NIF",
    "Nacionalidade", "Data Nascimento",
    "Morada", "Código Postal", "Localidade",
    "Empresa", "NIPC", "Email Empresa", "Telefone Empresa",
    "Origem", "Estado", "Temperatura",
    "Consultor", "Observações", "Data Criação",
  ]

  const rows = (data ?? []).map((c: Record<string, unknown>) => {
    const agent = c.dev_users as { commercial_name: string } | null
    return [
      c.nome, c.email, c.telemovel, c.telefone_fixo, c.nif,
      c.nacionalidade, c.data_nascimento,
      c.morada, c.codigo_postal, c.localidade,
      c.empresa, c.nipc, c.email_empresa, c.telefone_empresa,
      c.origem, c.estado, c.temperatura,
      agent?.commercial_name,
      c.observacoes,
      c.created_at ? new Date(c.created_at as string).toLocaleDateString("pt-PT") : "",
    ]
  })

  const csv = buildCsv(headers, rows)
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="contactos-${new Date().toISOString().split("T")[0]}.csv"`,
    },
  })
}

function buildCsv(headers: string[], rows: (string | number | boolean | null | undefined)[][]): string {
  const BOM = "\uFEFF" // UTF-8 BOM for Excel
  const escape = (v: unknown) => {
    if (v === null || v === undefined) return ""
    const s = String(v)
    return s.includes(";") || s.includes('"') || s.includes("\n")
      ? `"${s.replace(/"/g, '""')}"`
      : s
  }
  const lines = [headers.map(escape).join(";")]
  for (const row of rows) lines.push(row.map(escape).join(";"))
  return BOM + lines.join("\r\n")
}
