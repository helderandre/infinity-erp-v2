import { createAdminClient } from "@/lib/supabase/admin"
import { NextResponse } from "next/server"
import { z } from "zod"
import { requirePermission } from "@/lib/auth/permissions"
import { spawnRetry } from "@/lib/automacao/spawn-retry"

const batchSchema = z.object({
  ids: z.array(z.string().uuid()).max(100),
  trigger_at: z.string().datetime(),
})

function isBroker(roles: string[]) {
  return roles.some((r) => ["admin", "Broker/CEO"].includes(r))
}

export async function POST(request: Request) {
  const auth = await requirePermission("leads")
  if (!auth.authorized) return auth.response

  const body = await request.json()
  const parsed = batchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Dados inválidos", code: "batch_too_large", details: parsed.error.flatten() },
      { status: 400 },
    )
  }
  const { ids, trigger_at } = parsed.data
  const triggerAt = new Date(trigger_at)
  if (triggerAt.getTime() < Date.now()) {
    return NextResponse.json({ error: "trigger_at no passado", code: "trigger_in_past" }, { status: 400 })
  }
  if (ids.length === 0) return NextResponse.json({ results: [] })

  const supabase = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: runs } = await (supabase as any)
    .from("contact_automation_runs")
    .select("id, lead_id, status, leads:leads(agent_id)")
    .in("id", ids)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const runsById = new Map<string, any>((runs ?? []).map((r: any) => [r.id, r]))
  const results: Array<{
    id: string
    status: "ok" | "forbidden" | "invalid_status" | "not_found" | "no_channels" | "error"
    new_run_id?: string
    error?: string
  }> = []

  for (const id of ids) {
    const row = runsById.get(id)
    if (!row) {
      results.push({ id, status: "not_found" })
      continue
    }
    if (row.status !== "failed") {
      results.push({ id, status: "invalid_status" })
      continue
    }
    if (!isBroker(auth.roles)) {
      const ownerId = row.leads?.agent_id
      if (!ownerId || ownerId !== auth.user.id) {
        results.push({ id, status: "forbidden" })
        continue
      }
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r = await spawnRetry(supabase as any, { originalRunId: id, triggerAt })
    if (r.status === "ok") results.push({ id, status: "ok", new_run_id: r.newRunId })
    else if (r.status === "invalid_status") results.push({ id, status: "invalid_status" })
    else if (r.status === "no_channels") results.push({ id, status: "no_channels" })
    else results.push({ id, status: "error", error: r.error })
  }

  return NextResponse.json({ results })
}
