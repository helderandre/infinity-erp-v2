import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { ingestLead } from "@/lib/crm/ingest-lead"

/**
 * Cron job — runs every 5 minutes.
 * Fetches leads from all Meta ads and ingests new ones via the CRM pipeline.
 */

interface MetaFieldData {
  name: string
  values: string[]
}

interface MetaLeadRaw {
  id: string
  created_time: string
  field_data?: MetaFieldData[]
  ad_id?: string
  adset_id?: string
  campaign_id?: string
  campaign_name?: string
  form_id?: string
  form_name?: string
  platform?: string
}

function extractField(fields: MetaFieldData[] | undefined, ...names: string[]): string | null {
  if (!fields) return null
  for (const name of names) {
    const f = fields.find((fd) => fd.name === name)
    if (f?.values?.[0]) return f.values[0]
  }
  return null
}

export async function GET(req: NextRequest) {
  // Verify cron authorization
  const authHeader = req.headers.get("authorization")
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const accessToken = process.env.META_ACCESS_TOKEN
  const adAccountId = process.env.META_AD_ACCOUNT_ID

  if (!accessToken || !adAccountId) {
    return NextResponse.json({ error: "META_ACCESS_TOKEN or META_AD_ACCOUNT_ID not configured" }, { status: 500 })
  }

  const supabase = createAdminClient()
  const accountId = adAccountId.startsWith("act_") ? adAccountId : `act_${adAccountId}`

  try {
    // 1. Get all ads
    const adsUrl = `https://graph.facebook.com/v21.0/${accountId}/ads?fields=id,name,campaign_id,campaign{name},adset_id,adset{name}&limit=200&access_token=${accessToken}`
    const adsRes = await fetch(adsUrl, { cache: "no-store" })
    if (!adsRes.ok) {
      const err = await adsRes.json().catch(() => null)
      return NextResponse.json({ error: err?.error?.message ?? `Ads fetch failed: HTTP ${adsRes.status}` }, { status: 500 })
    }
    const adsBody = await adsRes.json()
    const ads = (adsBody.data ?? []) as Array<{
      id: string
      name: string
      campaign_id: string
      campaign?: { name: string; id: string }
      adset_id: string
      adset?: { name: string; id: string }
    }>

    if (ads.length === 0) {
      return NextResponse.json({ synced: 0, skipped: 0, message: "No ads found" })
    }

    // 2. Get existing Meta lead IDs to avoid duplicates
    // Check entries form_data for leadgen_id / meta_lead_id
    const { data: existingEntries } = await supabase
      .from("leads_entries")
      .select("form_data")
      .eq("source", "meta_ads")

    const existingMetaIds = new Set<string>()
    for (const e of existingEntries ?? []) {
      const fd = e.form_data as Record<string, unknown> | null
      if (fd?.leadgen_id) existingMetaIds.add(String(fd.leadgen_id))
      if (fd?.meta_lead_id) existingMetaIds.add(String(fd.meta_lead_id))
    }

    // Also check legacy leads
    const { data: legacyLeads } = await supabase
      .from("leads")
      .select("meta_data")
      .eq("origem", "meta_lead_ad") as { data: Array<{ meta_data: Record<string, unknown> | null }> | null }

    for (const l of legacyLeads ?? []) {
      if (l.meta_data?.meta_lead_id) existingMetaIds.add(String(l.meta_data.meta_lead_id))
    }

    // 3. Pre-fetch campaign mappings (Meta campaign_id → CRM campaign UUID)
    const { data: campaigns } = await supabase
      .from("leads_campaigns")
      .select("id, external_campaign_id")
      .eq("platform", "meta")
      .not("external_campaign_id", "is", null)

    const campaignMap = new Map<string, string>()
    for (const c of campaigns ?? []) {
      if (c.external_campaign_id) campaignMap.set(c.external_campaign_id, c.id)
    }

    // 4. Fetch and ingest leads from each ad
    let synced = 0
    let skipped = 0

    for (const ad of ads) {
      const leadsUrl = `https://graph.facebook.com/v21.0/${ad.id}/leads?fields=id,created_time,field_data,ad_id,adset_id,campaign_id,campaign_name,form_id,form_name,platform&limit=500&access_token=${accessToken}`
      const leadsRes = await fetch(leadsUrl, { cache: "no-store" })

      if (!leadsRes.ok) {
        console.warn(`[Cron Meta Sync] Ad ${ad.id} leads fetch failed`)
        continue
      }

      const leadsBody = await leadsRes.json()
      const metaLeads = (leadsBody.data ?? []) as MetaLeadRaw[]

      for (const ml of metaLeads) {
        if (existingMetaIds.has(ml.id)) {
          skipped++
          continue
        }

        const fullName = (
          extractField(ml.field_data, "full_name", "nome_completo") ??
          [extractField(ml.field_data, "first_name"), extractField(ml.field_data, "last_name")].filter(Boolean).join(" ")
        ) || "Lead Meta"

        const email = extractField(ml.field_data, "email", "e-mail")
        const phone = extractField(ml.field_data, "phone_number", "phone", "número_de_telefone", "telefone")

        // Resolve CRM campaign
        const metaCampaignId = ml.campaign_id ?? ad.campaign_id
        const campaignId = metaCampaignId ? (campaignMap.get(metaCampaignId) ?? null) : null

        try {
          await ingestLead(supabase, {
            name: fullName,
            email: email || null,
            phone: phone || null,
            source: "meta_ads",
            campaign_id: campaignId,
            form_data: {
              meta_lead_id: ml.id,
              leadgen_id: ml.id,
              meta_campaign_id: metaCampaignId,
              meta_campaign_name: ml.campaign_name ?? ad.campaign?.name,
              meta_adset_id: ml.adset_id ?? ad.adset_id,
              meta_ad_id: ml.ad_id ?? ad.id,
              meta_ad_name: ad.name,
              form_id: ml.form_id,
              form_name: ml.form_name,
              field_data: ml.field_data,
              synced_at: new Date().toISOString(),
            },
          })

          existingMetaIds.add(ml.id)
          synced++
        } catch (err) {
          console.error(`[Cron Meta Sync] Ingest failed for lead ${ml.id}:`, err)
        }
      }
    }

    console.log(`[Cron Meta Sync] Done: ${synced} synced, ${skipped} skipped`)
    return NextResponse.json({ synced, skipped, ads: ads.length })
  } catch (err) {
    console.error("[Cron Meta Sync] Error:", err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    )
  }
}
