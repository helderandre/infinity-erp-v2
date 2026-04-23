import { createAdminClient } from "@/lib/supabase/admin"
import { NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth/permissions"
import { LEAD_ESTADOS } from "@/lib/constants"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SA = any

const MAX_FILTERS_PER_GROUP = 20
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const VALID_ESTADOS = new Set<string>(LEAD_ESTADOS as readonly string[])

function parseCsvParam(raw: string | null): string[] {
  if (!raw) return []
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
}

function canSeeAll(roles: string[]) {
  return roles.some((r) => ["admin", "Broker/CEO"].includes(r))
}

// GET /api/automacao/custom-events/eligible-leads — leads do consultor para selecção
export async function GET(request: Request) {
  try {
    const auth = await requireAuth()
    if (!auth.authorized) return auth.response

    const supabase = createAdminClient() as SA
    const { searchParams } = new URL(request.url)

    const search = searchParams.get("search")?.trim()
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1"))
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") ?? "50")))
    const offset = (page - 1) * limit
    const eventId = searchParams.get("event_id")
    const consultantParam = searchParams.get("consultant_id")

    let targetConsultantId = auth.user.id
    if (consultantParam && consultantParam !== auth.user.id) {
      if (!canSeeAll(auth.roles)) {
        return NextResponse.json(
          { error: "Sem permissão para consultar outro consultor" },
          { status: 403 },
        )
      }
      targetConsultantId = consultantParam
    }

    // Raw arrays from query string (CSV)
    const rawPipelineStageIds = parseCsvParam(searchParams.get("pipeline_stage_ids"))
    const rawContactEstados = parseCsvParam(searchParams.get("contact_estados"))

    // Enforce caps BEFORE filtering — a request with 21 raw values is a client bug
    if (
      rawPipelineStageIds.length > MAX_FILTERS_PER_GROUP ||
      rawContactEstados.length > MAX_FILTERS_PER_GROUP
    ) {
      return NextResponse.json(
        { error: "Demasiados filtros (máximo 20 por grupo)" },
        { status: 400 },
      )
    }

    // Defence-in-depth: silently drop malformed values
    const pipelineStageIds = rawPipelineStageIds.filter((v) => UUID_RE.test(v))
    const contactEstados = rawContactEstados.filter((v) => VALID_ESTADOS.has(v))

    let query = supabase
      .from("leads")
      .select("id, nome, email, telemovel, estado, origem, data_nascimento, created_at", { count: "exact" })
      .eq("agent_id", targetConsultantId)
      .order("nome", { ascending: true })
      .range(offset, offset + limit - 1)

    if (search && search.length >= 2) {
      query = query.or(`nome.ilike.%${search}%,email.ilike.%${search}%,telemovel.ilike.%${search}%`)
    }

    // Pipeline filter: two-step to avoid join duplication. First resolve lead_ids
    // with a negócio in any of the selected stages, then restrict main query.
    if (pipelineStageIds.length > 0) {
      const { data: negocioRows, error: negocioErr } = await supabase
        .from("negocios")
        .select("lead_id")
        .in("pipeline_stage_id", pipelineStageIds)

      if (negocioErr) return NextResponse.json({ error: negocioErr.message }, { status: 500 })

      const leadIdSet = Array.from(
        new Set((negocioRows ?? []).map((r: SA) => r.lead_id).filter((v: unknown): v is string => !!v)),
      )

      if (leadIdSet.length === 0) {
        return NextResponse.json({ leads: [], total: 0, page, limit })
      }

      query = query.in("id", leadIdSet)
    }

    if (contactEstados.length > 0) {
      query = query.in("estado", contactEstados)
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
