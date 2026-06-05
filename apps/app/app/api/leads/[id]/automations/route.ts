// @ts-nocheck
import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { requirePermission } from "@/lib/auth/permissions"
import { createContactAutomationSchema } from "@/lib/validations/contact-automation"
import { computeNextTriggerAt } from "@/lib/automacao/compute-next-trigger"

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission("leads")
  if (!auth.authorized) return auth.response

  const { id: leadId } = await params
  const admin = createAdminClient()

  const { data: lead, error: leadErr } = await admin
    .from("leads")
    .select("id, data_nascimento")
    .eq("id", leadId)
    .maybeSingle()
  if (leadErr) return NextResponse.json({ error: leadErr.message }, { status: 500 })
  if (!lead) return NextResponse.json({ error: "Lead não encontrado" }, { status: 404 })

  const body = await request.json()
  const parsed = createContactAutomationSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Dados inválidos", details: parsed.error.flatten() },
      { status: 400 },
    )
  }
  const input = parsed.data

  // Os 3 eventos fixos passam a ser implícitos (spawner virtual) + overrides.
  if (
    input.event_type === "aniversario_contacto" ||
    input.event_type === "natal" ||
    input.event_type === "ano_novo"
  ) {
    return NextResponse.json(
      {
        error:
          "Este evento é agora implícito — use o hub CRM ou os overrides por-lead em vez de criar manualmente.",
        code: "use_fixed_overrides_instead",
      },
      { status: 400 },
    )
  }

  const contactBirthday: string | null = lead.data_nascimento || null
  let dealClosingDate: string | null = null

  if (input.event_type === "aniversario_contacto" && !contactBirthday) {
    return NextResponse.json(
      { error: "Lead não tem data de nascimento" },
      { status: 400 },
    )
  }
  if (input.event_type === "aniversario_fecho") {
    const { data: deal } = await admin
      .from("negocios")
      .select("id, expected_close_date, lead_id")
      .eq("id", (input as any).deal_id)
      .maybeSingle()
    if (!deal || deal.lead_id !== leadId) {
      return NextResponse.json({ error: "Negócio não pertence a este lead" }, { status: 404 })
    }
    if (!deal.expected_close_date) {
      return NextResponse.json(
        { error: "Negócio sem data de fecho prevista" },
        { status: 400 },
      )
    }
    dealClosingDate = deal.expected_close_date
  }

  if (input.channels.includes("email") && input.smtp_account_id) {
    const { data: smtp } = await admin
      .from("consultant_email_accounts")
      .select("id, is_active, is_verified")
      .eq("id", input.smtp_account_id)
      .maybeSingle()
    if (!smtp || !smtp.is_active || !smtp.is_verified) {
      return NextResponse.json(
        { error: "Conta SMTP não encontrada, inactiva ou não verificada" },
        { status: 400 },
      )
    }
  }
  if (input.channels.includes("whatsapp") && input.wpp_instance_id) {
    const { data: inst } = await admin
      .from("auto_wpp_instances")
      .select("id, connection_status")
      .eq("id", input.wpp_instance_id)
      .maybeSingle()
    if (!inst) {
      return NextResponse.json({ error: "Instância WhatsApp não encontrada" }, { status: 400 })
    }
    if (inst.connection_status !== "connected") {
      return NextResponse.json(
        { error: "Instância WhatsApp não está conectada" },
        { status: 400 },
      )
    }
  }

  let triggerAt: Date
  try {
    triggerAt = computeNextTriggerAt({
      eventType: input.event_type,
      eventConfig: (input as any).event_config ?? {},
      sendHour: input.send_hour,
      timezone: input.timezone,
      contactBirthday,
      dealClosingDate,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 })
  }

  const { data, error } = await admin
    .from("contact_automations")
    .insert({
      contact_id: leadId,
      deal_id: (input as any).deal_id ?? null,
      event_type: input.event_type,
      event_config: (input as any).event_config ?? {},
      channels: input.channels,
      email_template_id: input.email_template_id ?? null,
      wpp_template_id: input.wpp_template_id ?? null,
      smtp_account_id: input.smtp_account_id ?? null,
      wpp_instance_id: input.wpp_instance_id ?? null,
      template_overrides: input.template_overrides ?? {},
      recurrence: input.recurrence,
      send_hour: input.send_hour,
      timezone: input.timezone,
      trigger_at: triggerAt.toISOString(),
      status: "scheduled",
      created_by: auth.user.id,
    })
    .select("*")
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission("leads")
  if (!auth.authorized) return auth.response

  const { id: leadId } = await params
  const admin = createAdminClient()

  const { data: automations, error } = await admin
    .from("contact_automations")
    .select(
      "id, contact_id, deal_id, event_type, event_config, channels, email_template_id, wpp_template_id, smtp_account_id, wpp_instance_id, template_overrides, recurrence, send_hour, timezone, trigger_at, status, created_at, updated_at",
    )
    .eq("contact_id", leadId)
    .order("created_at", { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const ids = (automations ?? []).map((a: any) => a.id)
  const lastRuns: Record<string, any> = {}
  if (ids.length > 0) {
    const { data: runs } = await admin
      .from("contact_automation_runs")
      .select("id, contact_automation_id, scheduled_for, sent_at, status, skip_reason, error")
      .in("contact_automation_id", ids)
      .order("scheduled_for", { ascending: false })
    ;(runs ?? []).forEach((r: any) => {
      if (!lastRuns[r.contact_automation_id]) lastRuns[r.contact_automation_id] = r
    })
  }

  const enriched = (automations ?? []).map((a: any) => ({ ...a, last_run: lastRuns[a.id] ?? null }))
  return NextResponse.json(enriched)
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission("leads")
  if (!auth.authorized) return auth.response

  const { id: leadId } = await params
  const admin = createAdminClient()

  const { data, error } = await admin
    .from("contact_automations")
    .update({ status: "cancelled" })
    .eq("contact_id", leadId)
    .eq("status", "scheduled")
    .select("id")
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ cancelled: data?.length ?? 0 })
}
