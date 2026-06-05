// @ts-nocheck
import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { requirePermission } from "@/lib/auth/permissions"
import { resolveContactVariables } from "@/lib/automacao/resolve-contact-variables"
import { CONTACT_AUTOMATIONS_SENTINEL_FLOW_ID } from "@/types/contact-automation"

type Ctx = { params: Promise<{ id: string; automationId: string }> }

export async function POST(request: Request, { params }: Ctx) {
  const auth = await requirePermission("leads")
  if (!auth.authorized) return auth.response

  const { id: leadId, automationId } = await params
  const admin = createAdminClient()

  const { data: a, error } = await admin
    .from("contact_automations")
    .select(
      "id, contact_id, deal_id, event_type, event_config, channels, email_template_id, wpp_template_id, smtp_account_id, wpp_instance_id, template_overrides, timezone",
    )
    .eq("id", automationId)
    .eq("contact_id", leadId)
    .maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!a) return NextResponse.json({ error: "Automatismo não encontrado" }, { status: 404 })

  const now = new Date()

  let variables: Record<string, string>
  try {
    variables = await resolveContactVariables(admin as any, {
      contactId: a.contact_id,
      dealId: a.deal_id ?? undefined,
      timezone: a.timezone,
      now,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Erro ao resolver variáveis" }, { status: 400 })
  }

  const activeChannels: string[] = []
  const missing: string[] = []
  if (a.channels.includes("email")) {
    if (!variables.contact_email) missing.push("email do contacto")
    else if (!a.email_template_id && !a.template_overrides?.email?.body_html)
      missing.push("template de email")
    else if (!a.smtp_account_id) missing.push("conta SMTP")
    else activeChannels.push("email")
  }
  if (a.channels.includes("whatsapp")) {
    if (!variables.contact_phone) missing.push("telefone do contacto")
    else if (!a.wpp_template_id && !a.template_overrides?.whatsapp?.messages?.length)
      missing.push("template de WhatsApp")
    else if (!a.wpp_instance_id) missing.push("instância WhatsApp")
    else activeChannels.push("whatsapp")
  }

  if (activeChannels.length === 0) {
    return NextResponse.json(
      { error: `Não é possível testar: faltam ${missing.join(", ")}` },
      { status: 400 },
    )
  }

  const { data: run, error: runErr } = await admin
    .from("auto_runs")
    .insert({
      flow_id: CONTACT_AUTOMATIONS_SENTINEL_FLOW_ID,
      trigger_id: null,
      triggered_by: "manual",
      status: "running",
      context: { variables, test: true },
      entity_type: "contact_automation",
      entity_id: a.id,
      started_at: now.toISOString(),
      is_test: true,
    })
    .select("id")
    .single()
  if (runErr || !run) {
    return NextResponse.json(
      { error: `Erro a criar run: ${runErr?.message ?? "desconhecido"}` },
      { status: 500 },
    )
  }

  const steps: any[] = []
  if (activeChannels.includes("email")) {
    steps.push({
      run_id: run.id,
      flow_id: CONTACT_AUTOMATIONS_SENTINEL_FLOW_ID,
      node_id: "inline-email",
      node_type: "email",
      node_label: "Email (teste manual)",
      status: "pending",
      scheduled_for: now.toISOString(),
      priority: 1,
      input_data: { variables },
      node_data_snapshot: {
        type: "email",
        emailTemplateId: a.email_template_id,
        recipientVariable: "contact_email",
        smtpAccountId: a.smtp_account_id,
        overrideSubject: a.template_overrides?.email?.subject,
        overrideBodyHtml: a.template_overrides?.email?.body_html,
      },
    })
  }
  if (activeChannels.includes("whatsapp")) {
    steps.push({
      run_id: run.id,
      flow_id: CONTACT_AUTOMATIONS_SENTINEL_FLOW_ID,
      node_id: "inline-whatsapp",
      node_type: "whatsapp",
      node_label: "WhatsApp (teste manual)",
      status: "pending",
      scheduled_for: now.toISOString(),
      priority: 1,
      input_data: { variables },
      node_data_snapshot: {
        type: "whatsapp",
        templateId: a.wpp_template_id,
        messages: a.template_overrides?.whatsapp?.messages,
        recipientVariable: "contact_phone",
        wppInstanceId: a.wpp_instance_id,
      },
    })
  }

  const { error: stepsErr } = await admin.from("auto_step_runs").insert(steps)
  if (stepsErr) {
    return NextResponse.json(
      { error: `Erro a criar steps: ${stepsErr.message}` },
      { status: 500 },
    )
  }

  // Dispara o worker imediatamente para não esperar pelo próximo tick do cron.
  const origin = new URL(request.url).origin
  const workerSecret = process.env.CRON_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY
  let workerResult: any = null
  try {
    const workerRes = await fetch(`${origin}/api/automacao/worker`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${workerSecret}`,
      },
      body: JSON.stringify({ source: "manual-test" }),
    })
    workerResult = await workerRes.json().catch(() => null)
  } catch (err: any) {
    console.error("[test-automation] worker dispatch failed", err)
  }

  return NextResponse.json({
    run_id: run.id,
    channels: activeChannels,
    worker: workerResult,
  })
}
