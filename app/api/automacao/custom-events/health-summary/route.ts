import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { requireAuth } from "@/lib/auth/permissions"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SA = any

interface FailedUnresolvedItem {
  run_id: string
  lead_id: string
  lead_name: string | null
  error_short: string | null
}

interface HealthSummaryRow {
  event_key: string
  last_run_at: string | null
  last_run_status: "sent" | "failed" | "skipped" | "pending" | null
  runs_last_30d: { sent: number; failed: number; skipped: number; pending: number }
  failed_unresolved: FailedUnresolvedItem[]
  failed_unresolved_count: number
  completed_one_shot: boolean
}

function canSeeAll(roles: string[]) {
  return roles.some((r) => ["admin", "Broker/CEO"].includes(r))
}

export async function GET(request: Request) {
  const auth = await requireAuth()
  if (!auth.authorized) return auth.response

  const { searchParams } = new URL(request.url)
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

  const supabase = createAdminClient() as SA

  const { data: rawRows, error: rpcErr } = await supabase.rpc(
    "get_automation_health_summary",
    { p_consultant_id: targetConsultantId },
  )
  if (rpcErr) {
    return NextResponse.json({ error: rpcErr.message }, { status: 500 })
  }

  const rows: Array<{
    event_key: string
    last_run_at: string | null
    last_run_status: string | null
    sent_30d: number
    failed_30d: number
    skipped_30d: number
    pending_30d: number
    failed_unresolved: FailedUnresolvedItem[]
    failed_unresolved_count: number
  }> = (rawRows ?? []) as SA

  // Cruzar com custom_commemorative_events para calcular completed_one_shot.
  // Eventos fixos são sempre recurring — `completed_one_shot=false` para eles.
  const customEventIds = rows
    .map((r) => {
      if (!r.event_key.startsWith("custom:")) return null
      return r.event_key.slice("custom:".length)
    })
    .filter((id): id is string => !!id)

  const recurringById = new Map<string, boolean>()
  if (customEventIds.length > 0) {
    const { data: customMeta } = await supabase
      .from("custom_commemorative_events")
      .select("id, is_recurring")
      .in("id", customEventIds)
    for (const evt of (customMeta ?? []) as Array<{ id: string; is_recurring: boolean }>) {
      recurringById.set(evt.id, evt.is_recurring)
    }
  }

  const payload: HealthSummaryRow[] = rows.map((r) => {
    let completedOneShot = false
    if (r.event_key.startsWith("custom:")) {
      const id = r.event_key.slice("custom:".length)
      const isRecurring = recurringById.get(id) ?? true
      completedOneShot = !isRecurring && r.sent_30d > 0
    }

    return {
      event_key: r.event_key,
      last_run_at: r.last_run_at,
      last_run_status: (r.last_run_status as HealthSummaryRow["last_run_status"]) ?? null,
      runs_last_30d: {
        sent: Number(r.sent_30d ?? 0),
        failed: Number(r.failed_30d ?? 0),
        skipped: Number(r.skipped_30d ?? 0),
        pending: Number(r.pending_30d ?? 0),
      },
      failed_unresolved: Array.isArray(r.failed_unresolved) ? r.failed_unresolved : [],
      failed_unresolved_count: Number(r.failed_unresolved_count ?? 0),
      completed_one_shot: completedOneShot,
    }
  })

  return NextResponse.json(payload, {
    headers: { "Cache-Control": "private, max-age=30" },
  })
}
