import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { notifyAdmins } from "@/lib/notify"

// ─── GET: Meta webhook verification ─────────────────────────────────────────
// Meta sends a GET request to verify the webhook URL.
// It expects the hub.challenge token back if the verify_token matches.

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

    // Meta sends { object: "page", entry: [...] }
    if (body.object !== "page") {
      return NextResponse.json({ error: "Not a page event" }, { status: 400 })
    }

    const supabase = createAdminClient()

    for (const entry of body.entry ?? []) {
      for (const change of entry.changes ?? []) {
        if (change.field !== "leadgen") continue

        const leadgenId = change.value?.leadgen_id
        const pageId = change.value?.page_id
        const formId = change.value?.form_id
        const createdTime = change.value?.created_time

        if (!leadgenId) continue

        // Fetch the actual lead data from Meta Graph API
        const leadData = await fetchMetaLeadData(leadgenId)

        if (!leadData) {
          console.error(`[Meta Webhook] Failed to fetch lead data for leadgen_id: ${leadgenId}`)
          continue
        }

        // Parse field_data into a flat object
        const fields = parseMetaFields(leadData.field_data ?? [])

        const fullName =
          [fields.first_name, fields.last_name].filter(Boolean).join(" ") ||
          fields.full_name ||
          fields.email?.split("@")[0] ||
          "Lead Meta"

        // Insert lead (adapted to existing leads table — PT column names)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: lead } = await (supabase.from("leads") as any)
          .insert({
            nome: fullName,
            full_name: fullName,
            email: fields.email ?? null,
            telemovel: fields.phone_number ?? fields.phone ?? null,
            origem: "meta_lead_ad",
            estado: "novo",
            platform: "facebook",
            meta_data: {
              leadgen_id: leadgenId,
              page_id: pageId,
              meta_form_id: formId,
              created_time: createdTime,
              source_detail: `Meta Lead Ads — Form ${formId ?? "unknown"}`,
              company_name: fields.company_name ?? null,
              raw_fields: fields,
              raw_response: leadData,
            },
          })
          .select("id")
          .single()

        // Notify admins
        await notifyAdmins({
          type: "lead_new",
          title: "Novo lead via Meta Ads",
          body: `${fullName}${fields.email ? ` — ${fields.email}` : ""}`,
          action_url: lead ? `/leads/${lead.id}` : "/leads",
          metadata: { leadgen_id: leadgenId, source: "meta_ads" },
        })

        console.log(`[Meta Webhook] Lead created: ${fullName} (leadgen_id: ${leadgenId})`)
      }
    }

    return NextResponse.json({ status: "ok" }, { status: 200 })
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
      `https://graph.facebook.com/v21.0/${leadgenId}?access_token=${accessToken}`,
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
