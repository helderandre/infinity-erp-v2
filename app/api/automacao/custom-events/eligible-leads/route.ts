import { createAdminClient } from "@/lib/supabase/admin"
import { NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth/permissions"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SA = any

// GET /api/automacao/custom-events/eligible-leads — leads do consultor para selecção
export async function GET(request: Request) {
  try {
    const auth = await requireAuth()
    if (!auth.authorized) return auth.response

    const supabase = createAdminClient() as SA
    const { searchParams } = new URL(request.url)

    const search = searchParams.get("search")?.trim()
    const status = searchParams.get("status")
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1"))
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") ?? "50")))
    const offset = (page - 1) * limit
    const eventId = searchParams.get("event_id")

    let query = supabase
      .from("leads")
      .select("id, nome, email, telemovel, estado, origem, data_nascimento, created_at", { count: "exact" })
      .eq("agent_id", auth.user.id)
      .order("nome", { ascending: true })
      .range(offset, offset + limit - 1)

    if (search && search.length >= 2) {
      query = query.or(`nome.ilike.%${search}%,email.ilike.%${search}%,telemovel.ilike.%${search}%`)
    }

    if (status && status !== "all") {
      query = query.eq("estado", status)
    }

    const { data, error, count } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // If event_id provided, mark which leads are already associated
    let associatedSet = new Set<string>()
    if (eventId) {
      const { data: existing } = await supabase
        .from("custom_event_leads")
        .select("lead_id")
        .eq("event_id", eventId)
      associatedSet = new Set((existing ?? []).map((r: SA) => r.lead_id))
    }

    const leads = (data ?? []).map((l: SA) => ({
      id: l.id,
      name: l.nome,
      email: l.email,
      telemovel: l.telemovel,
      status: l.estado,
      source: l.origem,
      data_nascimento: l.data_nascimento ?? null,
      created_at: l.created_at,
      is_associated: associatedSet.has(l.id),
    }))

    return NextResponse.json({ leads, total: count ?? 0, page, limit })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erro interno"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
