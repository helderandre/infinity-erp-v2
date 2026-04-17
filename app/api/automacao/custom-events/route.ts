import { createAdminClient } from "@/lib/supabase/admin"
import { NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth/permissions"
import { customEventCreateSchema } from "@/lib/validations/custom-event"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SA = any

// GET /api/automacao/custom-events — listar eventos do consultor autenticado
export async function GET(request: Request) {
  try {
    const auth = await requireAuth()
    if (!auth.authorized) return auth.response

    const supabase = createAdminClient() as SA
    const { searchParams } = new URL(request.url)
    const statusFilter = searchParams.get("status")

    let query = supabase
      .from("custom_commemorative_events")
      .select("*")
      .eq("consultant_id", auth.user.id)
      .order("event_date", { ascending: true })

    if (statusFilter && statusFilter !== "all") {
      query = query.eq("status", statusFilter)
    }

    const { data: events, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Enrich with lead count and last sent
    const enriched = await Promise.all(
      (events ?? []).map(async (evt: SA) => {
        const { count } = await supabase
          .from("custom_event_leads")
          .select("*", { count: "exact", head: true })
          .eq("event_id", evt.id)

        const { data: lastRun } = await supabase
          .from("contact_automation_runs")
          .select("sent_at")
          .eq("custom_event_id", evt.id)
          .eq("status", "sent")
          .order("sent_at", { ascending: false })
          .limit(1)
          .maybeSingle()

        return {
          ...evt,
          lead_count: count ?? 0,
          last_sent_at: lastRun?.sent_at ?? null,
        }
      }),
    )

    return NextResponse.json(enriched)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erro interno"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// POST /api/automacao/custom-events — criar evento
export async function POST(request: Request) {
  try {
    const auth = await requireAuth()
    if (!auth.authorized) return auth.response

    const body = await request.json()
    const parsed = customEventCreateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Dados inválidos", details: parsed.error.flatten().fieldErrors },
        { status: 400 },
      )
    }

    const supabase = createAdminClient() as SA
    const { data, error } = await supabase
      .from("custom_commemorative_events")
      .insert({
        consultant_id: auth.user.id,
        ...parsed.data,
      })
      .select("*")
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data, { status: 201 })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erro interno"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
