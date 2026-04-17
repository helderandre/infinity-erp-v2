import { createAdminClient } from "@/lib/supabase/admin"
import { NextResponse } from "next/server"
import { requirePermission } from "@/lib/auth/permissions"
import { spawnRetry } from "@/lib/automacao/spawn-retry"

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function isBroker(roles: string[]) {
  return roles.some((r) => ["admin", "Broker/CEO"].includes(r))
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requirePermission("leads")
  if (!auth.authorized) return auth.response

  const { id } = await params
  if (!UUID_REGEX.test(id)) {
    return NextResponse.json({ error: "id inválido" }, { status: 400 })
  }

  const supabase = createAdminClient()

  // Permission scope: consultant only if lead belongs to them
  const { data: run } = await (supabase as unknown as {
    from: (t: string) => {
      select: (cols: string) => {
        eq: (k: string, v: string) => { maybeSingle: () => Promise<{ data: unknown }> }
      }
    }
  })
    .from("contact_automation_runs")
    .select("id, lead_id, status")
    .eq("id", id)
    .maybeSingle()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const r = run as any
  if (!r) return NextResponse.json({ error: "Run não encontrado" }, { status: 404 })
  if (r.status !== "failed") {
    return NextResponse.json({ error: "Run não está em failed", code: "invalid_status" }, { status: 409 })
  }

  if (!isBroker(auth.roles)) {
    if (!r.lead_id) {
      return NextResponse.json({ error: "Sem acesso a este run" }, { status: 403 })
    }
    const { data: lead } = await (supabase as unknown as {
      from: (t: string) => {
        select: (cols: string) => {
          eq: (k: string, v: string) => { maybeSingle: () => Promise<{ data: unknown }> }
        }
      }
    })
      .from("leads")
      .select("agent_id")
      .eq("id", r.lead_id)
      .maybeSingle()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (!lead || (lead as any).agent_id !== auth.user.id) {
      return NextResponse.json({ error: "Sem acesso a este run" }, { status: 403 })
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = await spawnRetry(supabase as any, { originalRunId: id, triggerAt: new Date() })
  if (result.status === "ok") {
    return NextResponse.json({ new_run_id: result.newRunId }, { status: 201 })
  }
  if (result.status === "invalid_status") {
    return NextResponse.json({ error: "Run não está em failed", code: "invalid_status" }, { status: 409 })
  }
  if (result.status === "no_channels") {
    return NextResponse.json({ error: "Sem canais disponíveis", code: "no_channels" }, { status: 400 })
  }
  return NextResponse.json({ error: result.error ?? "Erro ao retry" }, { status: 500 })
}
