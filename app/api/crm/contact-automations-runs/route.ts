import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { NextResponse } from "next/server"
import { requirePermission } from "@/lib/auth/permissions"

function canSeeAll(roles: string[]) {
  return roles.some((r) => ["admin", "Broker/CEO"].includes(r)) || roles.length > 1
}

const VALID_STATUS = ["pending", "sent", "failed", "skipped"] as const
type RunStatus = (typeof VALID_STATUS)[number]

interface LeadRef {
  id: string
  nome: string | null
  full_name: string | null
  agent_id: string | null
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = any

export async function GET(request: Request) {
  const auth = await requirePermission("leads")
  if (!auth.authorized) return auth.response

  const serverClient = await createClient()
  void serverClient
  const supabase = createAdminClient()
  const { searchParams } = new URL(request.url)

  const status = searchParams.get("status") as RunStatus | "all" | null
  const limit = Math.min(Number(searchParams.get("limit") ?? "200"), 500)
  const daysBack = Math.min(Number(searchParams.get("days") ?? "30"), 180)

  const since = new Date(Date.now() - daysBack * 24 * 3600_000).toISOString()

  // Select também o contact_automation (+ o seu lead) para resolver runs manuais legados
  // que têm lead_id/event_type NULL mas apontam para contact_automations.
  let query = (supabase as AnyRow)
    .from("contact_automation_runs")
    .select(
      `id, kind, contact_automation_id, lead_id, event_type, scheduled_for, sent_at, status, error, skip_reason, created_at,
       leads:leads(id, nome, full_name, agent_id),
       contact_automation:contact_automations(
         id, event_type,
         contact:leads!contact_automations_contact_id_fkey(id, nome, full_name, agent_id)
       )`,
    )
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(limit)

  if (status && status !== "all" && (VALID_STATUS as readonly string[]).includes(status)) {
    query = query.eq("status", status)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Resolver lead real (direct ou via contact_automation) + permissão in-memory
  const userId = auth.user.id
  const broker = canSeeAll(auth.roles)

  const rows = ((data as AnyRow[]) ?? [])
    .map((r: AnyRow) => {
      const directLead = (r.leads ?? null) as LeadRef | null
      const viaAutomation = (r.contact_automation?.contact ?? null) as LeadRef | null
      const resolvedLead = directLead ?? viaAutomation
      const resolvedEventType = r.event_type ?? r.contact_automation?.event_type ?? null

      return {
        id: r.id,
        kind: r.kind,
        status: r.status,
        scheduled_for: r.scheduled_for,
        sent_at: r.sent_at,
        error: r.error,
        skip_reason: r.skip_reason,
        created_at: r.created_at,
        lead_id: resolvedLead?.id ?? r.lead_id ?? null,
        event_type: resolvedEventType,
        leads: resolvedLead,
      }
    })
    .filter((r) => {
      if (broker) return true
      // consultor vê apenas runs cujo lead lhe pertence
      return r.leads?.agent_id === userId
    })

  return NextResponse.json({ rows })
}
