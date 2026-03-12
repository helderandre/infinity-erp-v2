import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { emailNewLead } from "@/lib/notify"

// Vercel Cron hits this endpoint every 5 minutes to sync leads from Meta Ads.

interface MetaFieldData {
  name: string
  values: string[]
}

interface MetaLeadRaw {
  id: string
  created_time: string
  field_data?: MetaFieldData[]
  ad_id?: string
  ad_name?: string
  adset_id?: string
  adset_name?: string
  campaign_id?: string
  campaign_name?: string
  form_id?: string
  form_name?: string
  platform?: string
  is_organic?: boolean
}

function extractField(fields: MetaFieldData[] | undefined, name: string): string | null {
  if (!fields) return null
  const f = fields.find((fd) => fd.name === name)
  return f?.values?.[0] ?? null
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

  const admin = createAdminClient()
  const accountId = adAccountId.startsWith("act_") ? adAccountId : `act_${adAccountId}`

  try {
    // 1. Get all ads for this account
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

    // 2. Get existing meta lead IDs to avoid duplicates
    const { data: existingLeads } = await admin
      .from("leads")
      .select("meta_data")
      .eq("origem", "meta_lead_ad") as { data: Array<{ meta_data: Record<string, unknown> | null }> | null }

    const existingMetaIds = new Set(
      (existingLeads ?? [])
        .map((l) => l.meta_data?.meta_lead_id as string)
        .filter(Boolean)
    )

    // 3. Fetch leads from each ad
    let synced = 0
    let skipped = 0

    const knownFields = new Set([
      "full_name", "nome_completo", "first_name", "last_name",
      "email", "e-mail", "phone_number", "phone", "número_de_telefone", "numero_de_telefone", "telefone",
      "company_name", "empresa", "nome_da_empresa",
      "job_title", "cargo",
      "city", "cidade", "state", "estado",
      "zip_code", "codigo_postal", "código_postal", "country", "pais", "país",
      "street_address", "morada",
    ])

    for (const ad of ads) {
      const leadsUrl = `https://graph.facebook.com/v21.0/${ad.id}/leads?fields=id,created_time,field_data,ad_id,ad_name,adset_id,adset_name,campaign_id,campaign_name,form_id,form_name,platform,is_organic&limit=500&access_token=${accessToken}`
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

        const fullName = (extractField(ml.field_data, "full_name")
          ?? extractField(ml.field_data, "nome_completo")
          ?? [extractField(ml.field_data, "first_name"), extractField(ml.field_data, "last_name")].filter(Boolean).join(" "))
          || "Lead Meta"

        const email = extractField(ml.field_data, "email") ?? extractField(ml.field_data, "e-mail")
        const phone = extractField(ml.field_data, "phone_number") ?? extractField(ml.field_data, "phone") ?? extractField(ml.field_data, "número_de_telefone") ?? extractField(ml.field_data, "numero_de_telefone") ?? extractField(ml.field_data, "telefone")
        const companyName = extractField(ml.field_data, "company_name") ?? extractField(ml.field_data, "empresa") ?? extractField(ml.field_data, "nome_da_empresa")
        const jobTitle = extractField(ml.field_data, "job_title") ?? extractField(ml.field_data, "cargo")
        const city = extractField(ml.field_data, "city") ?? extractField(ml.field_data, "cidade")
        const state = extractField(ml.field_data, "state") ?? extractField(ml.field_data, "estado")
        const zipCode = extractField(ml.field_data, "zip_code") ?? extractField(ml.field_data, "codigo_postal") ?? extractField(ml.field_data, "código_postal")
        const country = extractField(ml.field_data, "country") ?? extractField(ml.field_data, "pais") ?? extractField(ml.field_data, "país")
        const streetAddress = extractField(ml.field_data, "street_address") ?? extractField(ml.field_data, "morada")

        const extraFields: Record<string, string> = {}
        for (const fd of ml.field_data ?? []) {
          if (!knownFields.has(fd.name) && fd.values?.[0]) {
            extraFields[fd.name] = fd.values[0]
          }
        }

        // Adapted to existing leads table schema (PT column names)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: insertedLead, error: insertError } = await (admin.from("leads") as any).insert({
          nome: fullName,
          full_name: fullName,
          email: email || null,
          telemovel: phone || null,
          origem: "meta_lead_ad",
          estado: "novo",
          platform: ml.platform ?? null,
          meta_data: {
            meta_lead_id: ml.id,
            campaign_id: ml.campaign_id ?? ad.campaign_id,
            campaign_name: ml.campaign_name ?? ad.campaign?.name ?? null,
            adset_id: ml.adset_id ?? ad.adset_id,
            adset_name: ml.adset_name ?? ad.adset?.name ?? null,
            ad_id: ml.ad_id ?? ad.id,
            ad_name: ml.ad_name ?? ad.name,
            form_id: ml.form_id ?? null,
            form_name: ml.form_name ?? null,
            is_organic: ml.is_organic ?? false,
            company_name: companyName || null,
            job_title: jobTitle || null,
            city: city || null,
            state: state || null,
            zip_code: zipCode || null,
            country: country || null,
            street_address: streetAddress || null,
            field_data: ml.field_data ?? [],
            extra_fields: Object.keys(extraFields).length > 0 ? extraFields : undefined,
            synced_at: new Date().toISOString(),
          },
          created_at: ml.created_time,
        }).select("id").single()

        if (!insertError) {
          existingMetaIds.add(ml.id)
          synced++
          emailNewLead(fullName, `Meta Ads — ${ml.form_name ?? ad.name}`, email, phone, insertedLead?.id)
        } else {
          console.error(`[Cron Meta Sync] Insert failed for lead ${ml.id}:`, insertError.message)
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
