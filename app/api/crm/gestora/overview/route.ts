import { NextRequest, NextResponse } from "next/server"
import { createCrmAdminClient } from "@/lib/supabase/admin-untyped"
import { createClient } from "@/lib/supabase/server"

/**
 * GET /api/crm/gestora/overview
 * Returns agent workload summary and overdue lead entries for the gestora dashboard.
 */
export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const db = createCrmAdminClient()
    const { searchParams } = req.nextUrl
    const agentFilter = searchParams.get("agent_id")
    const sectorFilter = searchParams.get("sector")

    // 1. Agent workload summary
    const { data: agents } = await db
      .from("dev_users")
      .select("id, commercial_name, is_active, active_lead_count")
      .eq("is_active", true)
      .order("commercial_name")

    // For each agent, get more detailed metrics
    const agentMetrics = await Promise.all(
      (agents ?? []).map(async (agent: { id: string; commercial_name: string; active_lead_count: number }) => {
        // Count entries by SLA status
        const { data: slaBreakdown } = await db
          .from("leads_entries")
          .select("sla_status")
          .eq("assigned_agent_id", agent.id)
          .in("status", ["new", "contacted"])

        const slaCounts = { pending: 0, on_time: 0, warning: 0, breached: 0, completed: 0 }
        for (const e of slaBreakdown ?? []) {
          const status = e.sla_status as keyof typeof slaCounts
          if (status in slaCounts) slaCounts[status]++
        }

        // Count total active negocios
        const { count: activeNegocios } = await db
          .from("negocios")
          .select("*", { count: "exact", head: true })
          .eq("assigned_consultant_id", agent.id)
          .not("pipeline_stage_id", "is", null)
          // Exclude terminal stages
          .is("won_date", null)
          .is("lost_date", null)

        return {
          id: agent.id,
          name: agent.commercial_name,
          active_leads: agent.active_lead_count ?? 0,
          sla: slaCounts,
          active_negocios: activeNegocios ?? 0,
        }
      })
    )

    // 2. Overdue entries (SLA breached or warning, not yet contacted)
    let overdueQuery = db
      .from("leads_entries")
      .select(`
        id, contact_id, source, sector, priority, status,
        sla_deadline, sla_status, created_at, assigned_agent_id,
        leads!inner(nome, email, telemovel)
      `)
      .in("sla_status", ["warning", "breached"])
      .is("first_contact_at", null)
      .order("sla_deadline", { ascending: true })
      .limit(100)

    if (agentFilter) {
      overdueQuery = overdueQuery.eq("assigned_agent_id", agentFilter)
    }
    if (sectorFilter) {
      overdueQuery = overdueQuery.eq("sector", sectorFilter)
    }

    const { data: overdueEntries } = await overdueQuery

    // 3. Unassigned entries (gestora pool)
    let unassignedQuery = db
      .from("leads_entries")
      .select(`
        id, contact_id, source, sector, priority, status,
        sla_deadline, sla_status, created_at,
        leads!inner(nome, email, telemovel)
      `)
      .is("assigned_agent_id", null)
      .in("status", ["new"])
      .order("created_at", { ascending: false })
      .limit(50)

    if (sectorFilter) {
      unassignedQuery = unassignedQuery.eq("sector", sectorFilter)
    }

    const { data: unassigned } = await unassignedQuery

    // 4. Summary counts
    const { count: totalOverdue } = await db
      .from("leads_entries")
      .select("*", { count: "exact", head: true })
      .in("sla_status", ["warning", "breached"])
      .is("first_contact_at", null)

    const { count: totalUnassigned } = await db
      .from("leads_entries")
      .select("*", { count: "exact", head: true })
      .is("assigned_agent_id", null)
      .eq("status", "new")

    const { count: totalNewToday } = await db
      .from("leads_entries")
      .select("*", { count: "exact", head: true })
      .gte("created_at", new Date(new Date().setHours(0, 0, 0, 0)).toISOString())

    return NextResponse.json({
      agents: agentMetrics,
      overdue_entries: overdueEntries ?? [],
      unassigned_entries: unassigned ?? [],
      summary: {
        total_overdue: totalOverdue ?? 0,
        total_unassigned: totalUnassigned ?? 0,
        total_new_today: totalNewToday ?? 0,
        total_agents: agentMetrics.length,
      },
    })
  } catch (err) {
    console.error("[Gestora Overview]", err)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}
