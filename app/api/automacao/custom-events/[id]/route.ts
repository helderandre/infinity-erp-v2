import { createAdminClient } from "@/lib/supabase/admin"
import { NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth/permissions"
import { customEventUpdateSchema } from "@/lib/validations/custom-event"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SA = any

type Ctx = { params: Promise<{ id: string }> }

// GET /api/automacao/custom-events/[id] — detalhe com leads e runs
export async function GET(_request: Request, ctx: Ctx) {
  try {
    const auth = await requireAuth()
    if (!auth.authorized) return auth.response
    const { id } = await ctx.params

    const supabase = createAdminClient() as SA

    // Event
    const { data: evt, error } = await supabase
      .from("custom_commemorative_events")
      .select("*")
      .eq("id", id)
      .maybeSingle()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!evt) return NextResponse.json({ error: "Evento não encontrado" }, { status: 404 })
    if (evt.consultant_id !== auth.user.id) {
      return NextResponse.json({ error: "Sem permissão" }, { status: 403 })
    }

    // Leads
    const { data: leadRows } = await supabase
      .from("custom_event_leads")
      .select("lead_id, added_at, leads!inner(nome, email, telemovel, estado)")
      .eq("event_id", id)
      .order("added_at", { ascending: false })

    const leads = (leadRows ?? []).map((r: SA) => ({
      lead_id: r.lead_id,
      added_at: r.added_at,
      name: r.leads?.nome ?? null,
      email: r.leads?.email ?? null,
      telemovel: r.leads?.telemovel ?? null,
      status: r.leads?.estado ?? null,
    }))

    // Runs (last 50)
    const { data: runs } = await supabase
      .from("contact_automation_runs")
      .select("id, kind, lead_id, event_type, custom_event_id, auto_run_id, scheduled_for, sent_at, status, skip_reason, error, delivery_log_ids")
      .eq("custom_event_id", id)
      .order("scheduled_for", { ascending: false })
      .limit(50)

    // Enrich runs with lead name
    const leadIds = [...new Set((runs ?? []).map((r: SA) => r.lead_id).filter(Boolean))]
    let leadMap: Record<string, { name: string; email: string }> = {}
    if (leadIds.length > 0) {
      const { data: leadData } = await supabase
        .from("leads")
        .select("id, nome, email")
        .in("id", leadIds)
      leadMap = Object.fromEntries((leadData ?? []).map((l: SA) => [l.id, { name: l.nome, email: l.email }]))
    }

    const enrichedRuns = (runs ?? []).map((r: SA) => ({
      ...r,
      lead_name: leadMap[r.lead_id]?.name ?? null,
      lead_email: leadMap[r.lead_id]?.email ?? null,
    }))

    return NextResponse.json({
      ...evt,
      lead_count: leads.length,
      leads,
      runs: enrichedRuns,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erro interno"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// PUT /api/automacao/custom-events/[id] — editar evento
export async function PUT(request: Request, ctx: Ctx) {
  try {
    const auth = await requireAuth()
    if (!auth.authorized) return auth.response
    const { id } = await ctx.params

    const body = await request.json()
    const parsed = customEventUpdateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Dados inválidos", details: parsed.error.flatten().fieldErrors },
        { status: 400 },
      )
    }

    const supabase = createAdminClient() as SA

    // Ownership check
    const { data: existing } = await supabase
      .from("custom_commemorative_events")
      .select("consultant_id")
      .eq("id", id)
      .maybeSingle()
    if (!existing) return NextResponse.json({ error: "Evento não encontrado" }, { status: 404 })
    if (existing.consultant_id !== auth.user.id) {
      return NextResponse.json({ error: "Sem permissão" }, { status: 403 })
    }

    const { data, error } = await supabase
      .from("custom_commemorative_events")
      .update(parsed.data)
      .eq("id", id)
      .select("*")
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erro interno"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// DELETE /api/automacao/custom-events/[id] — eliminar evento (cascade)
export async function DELETE(_request: Request, ctx: Ctx) {
  try {
    const auth = await requireAuth()
    if (!auth.authorized) return auth.response
    const { id } = await ctx.params

    const supabase = createAdminClient() as SA

    // Ownership check
    const { data: existing } = await supabase
      .from("custom_commemorative_events")
      .select("consultant_id")
      .eq("id", id)
      .maybeSingle()
    if (!existing) return NextResponse.json({ error: "Evento não encontrado" }, { status: 404 })
    if (existing.consultant_id !== auth.user.id) {
      return NextResponse.json({ error: "Sem permissão" }, { status: 403 })
    }

    const { error } = await supabase
      .from("custom_commemorative_events")
      .delete()
      .eq("id", id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erro interno"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
