import { createAdminClient } from "@/lib/supabase/admin"
import { NextResponse } from "next/server"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseAny = any

// GET /api/automacao/email-templates — Listar templates de email da biblioteca
export async function GET() {
  try {
    const supabase = createAdminClient()

    const { data, error } = (await (supabase as SupabaseAny)
      .from("tpl_email_library")
      .select("id, name, subject, description")
      .order("name")) as { data: { id: string; name: string; subject: string; description: string | null }[] | null; error: SupabaseAny }

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ templates: data || [] })
  } catch (err) {
    console.error("[email-templates] GET error:", err)
    return NextResponse.json(
      { error: "Erro interno ao listar templates de email" },
      { status: 500 }
    )
  }
}
