import { NextRequest, NextResponse } from "next/server"
import { createCrmAdminClient } from "@/lib/supabase/admin-untyped"
import { requirePermission } from "@/lib/auth/permissions"

export async function GET(_req: NextRequest) {
  const auth = await requirePermission("users")
  if (!auth.authorized) return auth.response

  const db = createCrmAdminClient()

  const { data, error } = await db
    .from("dev_users")
    .select(`
      id, commercial_name, professional_email, is_active, created_at,
      dev_consultant_profiles!user_id(phone_commercial, specializations, languages, instagram_handle, linkedin_url),
      dev_consultant_private_data!user_id(full_name, nif, hiring_date, commission_rate, monthly_salary)
    `)
    .order("commercial_name", { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const headers = [
    "Nome Comercial", "Nome Completo", "Email Profissional", "Telefone",
    "NIF", "Estado",
    "Data Contratação", "Comissão (%)", "Salário Mensal",
    "Especializações", "Idiomas",
    "Instagram", "LinkedIn",
    "Data Registo",
  ]

  const rows = (data ?? []).map((u: Record<string, unknown>) => {
    const profile = u.dev_consultant_profiles as Record<string, unknown> | null
    const priv = u.dev_consultant_private_data as Record<string, unknown> | null
    const specs = Array.isArray(profile?.specializations) ? (profile.specializations as string[]).join(", ") : ""
    const langs = Array.isArray(profile?.languages) ? (profile.languages as string[]).join(", ") : ""

    return [
      u.commercial_name, priv?.full_name, u.professional_email, profile?.phone_commercial,
      priv?.nif, u.is_active ? "Activo" : "Inactivo",
      fmtDate(priv?.hiring_date), priv?.commission_rate, priv?.monthly_salary,
      specs, langs,
      profile?.instagram_handle, profile?.linkedin_url,
      fmtDate(u.created_at),
    ]
  })

  return csvResponse("consultores", headers, rows)
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
