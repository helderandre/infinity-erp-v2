import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { requirePermission } from "@/lib/auth/permissions"
import { logExportEvent } from "@/lib/audit/export-event"

/**
 * GET /api/export/properties?consultant_id=xxx
 * Exports properties with specs as CSV.
 */
export async function GET(req: NextRequest) {
  const auth = await requirePermission("properties")
  if (!auth.authorized) return auth.response

  const supabase = await createClient()
  const consultantId = req.nextUrl.searchParams.get("consultant_id")

  let query = supabase
    .from("dev_properties")
    .select(`
      id, external_ref, title, description, listing_price,
      property_type, business_type, status, energy_certificate,
      city, zone, address_street, postal_code,
      property_condition, contract_regime,
      consultant_id, created_at, updated_at,
      dev_property_specifications(
        typology, bedrooms, bathrooms, area_gross, area_util,
        construction_year, parking_spaces, features
      ),
      dev_property_internal(
        commission_agreed, commission_type, imi_value, condominium_fee
      ),
      dev_users!consultant_id(commercial_name)
    `)
    .order("created_at", { ascending: false })

  if (consultantId) query = query.eq("consultant_id", consultantId)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const headers = [
    "Referência", "Título", "Tipo Imóvel", "Tipo Negócio", "Estado",
    "Preço", "Condição", "Certificado Energético",
    "Morada", "Código Postal", "Cidade", "Zona",
    "Tipologia", "Quartos", "Casas Banho", "Área Bruta (m²)", "Área Útil (m²)",
    "Ano Construção", "Estacionamento", "Características",
    "Comissão (%)", "IMI", "Condomínio",
    "Regime Contrato", "Consultor",
    "Data Criação", "Última Actualização",
  ]

  const rows = (data ?? []).map((p: Record<string, unknown>) => {
    const specs = p.dev_property_specifications as Record<string, unknown> | null
    const internal = p.dev_property_internal as Record<string, unknown> | null
    const agent = p.dev_users as { commercial_name: string } | null
    const features = Array.isArray(specs?.features) ? (specs.features as string[]).join(", ") : ""

    return [
      p.external_ref, p.title, p.property_type, p.business_type, p.status,
      p.listing_price, p.property_condition, p.energy_certificate,
      p.address_street, p.postal_code, p.city, p.zone,
      specs?.typology, specs?.bedrooms, specs?.bathrooms, specs?.area_gross, specs?.area_util,
      specs?.construction_year, specs?.parking_spaces, features,
      internal?.commission_agreed, internal?.imi_value, internal?.condominium_fee,
      p.contract_regime, agent?.commercial_name,
      p.created_at ? new Date(p.created_at as string).toLocaleDateString("pt-PT") : "",
      p.updated_at ? new Date(p.updated_at as string).toLocaleDateString("pt-PT") : "",
    ]
  })

  const csv = buildCsv(headers, rows)
  await logExportEvent(req, auth.user.id, 'properties', { rowCount: rows.length, metadata: consultantId ? { consultant_id: consultantId } : {} })
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="imoveis-${new Date().toISOString().split("T")[0]}.csv"`,
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
