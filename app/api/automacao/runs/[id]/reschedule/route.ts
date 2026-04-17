import { createAdminClient } from "@/lib/supabase/admin"
import { NextResponse } from "next/server"
import { z } from "zod"
import { requirePermission } from "@/lib/auth/permissions"
import { spawnRetry } from "@/lib/automacao/spawn-retry"

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const rescheduleSchema = z.object({
  trigger_at: z.string().datetime(),
})

function isBroker(roles: string[]) {
  return roles.some((r) => ["admin", "Broker/CEO"].includes(r))
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requirePermission("leads")
  if (!auth.authorized) return auth.response

  const { id } = await params
  if (!UUID_REGEX.test(id)) {
    return NextResponse.json({ error: "id inválido" }, { status: 400 })
  }

  const body = await request.json()
  const parsed = rescheduleSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Dados inválidos", details: parsed.error.flatten() },
      { status: 400 },
    )
  }

  const triggerAt = new Date(parsed.data.trigger_at)
  if (triggerAt.getTime() < Date.now()) {
    return NextResponse.json({ error: "trigger_at não pode ser no passado", code: "trigger_in_past" }, { status: 400 })
  }

  const supabase = createAdminClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: runRow } = await (supabase as any)
    .from("contact_automation_runs")
    .select("id, lead_id, status")
    .eq("id", id)
    .maybeSingle()
  if (!runRow) return NextResponse.json({ error: "Run não encontrado" }, { status: 404 })
  if (runRow.status !== "failed") {
    return NextResponse.json({ error: "Run não está em failed", code: "invalid_status" }, { status: 409 })
  }

  if (!isBroker(auth.roles)) {
    if (!runRow.lead_id) {
      return NextResponse.json({ error: "Sem acesso a este run" }, { status: 403 })
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: lead } = await (supabase as any)
      .from("leads")
      .select("agent_id")
      .eq("id", runRow.lead_id)
      .maybeSingle()
    if (!lead || lead.agent_id !== auth.user.id) {
      return NextResponse.json({ error: "Sem acesso a este run" }, { status: 403 })
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = await spawnRetry(supabase as any, { originalRunId: id, triggerAt })
  if (result.status === "ok") {
    return NextResponse.json({ new_run_id: result.newRunId }, { status: 201 })
  }
  if (result.status === "invalid_status") {
    return NextResponse.json({ error: "Run não está em failed", code: "invalid_status" }, { status: 409 })
  }
  if (result.status === "no_channels") {
    return NextResponse.json({ error: "Sem canais disponíveis", code: "no_channels" }, { status: 400 })
  }
  return NextResponse.json({ error: result.error ?? "Erro ao reagendar" }, { status: 500 })
}
