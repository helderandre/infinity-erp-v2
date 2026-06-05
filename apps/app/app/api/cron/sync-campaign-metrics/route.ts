import { NextRequest, NextResponse } from "next/server"
import { createCrmAdminClient } from "@/lib/supabase/admin-untyped"

/**
 * Cron job — runs daily at 06:00.
 * Syncs campaign metrics from Meta Ads API and combines with ERP conversion data.
 *
 * For each leads_campaigns record with platform=meta and external_campaign_id:
 *  1. Fetches insights from Meta Graph API (spend, impressions, clicks, leads)
 *  2. Counts ERP entries, contacted, qualified, converted, won, revenue
 *  3. Upserts into leads_campaign_metrics (one row per campaign per day)
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization")
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const accessToken = process.env.META_ACCESS_TOKEN
  if (!accessToken) {
    return NextResponse.json({ error: "META_ACCESS_TOKEN not configured" }, { status: 500 })
  }

  const db = createCrmAdminClient()

  try {
    // 1. Fetch all Meta campaigns with external IDs
    const { data: campaigns } = await db
      .from("leads_campaigns")
      .select("id, external_campaign_id, name")
      .eq("platform", "meta")
      .not("external_campaign_id", "is", null)

    if (!campaigns?.length) {
      return NextResponse.json({ synced: 0, message: "No Meta campaigns to sync" })
    }

    const today = new Date().toISOString().split("T")[0]
    let synced = 0
    let errors = 0

    for (const campaign of campaigns) {
      try {
        // 2. Fetch Meta insights for this campaign (last 7 days for freshness)
        const metaMetrics = await fetchMetaCampaignInsights(
          campaign.external_campaign_id!,
          accessToken,
          today
        )

        // 3. Compute ERP metrics for this campaign
        const erpMetrics = await computeErpMetrics(db, campaign.id)

        // 4. Upsert into leads_campaign_metrics
        const { error } = await db
          .from("leads_campaign_metrics")
          .upsert(
            {
              campaign_id: campaign.id,
              date: today,
              // Meta metrics
              impressions: metaMetrics?.impressions ?? null,
              clicks: metaMetrics?.clicks ?? null,
              spend: metaMetrics?.spend ?? null,
              platform_leads: metaMetrics?.leads ?? null,
              ctr: metaMetrics?.ctr ?? null,
              cpl: metaMetrics?.cpl ?? null,
              // ERP metrics
              erp_entries: erpMetrics.entries,
              erp_contacted: erpMetrics.contacted,
              erp_qualified: erpMetrics.qualified,
              erp_converted: erpMetrics.converted,
              erp_won: erpMetrics.won,
              erp_revenue: erpMetrics.revenue,
              synced_at: new Date().toISOString(),
            },
            { onConflict: "campaign_id,date" }
          )

        if (error) {
          console.error(`[Campaign Metrics] Upsert failed for ${campaign.name}:`, error.message)
          errors++
        } else {
          synced++
        }
      } catch (err) {
        console.error(`[Campaign Metrics] Error for ${campaign.name}:`, err)
        errors++
      }
    }

    // 5. Also sync ERP-only campaigns (website, partner, etc.) — no Meta data
    const { data: erpOnlyCampaigns } = await db
      .from("leads_campaigns")
      .select("id, name")
      .neq("platform", "meta")

    for (const campaign of erpOnlyCampaigns ?? []) {
      try {
        const erpMetrics = await computeErpMetrics(db, campaign.id)
        if (erpMetrics.entries > 0) {
          await db.from("leads_campaign_metrics").upsert(
            {
              campaign_id: campaign.id,
              date: today,
              erp_entries: erpMetrics.entries,
              erp_contacted: erpMetrics.contacted,
              erp_qualified: erpMetrics.qualified,
              erp_converted: erpMetrics.converted,
              erp_won: erpMetrics.won,
              erp_revenue: erpMetrics.revenue,
              synced_at: new Date().toISOString(),
            },
            { onConflict: "campaign_id,date" }
          )
          synced++
        }
      } catch {
        errors++
      }
    }

    console.log(`[Campaign Metrics] Done: ${synced} synced, ${errors} errors`)
    return NextResponse.json({ synced, errors, campaigns: campaigns.length })
  } catch (err) {
    console.error("[Campaign Metrics] Error:", err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    )
  }
}

// ============================================================================
// Meta Graph API
// ============================================================================

interface MetaInsights {
  impressions: number
  clicks: number
  spend: number
  leads: number
  ctr: number
  cpl: number
}

async function fetchMetaCampaignInsights(
  campaignId: string,
  accessToken: string,
  date: string
): Promise<MetaInsights | null> {
  try {
    // Fetch insights for today (or use date_preset=today for current day)
    const url = `https://graph.facebook.com/v21.0/${campaignId}/insights?` +
      `fields=impressions,clicks,spend,actions,ctr,cost_per_action_type` +
      `&time_range={"since":"${date}","until":"${date}"}` +
      `&access_token=${accessToken}`

    const res = await fetch(url, { cache: "no-store" })
    if (!res.ok) {
      const err = await res.text()
      console.warn(`[Meta Insights] Campaign ${campaignId}: ${res.status} — ${err}`)
      return null
    }

    const body = await res.json()
    const data = body.data?.[0]
    if (!data) return null

    const impressions = parseInt(data.impressions ?? "0")
    const clicks = parseInt(data.clicks ?? "0")
    const spend = parseFloat(data.spend ?? "0")
    const ctr = parseFloat(data.ctr ?? "0")

    // Extract lead actions
    const leadAction = data.actions?.find(
      (a: { action_type: string }) => a.action_type === "lead" || a.action_type === "onsite_conversion.lead_grouped"
    )
    const leads = parseInt(leadAction?.value ?? "0")

    // Extract cost per lead
    const cplAction = data.cost_per_action_type?.find(
      (a: { action_type: string }) => a.action_type === "lead" || a.action_type === "onsite_conversion.lead_grouped"
    )
    const cpl = parseFloat(cplAction?.value ?? "0")

    return { impressions, clicks, spend, leads, ctr, cpl }
  } catch (err) {
    console.warn(`[Meta Insights] Fetch failed for campaign ${campaignId}:`, err)
    return null
  }
}

// ============================================================================
// ERP Metrics
// ============================================================================

interface ErpMetrics {
  entries: number
  contacted: number
  qualified: number
  converted: number
  won: number
  revenue: number
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function computeErpMetrics(db: any, campaignId: string): Promise<ErpMetrics> {
  // Total entries from this campaign
  const { data: entries } = await db
    .from("leads_entries")
    .select("id, status, first_contact_at")
    .eq("campaign_id", campaignId)

  const allEntries = entries ?? []
  const contacted = allEntries.filter((e: { first_contact_at: string | null }) => e.first_contact_at).length
  const qualified = allEntries.filter((e: { status: string }) =>
    e.status === "qualified" || e.status === "converted"
  ).length
  const converted = allEntries.filter((e: { status: string }) => e.status === "converted").length

  // Negocios linked to entries from this campaign
  const entryIds = allEntries.map((e: { id: string }) => e.id)
  let won = 0
  let revenue = 0

  if (entryIds.length > 0) {
    const { data: negocios } = await db
      .from("negocios")
      .select("won_date, expected_value")
      .in("entry_id", entryIds)

    for (const n of negocios ?? []) {
      if (n.won_date) {
        won++
        revenue += n.expected_value ?? 0
      }
    }
  }

  return {
    entries: allEntries.length,
    contacted,
    qualified,
    converted,
    won,
    revenue,
  }
}
