import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import { z } from "zod"
import { requirePermission } from "@/lib/auth/permissions"

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const FIXED_EVENTS = ["aniversario_contacto", "natal", "ano_novo"] as const
const CHANNELS = ["email", "whatsapp"] as const

const muteSchema = z
  .object({
    consultant_id: z.string().regex(UUID_REGEX).nullable().optional(),
    lead_id: z.string().regex(UUID_REGEX).nullable().optional(),
    event_type: z.enum(FIXED_EVENTS).nullable().optional(),
    channel: z.enum(CHANNELS).nullable().optional(),
  })
  .refine((v) => Boolean(v.consultant_id) || Boolean(v.lead_id), {
    message: "Pelo menos um de consultant_id ou lead_id deve ser fornecido",
  })

function isBroker(roles: string[]) {
  return roles.some((r) => ["admin", "Broker/CEO"].includes(r))
}

export async function GET(request: Request) {
  const auth = await requirePermission("leads")
  if (!auth.authorized) return auth.response

  const supabase = await createClient()
  const { searchParams } = new URL(request.url)
  const leadFilter = searchParams.get("lead_id")
  const eventFilter = searchParams.get("event_type")

  let query = supabase
    .from("contact_automation_mutes")
    .select("*")
    .order("muted_at", { ascending: false })
    .limit(500)

  if (leadFilter) query = query.eq("lead_id", leadFilter)
  if (eventFilter) query = query.eq("event_type", eventFilter)

  if (!isBroker(auth.roles)) {
    // consultor: só vê mutes que criou ou que afectam os seus leads / os seus consultant-wide
    query = query.or(`muted_by.eq.${auth.user.id},consultant_id.eq.${auth.user.id}`)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ mutes: data ?? [] })
}

export async function POST(request: Request) {
  const auth = await requirePermission("leads")
  if (!auth.authorized) return auth.response

  const supabase = await createClient()
  const body = await request.json()
  const parsed = muteSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos", details: parsed.error.flatten() }, { status: 400 })
  }

  const row = {
    consultant_id: parsed.data.consultant_id ?? null,
    lead_id: parsed.data.lead_id ?? null,
    event_type: parsed.data.event_type ?? null,
    channel: parsed.data.channel ?? null,
    muted_by: auth.user.id,
  }

  // Ownership checks (non-broker)
  if (!isBroker(auth.roles)) {
    if (row.consultant_id && row.consultant_id !== auth.user.id) {
      return NextResponse.json(
        { error: "Não pode mutar outro consultor" },
        { status: 403 },
      )
    }
    if (row.lead_id) {
      const { data: lead } = await supabase
        .from("leads")
        .select("agent_id")
        .eq("id", row.lead_id)
        .maybeSingle()
      if (!lead || lead.agent_id !== auth.user.id) {
        return NextResponse.json({ error: "Lead não lhe pertence" }, { status: 403 })
      }
    }
  }

  // Detect duplicate (same 4 discriminators by same muted_by)
  const dupFilters: Record<string, unknown> = {
    consultant_id: row.consultant_id,
    lead_id: row.lead_id,
    event_type: row.event_type,
    channel: row.channel,
    muted_by: row.muted_by,
  }
  let dupQuery = supabase.from("contact_automation_mutes").select("*")
  for (const [k, v] of Object.entries(dupFilters)) {
    dupQuery = v === null ? dupQuery.is(k, null) : dupQuery.eq(k, v as string)
  }
  const { data: dup } = await dupQuery.maybeSingle()
  if (dup) {
    return NextResponse.json({ mute: dup, duplicate: true })
  }

  const { data, error } = await supabase
    .from("contact_automation_mutes")
    .insert(row)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ mute: data }, { status: 201 })
}

export async function DELETE(request: Request) {
  const auth = await requirePermission("leads")
  if (!auth.authorized) return auth.response

  const { searchParams } = new URL(request.url)
  const id = searchParams.get("id")
  if (!id || !UUID_REGEX.test(id)) {
    return NextResponse.json({ error: "id inválido" }, { status: 400 })
  }

  const supabase = await createClient()
  const { data: mute } = await supabase
    .from("contact_automation_mutes")
    .select("id, muted_by, lead_id, consultant_id")
    .eq("id", id)
    .maybeSingle()

  if (!mute) return NextResponse.json({ error: "Mute não encontrado" }, { status: 404 })

  if (!isBroker(auth.roles) && mute.muted_by !== auth.user.id) {
    return NextResponse.json({ error: "Sem acesso a este mute" }, { status: 403 })
  }

  const { error } = await supabase.from("contact_automation_mutes").delete().eq("id", id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
