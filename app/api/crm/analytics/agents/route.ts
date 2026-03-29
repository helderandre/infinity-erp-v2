import { NextRequest, NextResponse } from "next/server"
import { createCrmAdminClient } from "@/lib/supabase/admin-untyped"
import { createClient } from "@/lib/supabase/server"

/**
 * GET /api/crm/analytics/agents
 * Returns performance metrics for all active agents (or a specific one).
 *
 * Query params:
 *  - agent_id: filter to a specific agent
 *  - from: ISO date string (start of period, default: 30 days ago)
 *  - to: ISO date string (end of period, default: now)
 */
export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const db = createCrmAdminClient()
    const { searchParams } = req.nextUrl
    const agentId = searchParams.get("agent_id")
    const sectorFilter = searchParams.get("sector")
    const now = new Date()
    const from = searchParams.get("from") || new Date(now.getTime() - 30 * 86400000).toISOString()
    const to = searchParams.get("to") || now.toISOString()

    // Fetch agents
    let agentsQuery = db
      .from("dev_users")
      .select("id, commercial_name, active_lead_count")
      .eq("is_active", true)
      .order("commercial_name")

    if (agentId) agentsQuery = agentsQuery.eq("id", agentId)

    const { data: agents } = await agentsQuery
    if (!agents?.length) return NextResponse.json({ agents: [] })

    const metrics = await Promise.all(
      agents.map(async (agent: { id: string; commercial_name: string; active_lead_count: number }) => {
        // ── Entries in period ──
        let entriesQuery = db
          .from("leads_entries")
          .select("id, created_at, first_contact_at, sla_status, sla_deadline, status, is_reactivation, source")
          .eq("assigned_agent_id", agent.id)
          .gte("created_at", from)
          .lte("created_at", to)
        if (sectorFilter) entriesQuery = entriesQuery.eq("sector", sectorFilter)
        const { data: entries } = await entriesQuery

        const allEntries = entries ?? []
        const totalEntries = allEntries.length
        const contacted = allEntries.filter((e: { first_contact_at: string | null }) => e.first_contact_at)
        const notContacted = totalEntries - contacted.length

        // ── Response times ──
        const responseTimes = contacted
          .map((e: { created_at: string; first_contact_at: string }) => {
            const created = new Date(e.created_at).getTime()
            const contact = new Date(e.first_contact_at).getTime()
            return (contact - created) / 60000 // minutes
          })
          .filter((t: number) => t > 0 && t < 10080) // exclude outliers > 7 days
          .sort((a: number, b: number) => a - b)

        const avgResponseMin = responseTimes.length
          ? responseTimes.reduce((s: number, t: number) => s + t, 0) / responseTimes.length
          : null
        const medianResponseMin = responseTimes.length
          ? responseTimes[Math.floor(responseTimes.length / 2)]
          : null

        // ── SLA compliance ──
        const withSla = allEntries.filter((e: { sla_deadline: string | null }) => e.sla_deadline)
        const slaCompliant = withSla.filter((e: { sla_status: string }) =>
          e.sla_status === 'completed' || e.sla_status === 'on_time'
        )
        const slaComplianceRate = withSla.length
          ? (slaCompliant.length / withSla.length) * 100
          : null

        // ── Entries by status ──
        const statusCounts: Record<string, number> = {}
        for (const e of allEntries) {
          const s = (e as { status: string }).status
          statusCounts[s] = (statusCounts[s] || 0) + 1
        }

        // ── Entries by source ──
        const sourceCounts: Record<string, number> = {}
        for (const e of allEntries) {
          const s = (e as { source: string }).source
          sourceCounts[s] = (sourceCounts[s] || 0) + 1
        }

        // ── Negocios in period ──
        const { data: negocios } = await db
          .from("negocios")
          .select("id, won_date, lost_date, expected_value, pipeline_stage_id")
          .eq("assigned_consultant_id", agent.id)
          .gte("created_at", from)
          .lte("created_at", to)

        const allNegocios = negocios ?? []
        const won = allNegocios.filter((n: { won_date: string | null }) => n.won_date)
        const lost = allNegocios.filter((n: { lost_date: string | null }) => n.lost_date)
        const active = allNegocios.filter((n: { won_date: string | null; lost_date: string | null }) =>
          !n.won_date && !n.lost_date
        )
        const totalRevenue = won.reduce((s: number, n: { expected_value: number | null }) =>
          s + (n.expected_value ?? 0), 0
        )
        const winRate = (won.length + lost.length) > 0
          ? (won.length / (won.length + lost.length)) * 100
          : null

        // ── Conversion funnel ──
        const qualified = allEntries.filter((e: { status: string }) =>
          e.status === 'qualified' || e.status === 'converted'
        ).length
        const converted = allEntries.filter((e: { status: string }) =>
          e.status === 'converted'
        ).length

        const funnel = {
          entries: totalEntries,
          contacted: contacted.length,
          qualified,
          converted,
          won: won.length,
          contact_rate: totalEntries ? (contacted.length / totalEntries) * 100 : null,
          qualify_rate: contacted.length ? (qualified / contacted.length) * 100 : null,
          convert_rate: qualified ? (converted / qualified) * 100 : null,
          win_rate: winRate,
        }

        // ── Activities in period ──
        const { count: totalActivities } = await db
          .from("leads_activities")
          .select("*", { count: "exact", head: true })
          .eq("created_by", agent.id)
          .gte("created_at", from)
          .lte("created_at", to)

        const { data: activityBreakdown } = await db
          .from("leads_activities")
          .select("activity_type")
          .eq("created_by", agent.id)
          .gte("created_at", from)
          .lte("created_at", to)

        const activityCounts: Record<string, number> = {}
        for (const a of activityBreakdown ?? []) {
          const t = (a as { activity_type: string }).activity_type
          activityCounts[t] = (activityCounts[t] || 0) + 1
        }

        return {
          agent: {
            id: agent.id,
            name: agent.commercial_name,
            active_leads: agent.active_lead_count ?? 0,
          },
          period: { from, to },
          entries: {
            total: totalEntries,
            contacted: contacted.length,
            not_contacted: notContacted,
            by_status: statusCounts,
            by_source: sourceCounts,
          },
          response: {
            avg_minutes: avgResponseMin ? Math.round(avgResponseMin) : null,
            median_minutes: medianResponseMin ? Math.round(medianResponseMin) : null,
            sla_compliance_pct: slaComplianceRate ? Math.round(slaComplianceRate) : null,
          },
          negocios: {
            total: allNegocios.length,
            active: active.length,
            won: won.length,
            lost: lost.length,
            revenue: totalRevenue,
            win_rate: winRate ? Math.round(winRate) : null,
          },
          funnel,
          activities: {
            total: totalActivities ?? 0,
            by_type: activityCounts,
          },
        }
      })
    )

    return NextResponse.json({ agents: metrics })
  } catch (err) {
    console.error("[Agent Analytics]", err)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}
