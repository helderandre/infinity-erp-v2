import { createAdminClient } from "@/lib/supabase/admin"
import { NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth/permissions"
import {
  customEventLeadsAddSchema,
  customEventLeadsRemoveSchema,
} from "@/lib/validations/custom-event"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SA = any

type Ctx = { params: Promise<{ id: string }> }

async function ownershipCheck(supabase: SA, eventId: string, userId: string) {
  const { data } = await supabase
    .from("custom_commemorative_events")
    .select("consultant_id")
    .eq("id", eventId)
    .maybeSingle()
  if (!data) return { ok: false as const, response: NextResponse.json({ error: "Evento não encontrado" }, { status: 404 }) }
  if (data.consultant_id !== userId) return { ok: false as const, response: NextResponse.json({ error: "Sem permissão" }, { status: 403 }) }
  return { ok: true as const, consultantId: data.consultant_id as string }
}

// GET /api/automacao/custom-events/[id]/leads — listar leads do evento
export async function GET(request: Request, ctx: Ctx) {
  try {
    const auth = await requireAuth()
    if (!auth.authorized) return auth.response
    const { id } = await ctx.params

    const supabase = createAdminClient() as SA
    const check = await ownershipCheck(supabase, id, auth.user.id)
    if (!check.ok) return check.response

    const { searchParams } = new URL(request.url)
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1"))
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") ?? "50")))
    const offset = (page - 1) * limit

    const { data, error, count } = await supabase
      .from("custom_event_leads")
      .select("lead_id, added_at, leads!inner(nome, email, telemovel, estado)", { count: "exact" })
      .eq("event_id", id)
      .order("added_at", { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const leads = (data ?? []).map((r: SA) => ({
      lead_id: r.lead_id,
      added_at: r.added_at,
      name: r.leads?.nome ?? null,
      email: r.leads?.email ?? null,
      telemovel: r.leads?.telemovel ?? null,
      status: r.leads?.estado ?? null,
    }))

    return NextResponse.json({ leads, total: count ?? 0, page, limit })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erro interno"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// POST /api/automacao/custom-events/[id]/leads — adicionar leads ao evento
export async function POST(request: Request, ctx: Ctx) {
  try {
    const auth = await requireAuth()
    if (!auth.authorized) return auth.response
    const { id } = await ctx.params

    const body = await request.json()
    const parsed = customEventLeadsAddSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Dados inválidos", details: parsed.error.flatten() },
        { status: 400 },
      )
    }

    const supabase = createAdminClient() as SA
    const check = await ownershipCheck(supabase, id, auth.user.id)
    if (!check.ok) return check.response

    let leadIds: string[] = []

    if (parsed.data.all) {
      // Get all leads assigned to this consultant
      const { data: allLeads } = await supabase
        .from("leads")
        .select("id")
        .eq("agent_id", auth.user.id)

      leadIds = (allLeads ?? []).map((l: SA) => l.id)
    } else {
      leadIds = parsed.data.lead_ids ?? []
    }

    if (leadIds.length === 0) {
      return NextResponse.json({ added: 0 })
    }

    const rows = leadIds.map((lid) => ({ event_id: id, lead_id: lid }))

    const { error } = await supabase
      .from("custom_event_leads")
      .upsert(rows, { onConflict: "event_id,lead_id", ignoreDuplicates: true })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ added: rows.length }, { status: 201 })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erro interno"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// DELETE /api/automacao/custom-events/[id]/leads — remover leads do evento
export async function DELETE(request: Request, ctx: Ctx) {
  try {
    const auth = await requireAuth()
    if (!auth.authorized) return auth.response
    const { id } = await ctx.params

    const body = await request.json()
    const parsed = customEventLeadsRemoveSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Dados inválidos", details: parsed.error.flatten() },
        { status: 400 },
      )
    }

    const supabase = createAdminClient() as SA
    const check = await ownershipCheck(supabase, id, auth.user.id)
    if (!check.ok) return check.response

    const { error } = await supabase
      .from("custom_event_leads")
      .delete()
      .eq("event_id", id)
      .in("lead_id", parsed.data.lead_ids)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ removed: parsed.data.lead_ids.length })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erro interno"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
