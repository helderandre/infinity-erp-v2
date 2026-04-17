// ============================================================
// Scheduler Spawner — duas fases:
//   (A) manual: contact_automations → auto_runs
//   (B) virtual: leads × {aniversario_contacto, natal, ano_novo}
//       MINUS mutes JOIN contact_automation_lead_settings
//
// Invocado por Coolify Scheduled Task a cada minuto. Fase A
// preserva o comportamento actual; fase B resolve templates via
// cascata (lead → consultor → global) e faz gating por canal.
// Feature flag: AUTOMACAO_VIRTUAL_SPAWNER_ENABLED (default 'true').
// ============================================================

// @ts-nocheck
import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { resolveContactVariables } from "@/lib/automacao/resolve-contact-variables"
import { addOneYear } from "@/lib/automacao/compute-next-trigger"
import { computeNextFixedOccurrence, type FixedEventType } from "@/lib/automacao/next-fixed-occurrence"
import { resolveTemplateForLead } from "@/lib/automacao/resolve-template-for-lead"
import {
  resolveSmtpAccountForLead,
  resolveWppInstanceForLead,
} from "@/lib/automacao/resolve-account-for-lead"
import { isMuted } from "@/lib/automacao/is-muted"
import { CONTACT_AUTOMATIONS_SENTINEL_FLOW_ID } from "@/types/contact-automation"

const SCHEDULER_SECRET = process.env.CRON_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY
const BATCH_SIZE = 50
const VIRTUAL_BATCH_SIZE = 200
const WINDOW_MINUTES = 5

const FIXED_EVENTS: FixedEventType[] = ["aniversario_contacto", "natal", "ano_novo"]

function authOk(request: Request) {
  if (!SCHEDULER_SECRET) return false
  const header = request.headers.get("authorization")
  return header === `Bearer ${SCHEDULER_SECRET}`
}

async function reconcilePendingRuns(supabase: any) {
  const { data: rows } = await supabase
    .from("contact_automation_runs")
    .select("id, auto_run_id, auto_runs!inner(status, completed_at, error_message)")
    .eq("status", "pending")
    .not("auto_run_id", "is", null)
    .in("auto_runs.status", ["completed", "failed"])
    .limit(100)

  for (const r of rows ?? []) {
    const runStatus = r.auto_runs?.status as string | undefined
    if (runStatus === "completed") {
      const { data: deliveries } = await supabase
        .from("auto_delivery_log")
        .select("id, status")
        .eq("run_id", r.auto_run_id)
      const hasSent = (deliveries ?? []).some((d: any) => d.status === "sent")
      const ids = (deliveries ?? []).map((d: any) => d.id)
      await supabase
        .from("contact_automation_runs")
        .update({
          status: hasSent ? "sent" : "failed",
          sent_at: hasSent ? r.auto_runs?.completed_at : null,
          error: hasSent ? null : "Sem entregas bem-sucedidas",
          delivery_log_ids: ids,
        })
        .eq("id", r.id)
    } else if (runStatus === "failed") {
      await supabase
        .from("contact_automation_runs")
        .update({ status: "failed", error: r.auto_runs?.error_message ?? "falha" })
        .eq("id", r.id)
    }
  }
}

// ──────────────────────────────────────────
// Fase A — manual (contact_automations)
// ──────────────────────────────────────────
async function runManualPhase(supabase: any, now: Date) {
  const windowEnd = new Date(now.getTime() + WINDOW_MINUTES * 60_000)
  let evaluated = 0
  let spawned = 0
  let skipped = 0
  const errors: string[] = []

  const { data: automations, error: selectErr } = await supabase
    .from("contact_automations")
    .select(
      "id, contact_id, deal_id, event_type, event_config, channels, email_template_id, wpp_template_id, smtp_account_id, wpp_instance_id, template_overrides, recurrence, send_hour, timezone, trigger_at, status",
    )
    .eq("status", "scheduled")
    .lte("trigger_at", windowEnd.toISOString())
    .order("trigger_at", { ascending: true })
    .limit(BATCH_SIZE)

  if (selectErr) throw new Error(`Erro a seleccionar automações: ${selectErr.message}`)
  evaluated = automations?.length ?? 0

  for (const a of automations ?? []) {
    try {
      const scheduledFor = a.trigger_at
      const skipReasons: string[] = []

      let variables: Record<string, string>
      try {
        variables = await resolveContactVariables(supabase as any, {
          contactId: a.contact_id,
          dealId: a.deal_id ?? undefined,
          timezone: a.timezone,
          now,
        })
      } catch (err: any) {
        await recordManualRun(supabase, a.id, scheduledFor, "failed", null, err?.message || "erro")
        await advanceAfterRun(supabase, a, now)
        errors.push(`automation ${a.id}: ${err?.message}`)
        continue
      }

      const activeChannels: string[] = []
      if (a.channels.includes("email")) {
        if (!variables.contact_email) skipReasons.push("missing_email")
        else if (!a.email_template_id && !a.template_overrides?.email?.body_html)
          skipReasons.push("missing_email_template")
        else if (!a.smtp_account_id) skipReasons.push("missing_smtp_account")
        else activeChannels.push("email")
      }
      if (a.channels.includes("whatsapp")) {
        if (!variables.contact_phone) skipReasons.push("missing_phone")
        else if (!a.wpp_template_id && !a.template_overrides?.whatsapp?.messages?.length)
          skipReasons.push("missing_wpp_template")
        else if (!a.wpp_instance_id) skipReasons.push("missing_wpp_instance")
        else activeChannels.push("whatsapp")
      }

      if (activeChannels.length === 0) {
        await recordManualRun(supabase, a.id, scheduledFor, "skipped", null, null, skipReasons.join(","))
        await advanceAfterRun(supabase, a, now)
        skipped++
        continue
      }

      const { data: run, error: runErr } = await supabase
        .from("auto_runs")
        .insert({
          flow_id: CONTACT_AUTOMATIONS_SENTINEL_FLOW_ID,
          trigger_id: null,
          triggered_by: "schedule",
          status: "running",
          context: { variables },
          entity_type: "contact_automation",
          entity_id: a.id,
          started_at: now.toISOString(),
          is_test: false,
        })
        .select("id")
        .single()
      if (runErr || !run) throw new Error(`run insert: ${runErr?.message ?? "unknown"}`)

      const stepsToInsert: any[] = []
      if (activeChannels.includes("email")) {
        stepsToInsert.push({
          run_id: run.id,
          flow_id: CONTACT_AUTOMATIONS_SENTINEL_FLOW_ID,
          node_id: "inline-email",
          node_type: "email",
          node_label: "Email (automatismo por contacto)",
          status: "pending",
          scheduled_for: now.toISOString(),
          priority: 3,
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
        stepsToInsert.push({
          run_id: run.id,
          flow_id: CONTACT_AUTOMATIONS_SENTINEL_FLOW_ID,
          node_id: "inline-whatsapp",
          node_type: "whatsapp",
          node_label: "WhatsApp (automatismo por contacto)",
          status: "pending",
          scheduled_for: now.toISOString(),
          priority: 3,
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

      const { error: stepsErr } = await supabase.from("auto_step_runs").insert(stepsToInsert)
      if (stepsErr) throw new Error(`steps insert: ${stepsErr.message}`)

      await recordManualRun(supabase, a.id, scheduledFor, "pending", run.id, null)
      await advanceAfterRun(supabase, a, now)
      spawned++
    } catch (err: any) {
      errors.push(`automation ${a.id}: ${err?.message}`)
      console.error(`[SCHEDULER] manual automation ${a.id} falhou:`, err)
    }
  }

  return { evaluated, spawned, skipped, errors }
}

async function recordManualRun(
  supabase: any,
  automationId: string,
  scheduledFor: string,
  status: "pending" | "sent" | "failed" | "skipped",
  autoRunId: string | null,
  errorText: string | null = null,
  skipReason: string | null = null,
) {
  const { error } = await supabase.from("contact_automation_runs").insert({
    kind: "manual",
    contact_automation_id: automationId,
    auto_run_id: autoRunId,
    scheduled_for: scheduledFor,
    sent_at: status === "sent" ? new Date().toISOString() : null,
    status,
    skip_reason: skipReason,
    error: errorText,
  })
  if (error && !String(error.message).toLowerCase().includes("duplicate")) {
    console.error(`[SCHEDULER] recordManualRun error:`, error)
  }
}

async function advanceAfterRun(supabase: any, a: any, _now: Date) {
  if (a.recurrence === "yearly") {
    const next = addOneYear(new Date(a.trigger_at), a.timezone, a.send_hour)
    await supabase.from("contact_automations").update({ trigger_at: next.toISOString() }).eq("id", a.id)
  } else {
    await supabase.from("contact_automations").update({ status: "completed" }).eq("id", a.id)
  }
}

// ──────────────────────────────────────────
// Fase B — virtual (fixas implícitas)
// ──────────────────────────────────────────
async function runVirtualPhase(supabase: any, now: Date) {
  const windowEnd = new Date(now.getTime() + WINDOW_MINUTES * 60_000)
  let evaluated = 0
  let spawned = 0
  const skippedBreakdown: Record<string, number> = {
    muted: 0,
    no_channel: 0,
    missing_template: 0,
    already_ran: 0,
    manual_owned: 0,
  }
  const errors: string[] = []

  // Paginação por cursor em id para processar todos os leads elegíveis em batches
  let cursor: string | null = null
  let hasMore = true

  while (hasMore) {
    let query = supabase
      .from("leads")
      .select("id, agent_id, data_nascimento, email, telemovel")
      .not("agent_id", "is", null)
      .or("email.not.is.null,telemovel.not.is.null")
      .order("id", { ascending: true })
      .limit(VIRTUAL_BATCH_SIZE)

    if (cursor) query = query.gt("id", cursor)

    const { data: leads, error: leadsErr } = await query
    if (leadsErr) throw new Error(`virtual leads select: ${leadsErr.message}`)

    if (!leads || leads.length === 0) {
      hasMore = false
      break
    }

    cursor = leads[leads.length - 1].id
    hasMore = leads.length === VIRTUAL_BATCH_SIZE

    for (const lead of leads) {
      for (const eventType of FIXED_EVENTS) {
        if (eventType === "aniversario_contacto" && !lead.data_nascimento) continue
        evaluated++

        try {
          // Override de send_hour (e template/account) via contact_automation_lead_settings
          const { data: settings } = await supabase
            .from("contact_automation_lead_settings")
            .select("send_hour")
            .eq("lead_id", lead.id)
            .eq("event_type", eventType)
            .maybeSingle()

          const nextAt = computeNextFixedOccurrence({
            eventType,
            birthday: lead.data_nascimento,
            sendHour: settings?.send_hour ?? undefined,
            now,
          })
          if (!nextAt || nextAt.getTime() > windowEnd.getTime()) continue

          // Reconciliação D11: se já existe contact_automations manual para este (lead, evento) → skip
          const { data: manualRows } = await supabase
            .from("contact_automations")
            .select("id")
            .eq("contact_id", lead.id)
            .eq("event_type", eventType)
            .in("status", ["scheduled", "completed"])
            .limit(1)
          if ((manualRows ?? []).length > 0) {
            skippedBreakdown.manual_owned++
            continue
          }

          // Gating por canal (mute + template + conta)
          const activeChannels: Array<{
            channel: "email" | "whatsapp"
            templateId: string
            accountId: string
          }> = []
          const channelSkipReasons: string[] = []

          for (const channel of ["email", "whatsapp"] as const) {
            if (channel === "email" && !lead.email) continue
            if (channel === "whatsapp" && !lead.telemovel) continue

            const muted = await isMuted(supabase, {
              leadId: lead.id,
              agentId: lead.agent_id,
              eventType,
              channel,
            })
            if (muted) {
              channelSkipReasons.push(`${channel}:muted`)
              continue
            }

            const tpl = await resolveTemplateForLead(supabase, {
              leadId: lead.id,
              agentId: lead.agent_id,
              eventType,
              channel,
            })
            if (!tpl) {
              channelSkipReasons.push(`${channel}:missing_template`)
              continue
            }

            const acct =
              channel === "email"
                ? await resolveSmtpAccountForLead(supabase, {
                    leadId: lead.id,
                    agentId: lead.agent_id,
                    eventType,
                  })
                : await resolveWppInstanceForLead(supabase, {
                    leadId: lead.id,
                    agentId: lead.agent_id,
                    eventType,
                  })
            if (!acct) {
              channelSkipReasons.push(`${channel}:no_account`)
              continue
            }

            activeChannels.push({ channel, templateId: tpl.templateId, accountId: acct.id })
          }

          if (activeChannels.length === 0) {
            if (channelSkipReasons.some((r) => r.endsWith(":muted"))) skippedBreakdown.muted++
            else if (channelSkipReasons.some((r) => r.endsWith(":missing_template")))
              skippedBreakdown.missing_template++
            else skippedBreakdown.no_channel++
            continue
          }

          // Idempotency: tenta inserir contact_automation_runs 'virtual' primeiro.
          const scheduledForIso = nextAt.toISOString()
          const { data: virtualRun, error: virtualRunErr } = await supabase
            .from("contact_automation_runs")
            .insert({
              kind: "virtual",
              lead_id: lead.id,
              event_type: eventType,
              scheduled_for: scheduledForIso,
              status: "pending",
            })
            .select("id")
            .single()

          if (virtualRunErr) {
            if (String(virtualRunErr.message).toLowerCase().includes("duplicate")) {
              skippedBreakdown.already_ran++
              continue
            }
            throw new Error(`virtual run insert: ${virtualRunErr.message}`)
          }

          // Resolve variáveis para o run
          const variables = await resolveContactVariables(supabase as any, {
            contactId: lead.id,
            timezone: "Europe/Lisbon",
            now,
          })

          // Cria auto_run + auto_step_runs (um por canal activo)
          const { data: run, error: runErr } = await supabase
            .from("auto_runs")
            .insert({
              flow_id: CONTACT_AUTOMATIONS_SENTINEL_FLOW_ID,
              trigger_id: null,
              triggered_by: "schedule",
              status: "running",
              context: { variables, virtual: true, event_type: eventType, lead_id: lead.id },
              entity_type: "contact_automation_virtual",
              entity_id: virtualRun.id,
              started_at: now.toISOString(),
              is_test: false,
            })
            .select("id")
            .single()
          if (runErr || !run) throw new Error(`virtual auto_run insert: ${runErr?.message ?? "unknown"}`)

          const stepsToInsert: any[] = []
          for (const ch of activeChannels) {
            if (ch.channel === "email") {
              stepsToInsert.push({
                run_id: run.id,
                flow_id: CONTACT_AUTOMATIONS_SENTINEL_FLOW_ID,
                node_id: "inline-virtual-email",
                node_type: "email",
                node_label: `Email fixo (${eventType})`,
                status: "pending",
                scheduled_for: now.toISOString(),
                priority: 3,
                input_data: { variables },
                node_data_snapshot: {
                  type: "email",
                  emailTemplateId: ch.templateId,
                  recipientVariable: "contact_email",
                  smtpAccountId: ch.accountId,
                },
              })
            } else {
              stepsToInsert.push({
                run_id: run.id,
                flow_id: CONTACT_AUTOMATIONS_SENTINEL_FLOW_ID,
                node_id: "inline-virtual-whatsapp",
                node_type: "whatsapp",
                node_label: `WhatsApp fixo (${eventType})`,
                status: "pending",
                scheduled_for: now.toISOString(),
                priority: 3,
                input_data: { variables },
                node_data_snapshot: {
                  type: "whatsapp",
                  templateId: ch.templateId,
                  recipientVariable: "contact_phone",
                  wppInstanceId: ch.accountId,
                },
              })
            }
          }

          const { error: stepsErr } = await supabase.from("auto_step_runs").insert(stepsToInsert)
          if (stepsErr) throw new Error(`virtual steps insert: ${stepsErr.message}`)

          // Liga virtualRun → auto_run
          await supabase
            .from("contact_automation_runs")
            .update({ auto_run_id: run.id })
            .eq("id", virtualRun.id)

          spawned++
        } catch (err: any) {
          errors.push(`lead ${lead.id}/${eventType}: ${err?.message}`)
          console.error(`[SCHEDULER] virtual (${lead.id}/${eventType}) falhou:`, err)
        }
      }
    }
  }

  const skippedTotal = Object.values(skippedBreakdown).reduce((a, b) => a + b, 0)
  return { evaluated, spawned, skipped: skippedTotal, errors, skippedBreakdown }
}

async function processTick() {
  const started = Date.now()
  const supabase = createAdminClient()
  const now = new Date()

  try {
    await reconcilePendingRuns(supabase)
  } catch (err: any) {
    console.error("[SCHEDULER] reconcile error:", err)
  }

  // Fase A — manual
  const manual = await runManualPhase(supabase, now)
  await supabase.from("auto_scheduler_log").insert({
    tick_at: now.toISOString(),
    phase: "manual",
    evaluated_count: manual.evaluated,
    spawned_count: manual.spawned,
    skipped_count: manual.skipped,
    error_count: manual.errors.length,
    error_detail: manual.errors.length ? manual.errors.slice(0, 5).join(" | ") : null,
    duration_ms: Date.now() - started,
    skipped_breakdown: {},
  })

  // Fase B — virtual (feature-flagged)
  const virtualEnabled = process.env.AUTOMACAO_VIRTUAL_SPAWNER_ENABLED !== "false"
  let virtual = { evaluated: 0, spawned: 0, skipped: 0, errors: [] as string[], skippedBreakdown: {} }
  if (virtualEnabled) {
    try {
      virtual = await runVirtualPhase(supabase, now)
    } catch (err: any) {
      console.error("[SCHEDULER] virtual phase fatal:", err)
      virtual.errors.push(`phase_b_fatal: ${err?.message}`)
    }
    await supabase.from("auto_scheduler_log").insert({
      tick_at: now.toISOString(),
      phase: "virtual",
      evaluated_count: virtual.evaluated,
      spawned_count: virtual.spawned,
      skipped_count: virtual.skipped,
      error_count: virtual.errors.length,
      error_detail: virtual.errors.length ? virtual.errors.slice(0, 5).join(" | ") : null,
      duration_ms: Date.now() - started,
      skipped_breakdown: virtual.skippedBreakdown,
    })
  }

  return {
    evaluated: manual.evaluated + virtual.evaluated,
    spawned: manual.spawned + virtual.spawned,
    skipped: manual.skipped + virtual.skipped,
    errors: manual.errors.length + virtual.errors.length,
    duration_ms: Date.now() - started,
    virtualEnabled,
  }
}

export async function POST(request: Request) {
  if (process.env.AUTOMACAO_SPAWNER_ENABLED === "false") {
    return NextResponse.json({ disabled: true, evaluated: 0, spawned: 0 })
  }
  if (!authOk(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  console.log(`[SCHEDULER] tick @ ${new Date().toISOString()}`)
  try {
    const result = await processTick()
    console.log(
      `[SCHEDULER] evaluated=${result.evaluated} spawned=${result.spawned} skipped=${result.skipped} errors=${result.errors}`,
    )
    return NextResponse.json(result)
  } catch (err: any) {
    console.error("[SCHEDULER] fatal:", err)
    const supabase = createAdminClient()
    await supabase.from("auto_scheduler_log").insert({
      phase: null,
      evaluated_count: 0,
      spawned_count: 0,
      skipped_count: 0,
      error_count: 1,
      error_detail: String(err?.message || err).slice(0, 1000),
      duration_ms: 0,
    })
    return NextResponse.json({ error: err?.message || "erro" }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({ ok: true, endpoint: "scheduler/spawn-runs" })
}
