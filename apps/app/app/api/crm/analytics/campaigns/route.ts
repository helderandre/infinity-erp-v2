import { NextRequest, NextResponse } from "next/server"
import { createCrmAdminClient } from "@/lib/supabase/admin-untyped"
import { createClient } from "@/lib/supabase/server"

/**
 * GET /api/crm/analytics/campaigns
 * Returns campaign performance data combining Meta metrics + ERP conversion data.
 *
 * Query params:
 *  - from: ISO date (default: 30 days ago)
 *  - to: ISO date (default: today)
 *  - platform: filter by platform
 *  - campaign_id: filter to a specific campaign
 */
export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const db = createCrmAdminClient()
    const { searchParams } = req.nextUrl
    const now = new Date()
    const from = searchParams.get("from") || new Date(now.getTime() - 30 * 86400000).toISOString().split("T")[0]
    const to = searchParams.get("to") || now.toISOString().split("T")[0]
    const platformFilter = searchParams.get("platform")
    const campaignIdFilter = searchParams.get("campaign_id")

    // 1. Fetch campaigns
    let campaignsQuery = db
      .from("leads_campaigns")
      .select("*")
      .order("created_at", { ascending: false })

    if (platformFilter) campaignsQuery = campaignsQuery.eq("platform", platformFilter)
    if (campaignIdFilter) campaignsQuery = campaignsQuery.eq("id", campaignIdFilter)

    const { data: campaigns } = await campaignsQuery
    if (!campaigns?.length) return NextResponse.json({ campaigns: [], totals: null })

    // 2. Fetch metrics for period
    const campaignIds = campaigns.map((c: { id: string }) => c.id)
    const { data: metrics } = await db
      .from("leads_campaign_metrics")
      .select("*")
      .in("campaign_id", campaignIds)
      .gte("date", from)
      .lte("date", to)
      .order("date", { ascending: false })

    // 3. Aggregate metrics per campaign
    const metricsMap = new Map<string, {
      total_spend: number; total_impressions: number; total_clicks: number
      total_platform_leads: number
      total_entries: number; total_contacted: number; total_qualified: number
      total_converted: number; total_won: number; total_revenue: number
      days: number
    }>()

    for (const m of metrics ?? []) {
      const cid = m.campaign_id as string
      const existing = metricsMap.get(cid) ?? {
        total_spend: 0, total_impressions: 0, total_clicks: 0,
        total_platform_leads: 0,
        total_entries: 0, total_contacted: 0, total_qualified: 0,
        total_converted: 0, total_won: 0, total_revenue: 0,
        days: 0,
      }
      existing.total_spend += (m.spend as number) ?? 0
      existing.total_impressions += (m.impressions as number) ?? 0
      existing.total_clicks += (m.clicks as number) ?? 0
      existing.total_platform_leads += (m.platform_leads as number) ?? 0
      existing.total_entries += (m.erp_entries as number) ?? 0
      existing.total_contacted += (m.erp_contacted as number) ?? 0
      existing.total_qualified += (m.erp_qualified as number) ?? 0
      existing.total_converted += (m.erp_converted as number) ?? 0
      existing.total_won += (m.erp_won as number) ?? 0
      existing.total_revenue += (m.erp_revenue as number) ?? 0
      existing.days++
      metricsMap.set(cid, existing)
    }

    // 4. Build response
    const campaignResults = campaigns.map((c: { id: string; name: string; platform: string; status: string; sector: string | null; budget: number | null }) => {
      const m = metricsMap.get(c.id)
      const cpq = m && m.total_spend > 0 && m.total_qualified > 0
        ? m.total_spend / m.total_qualified : null
      const cpa = m && m.total_spend > 0 && m.total_won > 0
        ? m.total_spend / m.total_won : null
      const roas = m && m.total_spend > 0 && m.total_revenue > 0
        ? m.total_revenue / m.total_spend : null

      return {
        campaign: {
          id: c.id, name: c.name, platform: c.platform,
          status: c.status, sector: c.sector, budget: c.budget,
        },
        metrics: m ? {
          // Platform
          spend: m.total_spend,
          impressions: m.total_impressions,
          clicks: m.total_clicks,
          platform_leads: m.total_platform_leads,
          ctr: m.total_impressions > 0 ? (m.total_clicks / m.total_impressions) * 100 : null,
          cpl_platform: m.total_platform_leads > 0 ? m.total_spend / m.total_platform_leads : null,
          // ERP
          entries: m.total_entries,
          contacted: m.total_contacted,
          qualified: m.total_qualified,
          converted: m.total_converted,
          won: m.total_won,
          revenue: m.total_revenue,
          // Derived
          contact_rate: m.total_entries > 0 ? (m.total_contacted / m.total_entries) * 100 : null,
          qualify_rate: m.total_contacted > 0 ? (m.total_qualified / m.total_contacted) * 100 : null,
          convert_rate: m.total_qualified > 0 ? (m.total_converted / m.total_qualified) * 100 : null,
          win_rate: m.total_converted > 0 ? (m.total_won / m.total_converted) * 100 : null,
          cost_per_qualified: cpq,
          cost_per_won: cpa,
          roas,
          days: m.days,
        } : null,
      }
    })

    // 5. Aggregate totals
    const allMetrics = Array.from(metricsMap.values())
    const totals = {
      spend: allMetrics.reduce((s, m) => s + m.total_spend, 0),
      impressions: allMetrics.reduce((s, m) => s + m.total_impressions, 0),
      clicks: allMetrics.reduce((s, m) => s + m.total_clicks, 0),
      platform_leads: allMetrics.reduce((s, m) => s + m.total_platform_leads, 0),
      entries: allMetrics.reduce((s, m) => s + m.total_entries, 0),
      contacted: allMetrics.reduce((s, m) => s + m.total_contacted, 0),
      qualified: allMetrics.reduce((s, m) => s + m.total_qualified, 0),
      converted: allMetrics.reduce((s, m) => s + m.total_converted, 0),
      won: allMetrics.reduce((s, m) => s + m.total_won, 0),
      revenue: allMetrics.reduce((s, m) => s + m.total_revenue, 0),
    }

    const totalCpq = totals.spend > 0 && totals.qualified > 0 ? totals.spend / totals.qualified : null
    const totalCpa = totals.spend > 0 && totals.won > 0 ? totals.spend / totals.won : null
    const totalRoas = totals.spend > 0 && totals.revenue > 0 ? totals.revenue / totals.spend : null

    return NextResponse.json({
      campaigns: campaignResults,
      totals: {
        ...totals,
        cost_per_qualified: totalCpq,
        cost_per_won: totalCpa,
        roas: totalRoas,
      },
      period: { from, to },
    })
  } catch (err) {
    console.error("[Campaign Analytics]", err)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}
