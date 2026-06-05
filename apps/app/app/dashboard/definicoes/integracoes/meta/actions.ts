"use server"

import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import crypto from "crypto"

// ─── Custom Audiences ────────────────────────────────────────────────────────

export interface CustomAudience {
  id: string
  name: string
  approximate_count: number
  subtype: string
}

export async function getCustomAudiences(): Promise<{
  audiences: CustomAudience[]
  error: string | null
}> {
  const accessToken = process.env.META_ACCESS_TOKEN
  const adAccountId = process.env.META_AD_ACCOUNT_ID
  if (!accessToken || !adAccountId) {
    return { audiences: [], error: "META_ACCESS_TOKEN ou META_AD_ACCOUNT_ID em falta" }
  }

  try {
    const accountId = adAccountId.startsWith("act_") ? adAccountId : `act_${adAccountId}`
    const res = await fetch(
      `https://graph.facebook.com/v21.0/${accountId}/customaudiences?fields=id,name,approximate_count_lower_bound,approximate_count_upper_bound,subtype&limit=100&access_token=${accessToken}`,
      { next: { revalidate: 300 } }
    )
    if (!res.ok) {
      const errBody = await res.json().catch(() => null)
      return { audiences: [], error: errBody?.error?.message ?? `HTTP ${res.status}` }
    }
    const body = await res.json()
    const raw = (body.data ?? []) as Array<Record<string, unknown>>
    return {
      audiences: raw.map((a) => ({
        id: a.id as string,
        name: a.name as string,
        approximate_count: (a.approximate_count_lower_bound as number) ?? 0,
        subtype: (a.subtype as string) ?? "CUSTOM",
      })),
      error: null,
    }
  } catch (err) {
    return { audiences: [], error: err instanceof Error ? err.message : "Erro desconhecido" }
  }
}

export async function syncCustomAudience(audienceName: string): Promise<{
  success: boolean
  audienceId: string | null
  count: number
  error: string | null
}> {
  const accessToken = process.env.META_ACCESS_TOKEN
  const adAccountId = process.env.META_AD_ACCOUNT_ID
  const appSecret = process.env.META_APP_SECRET
  if (!accessToken || !adAccountId || !appSecret) {
    return { success: false, audienceId: null, count: 0, error: "Credenciais Meta em falta" }
  }

  try {
    // Fetch client emails from Supabase
    const supabase = createAdminClient()
    const { data: clients, error: dbError } = await supabase
      .from("dev_users")
      .select("professional_email")
      .eq("is_active", true)
      .not("professional_email", "is", null)

    if (dbError) return { success: false, audienceId: null, count: 0, error: dbError.message }
    if (!clients || clients.length === 0) {
      return { success: false, audienceId: null, count: 0, error: "Sem clientes com email" }
    }

    const accountId = adAccountId.startsWith("act_") ? adAccountId : `act_${adAccountId}`

    // Step 1: Create the custom audience
    const createRes = await fetch(
      `https://graph.facebook.com/v21.0/${accountId}/customaudiences`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: audienceName || `ERP Infinity Clientes — ${new Date().toLocaleDateString("pt-PT")}`,
          subtype: "CUSTOM",
          description: "Audiência sincronizada do ERP Infinity",
          customer_file_source: "USER_PROVIDED_ONLY",
          access_token: accessToken,
        }),
      }
    )
    if (!createRes.ok) {
      const errBody = await createRes.json().catch(() => null)
      return { success: false, audienceId: null, count: 0, error: errBody?.error?.message ?? "Erro ao criar audiência" }
    }
    const createData = await createRes.json()
    const audienceId = createData.id as string

    // Step 2: Hash emails and add users
    const hashedEmails = clients.map((c) => [
      crypto.createHash("sha256").update((c.professional_email as string).toLowerCase().trim()).digest("hex"),
    ])

    const addRes = await fetch(
      `https://graph.facebook.com/v21.0/${audienceId}/users`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          payload: {
            schema: ["EMAIL"],
            data: hashedEmails,
          },
          access_token: accessToken,
        }),
      }
    )
    if (!addRes.ok) {
      const errBody = await addRes.json().catch(() => null)
      return { success: false, audienceId, count: 0, error: errBody?.error?.message ?? "Erro ao adicionar utilizadores" }
    }

    return { success: true, audienceId, count: clients.length, error: null }
  } catch (err) {
    return { success: false, audienceId: null, count: 0, error: err instanceof Error ? err.message : "Erro desconhecido" }
  }
}

// ─── Offline Conversions ─────────────────────────────────────────────────────

export async function sendOfflineConversion(params: {
  leadEmail: string
  leadPhone?: string
  eventName: string
  value?: number
  currency?: string
}): Promise<{ success: boolean; error: string | null }> {
  const accessToken = process.env.META_ACCESS_TOKEN
  const pixelId = process.env.META_PIXEL_ID
  if (!accessToken) return { success: false, error: "META_ACCESS_TOKEN em falta" }
  if (!pixelId) return { success: false, error: "META_PIXEL_ID em falta" }

  try {
    const hashedEmail = crypto
      .createHash("sha256")
      .update(params.leadEmail.toLowerCase().trim())
      .digest("hex")

    const userData: Record<string, string> = { em: hashedEmail }
    if (params.leadPhone) {
      const cleanPhone = params.leadPhone.replace(/\D/g, "")
      userData.ph = crypto.createHash("sha256").update(cleanPhone).digest("hex")
    }

    const eventData: Record<string, unknown> = {
      event_name: params.eventName,
      event_time: Math.floor(Date.now() / 1000),
      action_source: "system_generated",
      user_data: userData,
    }

    if (params.value) {
      eventData.custom_data = {
        value: params.value,
        currency: params.currency ?? "EUR",
      }
    }

    const res = await fetch(
      `https://graph.facebook.com/v21.0/${pixelId}/events`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          data: [eventData],
          access_token: accessToken,
        }),
      }
    )

    if (!res.ok) {
      const errBody = await res.json().catch(() => null)
      return { success: false, error: errBody?.error?.message ?? `HTTP ${res.status}` }
    }

    return { success: true, error: null }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Erro desconhecido" }
  }
}

// ─── Lead Status → Meta Event mapping ────────────────────────────────────────
// Sends different conversion events at different pipeline stages so Meta
// can optimize for quality leads (not just final conversions).
//
// qualified     → "Lead"            (this person is a quality lead, find more like them)
// proposal_sent → "InitiateCheckout" (advanced interest signal)
// negotiation   → "AddToCart"        (strong purchase intent)
// won           → "Purchase"         (closed deal — full ROAS attribution)

const LEAD_STATUS_TO_META_EVENT: Record<string, string> = {
  qualified: "Lead",
  proposal_sent: "InitiateCheckout",
  negotiation: "AddToCart",
  won: "Purchase",
}

export async function sendLeadStatusConversion(
  leadId: string,
  newStatus: string,
  value?: number,
): Promise<{ success: boolean; eventSent: string | null; error: string | null }> {
  const metaEvent = LEAD_STATUS_TO_META_EVENT[newStatus]
  if (!metaEvent) return { success: true, eventSent: null, error: null } // No event for this status

  const supabase = await createClient()
  const { data: lead, error: dbError } = await supabase
    .from("leads")
    .select("email, telemovel, nome")
    .eq("id", leadId)
    .single()

  if (dbError || !lead) return { success: false, eventSent: null, error: "Lead não encontrado" }
  if (!lead.email) return { success: false, eventSent: null, error: "Lead sem email" }

  const result = await sendOfflineConversion({
    leadEmail: lead.email,
    leadPhone: lead.telemovel ?? undefined,
    eventName: metaEvent,
    value: newStatus === "won" ? value : undefined,
    currency: "EUR",
  })

  return { ...result, eventSent: metaEvent }
}

// Backwards-compatible alias
export async function sendLeadWonConversion(leadId: string): Promise<{ success: boolean; error: string | null }> {
  const result = await sendLeadStatusConversion(leadId, "won")
  return { success: result.success, error: result.error }
}

// ─── Conversions API (CAPI) ─────────────────────────────────────────────────

export async function sendCAPIEvent(params: {
  eventName: string
  eventSourceUrl?: string
  userEmail?: string
  userPhone?: string
  userIp?: string
  userAgent?: string
  fbclid?: string
  fbp?: string
  fbc?: string
  customData?: Record<string, unknown>
}): Promise<{ success: boolean; eventsReceived: number; error: string | null }> {
  const accessToken = process.env.META_ACCESS_TOKEN
  const pixelId = process.env.META_PIXEL_ID
  if (!accessToken || !pixelId) {
    return { success: false, eventsReceived: 0, error: "META_ACCESS_TOKEN ou META_PIXEL_ID em falta" }
  }

  try {
    const userData: Record<string, string> = {}
    if (params.userEmail) {
      userData.em = crypto.createHash("sha256").update(params.userEmail.toLowerCase().trim()).digest("hex")
    }
    if (params.userPhone) {
      userData.ph = crypto.createHash("sha256").update(params.userPhone.replace(/\D/g, "")).digest("hex")
    }
    if (params.userIp) userData.client_ip_address = params.userIp
    if (params.userAgent) userData.client_user_agent = params.userAgent
    if (params.fbp) userData.fbp = params.fbp
    if (params.fbc) userData.fbc = params.fbc

    const eventData: Record<string, unknown> = {
      event_name: params.eventName,
      event_time: Math.floor(Date.now() / 1000),
      action_source: "website",
      user_data: userData,
    }
    if (params.eventSourceUrl) eventData.event_source_url = params.eventSourceUrl
    if (params.customData) eventData.custom_data = params.customData

    const res = await fetch(
      `https://graph.facebook.com/v21.0/${pixelId}/events`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          data: [eventData],
          access_token: accessToken,
        }),
      }
    )

    if (!res.ok) {
      const errBody = await res.json().catch(() => null)
      return { success: false, eventsReceived: 0, error: errBody?.error?.message ?? `HTTP ${res.status}` }
    }

    const resData = await res.json()
    return {
      success: true,
      eventsReceived: (resData.events_received as number) ?? 1,
      error: null,
    }
  } catch (err) {
    return { success: false, eventsReceived: 0, error: err instanceof Error ? err.message : "Erro desconhecido" }
  }
}

// Test CAPI connection by sending a test event
export async function testCAPIConnection(): Promise<{
  success: boolean
  error: string | null
}> {
  const result = await sendCAPIEvent({
    eventName: "PageView",
    eventSourceUrl: process.env.NEXT_PUBLIC_APP_URL ?? "https://infinity-erp.vercel.app",
    userEmail: "test@infinity-erp.vercel.app",
    customData: { test_event_code: "TEST_ERP_INFINITY" },
  })

  return { success: result.success, error: result.error }
}
