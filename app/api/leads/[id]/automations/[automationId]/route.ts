// @ts-nocheck
import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { requirePermission } from "@/lib/auth/permissions"
import { patchContactAutomationSchema } from "@/lib/validations/contact-automation"
import { computeNextTriggerAt } from "@/lib/automacao/compute-next-trigger"

type Ctx = { params: Promise<{ id: string; automationId: string }> }

async function loadAutomation(
  admin: ReturnType<typeof createAdminClient>,
  leadId: string,
  automationId: string,
) {
  const { data } = await admin
    .from("contact_automations")
    .select("*, negocios(id, expected_close_date)")
    .eq("id", automationId)
    .eq("contact_id", leadId)
    .maybeSingle()
  if (!data) return null
  const { data: lead } = await admin
    .from("leads")
    .select("id, data_nascimento")
    .eq("id", leadId)
    .maybeSingle()
  return {
    ...data,
    __lead_birthday: lead?.data_nascimento || null,
  } as any
}

export async function GET(_request: Request, { params }: Ctx) {
  const auth = await requirePermission("leads")
  if (!auth.authorized) return auth.response
  const { id: leadId, automationId } = await params
  const admin = createAdminClient()
  const automation = await loadAutomation(admin, leadId, automationId)
  if (!automation)
    return NextResponse.json({ error: "Automatismo não encontrado" }, { status: 404 })
  const { data: runs } = await admin
    .from("contact_automation_runs")
    .select("*")
    .eq("contact_automation_id", automationId)
    .order("scheduled_for", { ascending: false })
  const { __lead_birthday, ...rest } = automation
  return NextResponse.json({ ...rest, runs: runs ?? [] })
}

export async function PATCH(request: Request, { params }: Ctx) {
  const auth = await requirePermission("leads")
  if (!auth.authorized) return auth.response
  const { id: leadId, automationId } = await params
  const admin = createAdminClient()
  const automation = await loadAutomation(admin, leadId, automationId)
  if (!automation)
    return NextResponse.json({ error: "Automatismo não encontrado" }, { status: 404 })
  if (automation.status !== "scheduled") {
    return NextResponse.json(
      { error: "Automatismo já executado — não pode ser editado" },
      { status: 409 },
    )
  }

  const body = await request.json()
  const parsed = patchContactAutomationSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Dados inválidos", details: parsed.error.flatten() },
      { status: 400 },
    )
  }
  const input = parsed.data as any
  const update: Record<string, unknown> = { ...input }

  // Explicit trigger_at wins over auto-computed (lets user pick a specific moment)
  if (input.trigger_at) {
    update.trigger_at = input.trigger_at
  } else {
    const timingChanged =
      input.send_hour !== undefined ||
      input.timezone !== undefined ||
      input.event_config !== undefined
    if (timingChanged) {
      const sendHour = input.send_hour ?? automation.send_hour
      const timezone = input.timezone ?? automation.timezone
      const eventConfig = input.event_config ?? automation.event_config ?? {}
      try {
        const triggerAt = computeNextTriggerAt({
          eventType: automation.event_type,
          eventConfig,
          sendHour,
          timezone,
          contactBirthday: automation.__lead_birthday,
          dealClosingDate: automation.negocios?.expected_close_date ?? null,
        })
        update.trigger_at = triggerAt.toISOString()
        update.event_config = eventConfig
      } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 400 })
      }
    }
  }

  const { data, error } = await admin
    .from("contact_automations")
    .update(update)
    .eq("id", automationId)
    .select("*")
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(_request: Request, { params }: Ctx) {
  const auth = await requirePermission("leads")
  if (!auth.authorized) return auth.response
  const { id: leadId, automationId } = await params
  const admin = createAdminClient()
  const { data, error } = await admin
    .from("contact_automations")
    .update({ status: "cancelled" })
    .eq("id", automationId)
    .eq("contact_id", leadId)
    .eq("status", "scheduled")
    .select("id")
    .maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) {
    return NextResponse.json(
      { error: "Automatismo não encontrado ou já executado/cancelado" },
      { status: 404 },
    )
  }
  return NextResponse.json({ id: data.id, cancelled: true })
}
