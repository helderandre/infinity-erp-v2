// ============================================================
// Scheduler Spawner — converte contact_automations em auto_runs
//
// Invocado por Vercel Cron a cada minuto. Lê contact_automations
// com status='scheduled' e trigger_at <= now()+5min, resolve
// variáveis, cria auto_run (flow sentinela) + auto_step_runs
// inline com node_data_snapshot. Reagenda (yearly) ou marca
// completed (once). Regista cada tick em auto_scheduler_log.
// ============================================================

// @ts-nocheck
import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { resolveContactVariables } from "@/lib/automacao/resolve-contact-variables"
import { addOneYear } from "@/lib/automacao/compute-next-trigger"
import { CONTACT_AUTOMATIONS_SENTINEL_FLOW_ID } from "@/types/contact-automation"

const SCHEDULER_SECRET = process.env.CRON_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY
const BATCH_SIZE = 50
const WINDOW_MINUTES = 5

function authOk(request: Request) {
  if (!SCHEDULER_SECRET) return false
  const header = request.headers.get("authorization")
  return header === `Bearer ${SCHEDULER_SECRET}`
}

async function reconcilePendingRuns(supabase: any) {
  // Actualiza contact_automation_runs pendentes cujo auto_run já terminou
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
      // Verifica se pelo menos um step teve delivery sent
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

async function processTick() {
  const started = Date.now()
  const supabase = createAdminClient()
  let evaluated = 0
  let spawned = 0
  let skipped = 0
  const errors: string[] = []

  // 1. Reconcilia runs pendentes cujo auto_run terminou no tick anterior
  try {
    await reconcilePendingRuns(supabase)
  } catch (err: any) {
    errors.push(`reconcile: ${err?.message}`)
    console.error("[SCHEDULER] reconcile error:", err)
  }

  const now = new Date()
  const windowEnd = new Date(now.getTime() + WINDOW_MINUTES * 60_000)

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

      // Resolve variáveis (contact + deal)
      let variables: Record<string, string>
      try {
        variables = await resolveContactVariables(supabase as any, {
          contactId: a.contact_id,
          dealId: a.deal_id ?? undefined,
          timezone: a.timezone,
          now,
        })
      } catch (err: any) {
        await recordRun(supabase, a.id, scheduledFor, "failed", null, err?.message || "erro")
        await advanceAfterRun(supabase, a, now)
        errors.push(`automation ${a.id}: ${err?.message}`)
        continue
      }

      // Determina quais canais têm remetente/dados
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
        await recordRun(
          supabase,
          a.id,
          scheduledFor,
          "skipped",
          null,
          null,
          skipReasons.join(","),
        )
        await advanceAfterRun(supabase, a, now)
        skipped++
        continue
      }

      // Cria auto_run com flow sentinela
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

      // Insere steps inline (um por canal)
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

      // Regista run pendente (worker completará sent_at após envio)
      await recordRun(supabase, a.id, scheduledFor, "pending", run.id, null)
      await advanceAfterRun(supabase, a, now)
      spawned++
    } catch (err: any) {
      errors.push(`automation ${a.id}: ${err?.message}`)
      console.error(`[SCHEDULER] automation ${a.id} falhou:`, err)
    }
  }

  const duration = Date.now() - started
  await supabase.from("auto_scheduler_log").insert({
    tick_at: now.toISOString(),
    evaluated_count: evaluated,
    spawned_count: spawned,
    skipped_count: skipped,
    error_count: errors.length,
    error_detail: errors.length ? errors.slice(0, 5).join(" | ") : null,
    duration_ms: duration,
  })

  return { evaluated, spawned, skipped, errors: errors.length, duration_ms: duration }
}

async function recordRun(
  supabase: any,
  automationId: string,
  scheduledFor: string,
  status: "pending" | "sent" | "failed" | "skipped",
  autoRunId: string | null,
  errorText: string | null = null,
  skipReason: string | null = null,
) {
  const { error } = await supabase.from("contact_automation_runs").insert({
    contact_automation_id: automationId,
    auto_run_id: autoRunId,
    scheduled_for: scheduledFor,
    sent_at: status === "sent" ? new Date().toISOString() : null,
    status,
    skip_reason: skipReason,
    error: errorText,
  })
  // Conflito ignora (idempotência)
  if (error && !String(error.message).toLowerCase().includes("duplicate")) {
    console.error(`[SCHEDULER] recordRun error:`, error)
  }
}

async function advanceAfterRun(supabase: any, a: any, _now: Date) {
  if (a.recurrence === "yearly") {
    // Evento repete na mesma data civil. addOneYear respeita mês/dia/timezone.
    const next = addOneYear(new Date(a.trigger_at), a.timezone, a.send_hour)
    await supabase
      .from("contact_automations")
      .update({ trigger_at: next.toISOString() })
      .eq("id", a.id)
  } else {
    await supabase.from("contact_automations").update({ status: "completed" }).eq("id", a.id)
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
    console.log(`[SCHEDULER] evaluated=${result.evaluated} spawned=${result.spawned} skipped=${result.skipped} errors=${result.errors}`)
    return NextResponse.json(result)
  } catch (err: any) {
    console.error("[SCHEDULER] fatal:", err)
    const supabase = createAdminClient()
    await supabase.from("auto_scheduler_log").insert({
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

// Permite GET para health check (sem executar tick)
export async function GET() {
  return NextResponse.json({ ok: true, endpoint: "scheduler/spawn-runs" })
}
