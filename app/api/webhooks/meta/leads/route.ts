import { NextRequest, NextResponse } from "next/server"
import { createCrmAdminClient } from "@/lib/supabase/admin-untyped"
import { ingestLead } from "@/lib/crm/ingest-lead"

// ─── GET: Meta webhook verification ─────────────────────────────────────────

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const mode = searchParams.get("hub.mode")
  const token = searchParams.get("hub.verify_token")
  const challenge = searchParams.get("hub.challenge")

  if (mode === "subscribe" && token === process.env.META_VERIFY_TOKEN) {
    console.log("[Meta Webhook] Verification successful")
    return new NextResponse(challenge, { status: 200 })
  }

  console.warn("[Meta Webhook] Verification failed — token mismatch")
  return NextResponse.json({ error: "Forbidden" }, { status: 403 })
}

// ─── POST: Receive leads from Meta Lead Ads ─────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    if (body.object !== "page") {
      return NextResponse.json({ error: "Not a page event" }, { status: 400 })
    }

    const supabase = createCrmAdminClient()
    const results: Array<{ leadgen_id: string; contact_id: string; entry_id: string }> = []

    for (const entry of body.entry ?? []) {
      for (const change of entry.changes ?? []) {
        if (change.field !== "leadgen") continue

        const leadgenId = change.value?.leadgen_id
        const formId = change.value?.form_id

        if (!leadgenId) continue

        // Fetch actual lead data from Meta Graph API
        const leadData = await fetchMetaLeadData(leadgenId)
        if (!leadData) {
          console.error(`[Meta Webhook] Failed to fetch lead data for leadgen_id: ${leadgenId}`)
          continue
        }

        const fields = parseMetaFields(leadData.field_data ?? [])
        const fullName =
          [fields.first_name, fields.last_name].filter(Boolean).join(" ") ||
          fields.full_name ||
          fields.email?.split("@")[0] ||
          "Lead Meta"

        // Resolve campaign from Meta's campaign_id
        const metaCampaignId = leadData.campaign_id ?? change.value?.campaign_id
        let campaignId: string | null = null

        if (metaCampaignId) {
          const { data: campaign } = await supabase
            .from("leads_campaigns")
            .select("id")
            .eq("external_campaign_id", String(metaCampaignId))
            .limit(1)
            .single()
          campaignId = campaign?.id ?? null
        }

        // Use the unified ingestion pipeline
        const result = await ingestLead(supabase, {
          name: fullName,
          email: fields.email || null,
          phone: fields.phone_number || fields.phone || null,
          source: "meta_ads",
          campaign_id: campaignId,
          form_data: {
            leadgen_id: leadgenId,
            form_id: formId,
            meta_campaign_id: metaCampaignId,
            meta_adset_id: leadData.adset_id,
            meta_ad_id: leadData.ad_id,
            raw_fields: fields,
          },
        })

        results.push({
          leadgen_id: leadgenId,
          contact_id: result.contact_id,
          entry_id: result.entry_id,
        })

        console.log(
          `[Meta Webhook] Lead ingested: ${fullName} (leadgen: ${leadgenId}, ` +
          `reactivation: ${result.is_reactivation}, agent: ${result.assigned_agent_id ?? "pool"})`
        )
      }
    }

    return NextResponse.json({ status: "ok", processed: results.length, results }, { status: 200 })
  } catch (err) {
    console.error("[Meta Webhook] Error processing:", err)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function fetchMetaLeadData(leadgenId: string) {
  const accessToken = process.env.META_ACCESS_TOKEN
  if (!accessToken) {
    console.error("[Meta Webhook] META_ACCESS_TOKEN not set")
    return null
  }

  try {
    const res = await fetch(
      `https://graph.facebook.com/v21.0/${leadgenId}?fields=id,created_time,field_data,ad_id,adset_id,campaign_id,form_id&access_token=${accessToken}`,
      { next: { revalidate: 0 } }
    )

    if (!res.ok) {
      const errText = await res.text()
      console.error(`[Meta Webhook] Graph API error: ${res.status} — ${errText}`)
      return null
    }

    return await res.json()
  } catch (err) {
    console.error("[Meta Webhook] Graph API fetch failed:", err)
    return null
  }
}

function parseMetaFields(fieldData: Array<{ name: string; values: string[] }>): Record<string, string> {
  const result: Record<string, string> = {}
  for (const field of fieldData) {
    result[field.name] = field.values?.[0] ?? ""
  }
  return result
}
