import type { SupabaseClient } from "@supabase/supabase-js"
import { resolveContactVariables } from "@/lib/automacao/resolve-contact-variables"
import { resolveTemplateForLead } from "@/lib/automacao/resolve-template-for-lead"
import {
  resolveSmtpAccountForLead,
  resolveWppInstanceForLead,
} from "@/lib/automacao/resolve-account-for-lead"
import { CONTACT_AUTOMATIONS_SENTINEL_FLOW_ID } from "@/types/contact-automation"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabase = SupabaseClient<any, any, any>

export interface SpawnRetryArgs {
  originalRunId: string
  triggerAt: Date
}

export interface SpawnRetryResult {
  status: "ok" | "invalid_status" | "forbidden" | "no_channels" | "error"
  newRunId?: string
  error?: string
}

/**
 * Given a failed contact_automation_runs id, re-resolve template/account/variables
 * and spawn a new auto_run + auto_step_runs + contact_automation_runs row (parent_run_id linked).
 *
 * Caller is responsible for permission checks before invoking this helper.
 */
export async function spawnRetry(
  supabase: AnySupabase,
  { originalRunId, triggerAt }: SpawnRetryArgs,
): Promise<SpawnRetryResult> {
  const { data: original, error: origErr } = await supabase
    .from("contact_automation_runs")
    .select(
      "id, kind, contact_automation_id, custom_event_id, lead_id, event_type, status, scheduled_for",
    )
    .eq("id", originalRunId)
    .maybeSingle()
  if (origErr) return { status: "error", error: origErr.message }
  if (!original) return { status: "error", error: "Run original não encontrado" }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const o = original as any

  if (o.status !== "failed") return { status: "invalid_status" }

  // Determine lead + event + dealId for variable resolution
  let leadId: string | null = o.lead_id ?? null
  let eventType: string | null = o.event_type ?? null
  let agentId: string | null = null
  let dealId: string | null = null
  let channels: Array<"email" | "whatsapp"> = []
  let manualRow: {
    smtp_account_id?: string | null
    wpp_instance_id?: string | null
    email_template_id?: string | null
    wpp_template_id?: string | null
    template_overrides?: { email?: { subject?: string; body_html?: string }; whatsapp?: { messages?: unknown[] } }
    channels?: string[]
  } | null = null

  if (o.kind === "manual" && o.contact_automation_id) {
    const { data: a } = await supabase
      .from("contact_automations")
      .select(
        "id, contact_id, deal_id, event_type, channels, email_template_id, wpp_template_id, smtp_account_id, wpp_instance_id, template_overrides",
      )
      .eq("id", o.contact_automation_id)
      .maybeSingle()
    if (!a) return { status: "error", error: "Automação manual associada não encontrada" }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ma = a as any
    leadId = ma.contact_id
    eventType = ma.event_type
    dealId = ma.deal_id ?? null
    channels = (ma.channels ?? []) as Array<"email" | "whatsapp">
    manualRow = ma
  } else if (o.kind === "virtual") {
    if (!leadId || !eventType) return { status: "error", error: "Run virtual sem lead/event_type" }
  } else if (o.kind === "custom_event") {
    // Custom commemorative event — resolve template/account from the event record
    const { data: customEvt } = await supabase
      .from("custom_commemorative_events")
      .select("id, channels, email_template_id, wpp_template_id, smtp_account_id, wpp_instance_id, name")
      .eq("id", o.custom_event_id)
      .maybeSingle()
    if (!customEvt) return { status: "error", error: "Evento personalizado não encontrado" }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ce = customEvt as any
    channels = (ce.channels ?? []) as Array<"email" | "whatsapp">
    eventType = eventType ?? ce.name
    manualRow = {
      smtp_account_id: ce.smtp_account_id,
      wpp_instance_id: ce.wpp_instance_id,
      email_template_id: ce.email_template_id,
      wpp_template_id: ce.wpp_template_id,
      channels: ce.channels,
    }
    if (!leadId) return { status: "error", error: "Run custom_event sem lead_id" }
  } else {
    return { status: "error", error: `kind desconhecido: ${o.kind}` }
  }

  // Load lead for agent_id
  if (!leadId) return { status: "error", error: "lead_id em falta" }
  const { data: lead } = await supabase
    .from("leads")
    .select("id, agent_id, email, telemovel")
    .eq("id", leadId)
    .maybeSingle()
  if (!lead) return { status: "error", error: "Lead não encontrado" }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const l = lead as any
  agentId = l.agent_id

  // Decide channels (manual: reuse configured; virtual: both potential channels)
  const channelCandidates: Array<"email" | "whatsapp"> =
    o.kind === "manual" ? channels : (["email", "whatsapp"] as const).slice()

  // Resolve variables
  const variables = await resolveContactVariables(supabase, {
    contactId: leadId,
    dealId,
    timezone: "Europe/Lisbon",
    now: triggerAt,
  })

  const activeSteps: Array<{
    channel: "email" | "whatsapp"
    templateId: string | null
    accountId: string | null
    overrideSubject?: string
    overrideBodyHtml?: string
    messages?: unknown[]
  }> = []

  for (const channel of channelCandidates) {
    if (channel === "email" && !l.email) continue
    if (channel === "whatsapp" && !l.telemovel) continue

    if ((o.kind === "manual" || o.kind === "custom_event") && manualRow) {
      const hasOverride =
        channel === "email"
          ? Boolean(manualRow.template_overrides?.email?.body_html)
          : Boolean(manualRow.template_overrides?.whatsapp?.messages?.length)
      const templateId =
        channel === "email" ? manualRow.email_template_id : manualRow.wpp_template_id
      if (!templateId && !hasOverride) continue
      const accountId =
        channel === "email" ? manualRow.smtp_account_id : manualRow.wpp_instance_id
      if (!accountId) continue
      activeSteps.push({
        channel,
        templateId: templateId ?? null,
        accountId: accountId ?? null,
        overrideSubject:
          channel === "email" ? manualRow.template_overrides?.email?.subject : undefined,
        overrideBodyHtml:
          channel === "email" ? manualRow.template_overrides?.email?.body_html : undefined,
        messages:
          channel === "whatsapp" ? manualRow.template_overrides?.whatsapp?.messages : undefined,
      })
    } else {
      // virtual — cascade
      const tpl = await resolveTemplateForLead(supabase, {
        leadId,
        agentId,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        eventType: eventType as any,
        channel,
      })
      if (!tpl) continue
      const acct =
        channel === "email"
          ? await resolveSmtpAccountForLead(supabase, { leadId, agentId, eventType: eventType! })
          : await resolveWppInstanceForLead(supabase, { leadId, agentId, eventType: eventType! })
      if (!acct) continue
      activeSteps.push({ channel, templateId: tpl.templateId, accountId: acct.id })
    }
  }

  if (activeSteps.length === 0) return { status: "no_channels" }

  const triggerAtIso = triggerAt.toISOString()

  // Insert auto_run
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: run, error: runErr } = await (supabase as any)
    .from("auto_runs")
    .insert({
      flow_id: CONTACT_AUTOMATIONS_SENTINEL_FLOW_ID,
      trigger_id: null,
      triggered_by: "retry",
      status: "running",
      context: { variables, retry_of: originalRunId },
      entity_type: o.kind === "virtual" ? "contact_automation_virtual" : "contact_automation",
      entity_id: o.contact_automation_id ?? null,
      started_at: triggerAtIso,
      is_test: false,
    })
    .select("id")
    .single()
  if (runErr || !run) return { status: "error", error: runErr?.message ?? "auto_run insert" }

  const stepsToInsert = activeSteps.map((s) =>
    s.channel === "email"
      ? {
          run_id: run.id,
          flow_id: CONTACT_AUTOMATIONS_SENTINEL_FLOW_ID,
          node_id: "inline-retry-email",
          node_type: "email",
          node_label: `Email (retry ${o.kind})`,
          status: "pending",
          scheduled_for: triggerAtIso,
          priority: 3,
          input_data: { variables },
          node_data_snapshot: {
            type: "email",
            emailTemplateId: s.templateId,
            recipientVariable: "contact_email",
            smtpAccountId: s.accountId,
            overrideSubject: s.overrideSubject,
            overrideBodyHtml: s.overrideBodyHtml,
          },
        }
      : {
          run_id: run.id,
          flow_id: CONTACT_AUTOMATIONS_SENTINEL_FLOW_ID,
          node_id: "inline-retry-whatsapp",
          node_type: "whatsapp",
          node_label: `WhatsApp (retry ${o.kind})`,
          status: "pending",
          scheduled_for: triggerAtIso,
          priority: 3,
          input_data: { variables },
          node_data_snapshot: {
            type: "whatsapp",
            templateId: s.templateId,
            messages: s.messages,
            recipientVariable: "contact_phone",
            wppInstanceId: s.accountId,
          },
        },
  )

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: stepsErr } = await (supabase as any)
    .from("auto_step_runs")
    .insert(stepsToInsert)
  if (stepsErr) return { status: "error", error: stepsErr.message }

  // Insert new contact_automation_runs linked via parent_run_id
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: newRun, error: carErr } = await (supabase as any)
    .from("contact_automation_runs")
    .insert({
      kind: o.kind,
      contact_automation_id: o.kind === "manual" ? o.contact_automation_id : null,
      custom_event_id: o.kind === "custom_event" ? o.custom_event_id : null,
      lead_id: leadId,
      event_type: eventType,
      auto_run_id: run.id,
      scheduled_for: triggerAtIso,
      status: "pending",
      parent_run_id: o.id,
    })
    .select("id")
    .single()
  if (carErr || !newRun) {
    return { status: "error", error: carErr?.message ?? "contact_automation_runs insert" }
  }

  return { status: "ok", newRunId: newRun.id as string }
}
