import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import { z } from "zod"
import { requirePermission } from "@/lib/auth/permissions"

const FIXED_EVENTS = ["aniversario_contacto", "natal", "ano_novo"] as const
const ALL_EVENT_TYPES = [...FIXED_EVENTS, "custom_event"] as const
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const upsertSchema = z
  .object({
    event_type: z.enum(ALL_EVENT_TYPES),
    custom_event_id: z.string().regex(UUID_REGEX).optional(),
    email_template_id: z.string().regex(UUID_REGEX).nullable().optional(),
    wpp_template_id: z.string().regex(UUID_REGEX).nullable().optional(),
    smtp_account_id: z.string().regex(UUID_REGEX).nullable().optional(),
    wpp_instance_id: z.string().regex(UUID_REGEX).nullable().optional(),
    send_hour: z.number().int().min(0).max(23).nullable().optional(),
  })
  .refine(
    (data) =>
      (data.event_type === "custom_event" && !!data.custom_event_id) ||
      (data.event_type !== "custom_event" && !data.custom_event_id),
    {
      message:
        "custom_event_id é obrigatório para event_type='custom_event' e proibido caso contrário",
      path: ["custom_event_id"],
    },
  )

type UpsertBody = z.infer<typeof upsertSchema>

function isBroker(roles: string[]) {
  return roles.some((r) => ["admin", "Broker/CEO"].includes(r))
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function loadLead(supabase: any, leadId: string) {
  const { data, error } = await supabase
    .from("leads")
    .select("id, agent_id")
    .eq("id", leadId)
    .maybeSingle()
  if (error) throw error
  return data as { id: string; agent_id: string | null } | null
}

async function validateOverride(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  agentId: string | null,
  body: UpsertBody,
): Promise<{ ok: true } | { ok: false; code: string; message: string }> {
  async function checkTemplate(
    table: "tpl_email_library" | "auto_wpp_templates",
    id: string,
  ) {
    const { data } = await supabase
      .from(table)
      .select("id,scope,scope_id,is_active")
      .eq("id", id)
      .maybeSingle()
    if (!data) return false
    if (data.is_active !== true) return false
    if (data.scope === "global") return true
    if (data.scope === "consultant" && data.scope_id === agentId) return true
    return false
  }

  if (body.email_template_id) {
    const ok = await checkTemplate("tpl_email_library", body.email_template_id)
    if (!ok) return { ok: false, code: "template_not_accessible", message: "Template de email não acessível" }
  }
  if (body.wpp_template_id) {
    const ok = await checkTemplate("auto_wpp_templates", body.wpp_template_id)
    if (!ok) return { ok: false, code: "template_not_accessible", message: "Template de WhatsApp não acessível" }
  }
  if (body.smtp_account_id) {
    const { data: acct } = await supabase
      .from("consultant_email_accounts")
      .select("consultant_id")
      .eq("id", body.smtp_account_id)
      .maybeSingle()
    if (!acct || acct.consultant_id !== agentId) {
      return { ok: false, code: "account_not_owned", message: "Conta SMTP não pertence ao consultor do lead" }
    }
  }
  if (body.wpp_instance_id) {
    const { data: inst } = await supabase
      .from("auto_wpp_instances")
      .select("user_id")
      .eq("id", body.wpp_instance_id)
      .maybeSingle()
    if (!inst || inst.user_id !== agentId) {
      return { ok: false, code: "instance_not_owned", message: "Instância WhatsApp não pertence ao consultor do lead" }
    }
  }
  return { ok: true }
}

/**
 * Validates that `customEventId` exists and is owned by the authenticated consultor.
 * Returns null on success or a NextResponse on failure.
 */
async function validateCustomEventOwnership(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  customEventId: string,
  authUserId: string,
  isUserBroker: boolean,
): Promise<NextResponse | null> {
  const { data, error } = await supabase
    .from("custom_commemorative_events")
    .select("id, consultant_id")
    .eq("id", customEventId)
    .maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: "Evento personalizado não encontrado" }, { status: 404 })
  if (!isUserBroker && data.consultant_id !== authUserId) {
    return NextResponse.json({ error: "Sem acesso a este evento personalizado" }, { status: 403 })
  }
  return null
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requirePermission("leads")
  if (!auth.authorized) return auth.response

  const { id } = await params
  const supabase = await createClient()

  const lead = await loadLead(supabase, id)
  if (!lead) return NextResponse.json({ error: "Lead não encontrado" }, { status: 404 })
  if (!isBroker(auth.roles) && lead.agent_id !== auth.user.id) {
    return NextResponse.json({ error: "Sem acesso a este lead" }, { status: 403 })
  }

  const { data, error } = await supabase
    .from("contact_automation_lead_settings")
    .select("*")
    .eq("lead_id", id)
    .order("event_type", { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ settings: data ?? [] })
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requirePermission("leads")
  if (!auth.authorized) return auth.response

  const { id } = await params
  const supabase = await createClient()
  const body = await request.json()
  const parsed = upsertSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Dados inválidos", details: parsed.error.flatten() },
      { status: 400 },
    )
  }

  const lead = await loadLead(supabase, id)
  if (!lead) return NextResponse.json({ error: "Lead não encontrado" }, { status: 404 })
  if (!isBroker(auth.roles) && lead.agent_id !== auth.user.id) {
    return NextResponse.json({ error: "Sem acesso a este lead" }, { status: 403 })
  }

  const { event_type, custom_event_id } = parsed.data

  if (custom_event_id) {
    const ownershipErr = await validateCustomEventOwnership(
      supabase,
      custom_event_id,
      auth.user.id,
      isBroker(auth.roles),
    )
    if (ownershipErr) return ownershipErr
  }

  const check = await validateOverride(supabase, lead.agent_id, parsed.data)
  if (!check.ok) return NextResponse.json({ error: check.message, code: check.code }, { status: 400 })

  const row = {
    lead_id: id,
    event_type,
    custom_event_id: custom_event_id ?? null,
    email_template_id: parsed.data.email_template_id ?? null,
    wpp_template_id: parsed.data.wpp_template_id ?? null,
    smtp_account_id: parsed.data.smtp_account_id ?? null,
    wpp_instance_id: parsed.data.wpp_instance_id ?? null,
    send_hour: parsed.data.send_hour ?? null,
  }

  // Manual upsert — o unique index é funcional (COALESCE) e o PostgREST
  // onConflict só aceita lista de colunas, não expressões.
  let findQuery = supabase
    .from("contact_automation_lead_settings")
    .select("id")
    .eq("lead_id", id)
    .eq("event_type", event_type)
  findQuery = custom_event_id
    ? findQuery.eq("custom_event_id", custom_event_id)
    : findQuery.is("custom_event_id", null)
  const { data: existing, error: findErr } = await findQuery.maybeSingle()
  if (findErr) return NextResponse.json({ error: findErr.message }, { status: 500 })

  if (existing?.id) {
    const { data, error } = await supabase
      .from("contact_automation_lead_settings")
      .update(row)
      .eq("id", existing.id)
      .select()
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ setting: data }, { status: 200 })
  }

  const { data, error } = await supabase
    .from("contact_automation_lead_settings")
    .insert(row)
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ setting: data }, { status: 201 })
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requirePermission("leads")
  if (!auth.authorized) return auth.response

  const { id } = await params
  const { searchParams } = new URL(request.url)
  const eventType = searchParams.get("event_type")
  const customEventIdRaw = searchParams.get("custom_event_id")

  if (!eventType || !(ALL_EVENT_TYPES as readonly string[]).includes(eventType)) {
    return NextResponse.json({ error: "event_type inválido" }, { status: 400 })
  }
  if (eventType === "custom_event") {
    if (!customEventIdRaw || !UUID_REGEX.test(customEventIdRaw)) {
      return NextResponse.json(
        { error: "custom_event_id obrigatório para event_type='custom_event'" },
        { status: 400 },
      )
    }
  } else if (customEventIdRaw) {
    return NextResponse.json(
      { error: "custom_event_id só é aplicável a event_type='custom_event'" },
      { status: 400 },
    )
  }

  const supabase = await createClient()
  const lead = await loadLead(supabase, id)
  if (!lead) return NextResponse.json({ error: "Lead não encontrado" }, { status: 404 })
  if (!isBroker(auth.roles) && lead.agent_id !== auth.user.id) {
    return NextResponse.json({ error: "Sem acesso a este lead" }, { status: 403 })
  }

  if (customEventIdRaw) {
    const ownershipErr = await validateCustomEventOwnership(
      supabase,
      customEventIdRaw,
      auth.user.id,
      isBroker(auth.roles),
    )
    if (ownershipErr) return ownershipErr
  }

  let deleteQuery = supabase
    .from("contact_automation_lead_settings")
    .delete()
    .eq("lead_id", id)
    .eq("event_type", eventType)
  deleteQuery = customEventIdRaw
    ? deleteQuery.eq("custom_event_id", customEventIdRaw)
    : deleteQuery.is("custom_event_id", null)

  const { error } = await deleteQuery

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
