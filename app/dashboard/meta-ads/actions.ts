"use server"

import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { revalidatePath } from "next/cache"
import { emailNewLead } from "@/lib/notify"
import type { Lead } from "@/types/meta-lead"

// ─── Types ───────────────────────────────────────────────────────────────────

export interface MetaInsights {
  spend: number
  impressions: number
  clicks: number
  cpc: number
  cpm: number
  ctr: number
  reach: number
  actions?: Array<{ action_type: string; value: string }>
}

export interface MetaCampaign {
  id: string
  name: string
  status: string
  objective: string
  daily_budget: string | null
  lifetime_budget: string | null
  created_time: string
  updated_time: string
  leadCount: number
  insights?: MetaInsights
  costPerLead?: number
}

export interface MetaAdSet {
  id: string
  name: string
  status: string
  campaign_id: string
  campaign_name: string
  daily_budget: string | null
  lifetime_budget: string | null
  targeting_summary: string | null
  leadCount: number
  insights?: MetaInsights
  costPerLead?: number
}

export interface MetaAd {
  id: string
  name: string
  status: string
  campaign_id: string
  campaign_name: string
  adset_id: string
  adset_name: string
  leadCount: number
  insights?: MetaInsights
  costPerLead?: number
  creative?: MetaAdCreative | null
}

export interface MetaApiError {
  message: string
  code?: number
}

// ─── Leads from Supabase ─────────────────────────────────────────────────────

export async function getMetaLeads(): Promise<Lead[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("leads")
    .select("*")
    .in("origem", ["meta_ads", "meta_lead_ad"])
    .order("created_at", { ascending: false })

  if (error) throw error

  // Map DB columns (PT) to the Lead interface used by the meta-ads UI
  return (data ?? []).map((row) => ({
    id: row.id,
    full_name: row.full_name ?? row.nome,
    email: row.email ?? null,
    phone: row.telemovel ?? row.telefone ?? null,
    company_name: row.empresa ?? null,
    source: (row.origem as Lead["source"]) ?? "meta_ads",
    source_detail: row.forma_contacto ?? null,
    form_id: null,
    status: mapEstadoToStatus(row.estado),
    assigned_to: row.agent_id ?? null,
    notes: row.observacoes ?? null,
    tags: [],
    meta_data: (row.meta_data as Record<string, unknown>) ?? {},
    job_title: null,
    city: row.localidade ?? null,
    state: row.distrito ?? null,
    zip_code: row.codigo_postal ?? null,
    country: row.pais ?? null,
    street_address: row.morada ?? null,
    platform: row.platform ?? null,
    ig_username: null,
    converted_to_client_id: null,
    converted_at: null,
    last_contacted_at: row.data_contacto ?? null,
    created_at: row.created_at,
    updated_at: row.created_at,
    is_archived: row.estado === "archived",
    deleted_at: null,
  }))
}

/** Map the PT `estado` values to the Lead interface status */
function mapEstadoToStatus(estado: string | null): Lead["status"] {
  const map: Record<string, Lead["status"]> = {
    novo: "new",
    new: "new",
    contactado: "contacted",
    contacted: "contacted",
    qualificado: "qualified",
    qualified: "qualified",
    arquivado: "cancelled",
    archived: "cancelled",
    expirado: "junk",
    expired: "junk",
  }
  return map[estado?.toLowerCase() ?? ""] ?? "new"
}

// ─── Real campaigns from Meta Graph API ──────────────────────────────────────

import type { MetaDatePreset } from "./constants"

// ─── Real campaigns from Meta Graph API ──────────────────────────────────

export async function getMetaCampaigns(leads: Lead[], datePreset: MetaDatePreset = "maximum"): Promise<{
  campaigns: MetaCampaign[]
  error: MetaApiError | null
}> {
  const accessToken = process.env.META_ACCESS_TOKEN
  const adAccountId = process.env.META_AD_ACCOUNT_ID

  if (!accessToken || !adAccountId) {
    return {
      campaigns: [],
      error: {
        message: !adAccountId
          ? "META_AD_ACCOUNT_ID não configurado no .env.local"
          : "META_ACCESS_TOKEN não configurado no .env.local",
      },
    }
  }

  try {
    const accountId = adAccountId.startsWith("act_") ? adAccountId : `act_${adAccountId}`
    const url = `https://graph.facebook.com/v21.0/${accountId}/campaigns?fields=id,name,status,objective,daily_budget,lifetime_budget,created_time,updated_time,insights.date_preset(${datePreset}){spend,impressions,clicks,cpc,cpm,ctr,reach,actions}&limit=100&access_token=${accessToken}`

    const res = await fetch(url, { next: { revalidate: 300 } })

    if (!res.ok) {
      const errBody = await res.json().catch(() => null)
      const errMsg = errBody?.error?.message ?? `HTTP ${res.status}`
      console.error("[Meta API] Campaigns fetch failed:", errMsg)
      return {
        campaigns: [],
        error: { message: errMsg, code: errBody?.error?.code },
      }
    }

    const body = await res.json()
    const rawCampaigns = (body.data ?? []) as Array<Record<string, unknown>>

    const campaigns: MetaCampaign[] = rawCampaigns.map((c) => {
      const matchedLeads = leads.filter((lead) => {
        const meta = lead.meta_data as Record<string, unknown> | null
        return meta?.campaign_id === c.id || meta?.campaign_name === c.name
      })

      const insightsRaw = (c.insights as Record<string, unknown>)?.data as Array<Record<string, unknown>> | undefined
      const ins = insightsRaw?.[0]
      const insights = ins ? parseInsights(ins) : undefined
      const leadCount = matchedLeads.length
      const costPerLead = insights && leadCount > 0 ? insights.spend / leadCount : undefined

      return {
        id: c.id as string,
        name: c.name as string,
        status: c.status as string,
        objective: (c.objective as string) ?? "",
        daily_budget: (c.daily_budget as string) ?? null,
        lifetime_budget: (c.lifetime_budget as string) ?? null,
        created_time: c.created_time as string,
        updated_time: c.updated_time as string,
        leadCount,
        insights,
        costPerLead,
      }
    })

    campaigns.sort((a, b) => {
      if (a.status === "ACTIVE" && b.status !== "ACTIVE") return -1
      if (b.status === "ACTIVE" && a.status !== "ACTIVE") return 1
      if (b.leadCount !== a.leadCount) return b.leadCount - a.leadCount
      return new Date(b.updated_time).getTime() - new Date(a.updated_time).getTime()
    })

    return { campaigns, error: null }
  } catch (err) {
    console.error("[Meta API] Campaigns fetch error:", err)
    return {
      campaigns: [],
      error: { message: err instanceof Error ? err.message : "Erro desconhecido" },
    }
  }
}

// ─── Helper: parse insights ─────────────────────────────────────────────────

function parseInsights(ins: Record<string, unknown>): MetaInsights {
  return {
    spend: parseFloat((ins.spend as string) ?? "0"),
    impressions: parseInt((ins.impressions as string) ?? "0", 10),
    clicks: parseInt((ins.clicks as string) ?? "0", 10),
    cpc: parseFloat((ins.cpc as string) ?? "0"),
    cpm: parseFloat((ins.cpm as string) ?? "0"),
    ctr: parseFloat((ins.ctr as string) ?? "0"),
    reach: parseInt((ins.reach as string) ?? "0", 10),
    actions: ins.actions as MetaInsights["actions"],
  }
}

// ─── Ad Sets from Meta Graph API ────────────────────────────────────────────

export async function getMetaAdSets(leads: Lead[], datePreset: MetaDatePreset = "maximum"): Promise<{
  adSets: MetaAdSet[]
  error: MetaApiError | null
}> {
  const accessToken = process.env.META_ACCESS_TOKEN
  const adAccountId = process.env.META_AD_ACCOUNT_ID

  if (!accessToken || !adAccountId) {
    return { adSets: [], error: { message: "Credenciais Meta não configuradas" } }
  }

  try {
    const accountId = adAccountId.startsWith("act_") ? adAccountId : `act_${adAccountId}`
    const url = `https://graph.facebook.com/v21.0/${accountId}/adsets?fields=id,name,status,campaign_id,campaign{name},daily_budget,lifetime_budget,targeting{age_min,age_max,geo_locations},insights.date_preset(${datePreset}){spend,impressions,clicks,cpc,cpm,ctr,reach,actions}&limit=200&access_token=${accessToken}`

    const res = await fetch(url, { next: { revalidate: 300 } })
    if (!res.ok) {
      const errBody = await res.json().catch(() => null)
      return { adSets: [], error: { message: errBody?.error?.message ?? `HTTP ${res.status}` } }
    }

    const body = await res.json()
    const rawAdSets = (body.data ?? []) as Array<Record<string, unknown>>

    const adSets: MetaAdSet[] = rawAdSets.map((as_) => {
      const matchedLeads = leads.filter((lead) => {
        const meta = lead.meta_data as Record<string, unknown> | null
        return meta?.adset_id === as_.id || meta?.adset_name === as_.name
      })

      const insightsRaw = (as_.insights as Record<string, unknown>)?.data as Array<Record<string, unknown>> | undefined
      const ins = insightsRaw?.[0]
      const insights = ins ? parseInsights(ins) : undefined
      const leadCount = matchedLeads.length
      const costPerLead = insights && leadCount > 0 ? insights.spend / leadCount : undefined

      // Build targeting summary
      const targeting = as_.targeting as Record<string, unknown> | undefined
      let targetingSummary: string | null = null
      if (targeting) {
        const parts: string[] = []
        if (targeting.age_min || targeting.age_max) parts.push(`${targeting.age_min ?? "?"}–${targeting.age_max ?? "?"} anos`)
        const geo = targeting.geo_locations as Record<string, unknown> | undefined
        if (geo?.countries) parts.push((geo.countries as string[]).join(", "))
        targetingSummary = parts.length > 0 ? parts.join(" · ") : null
      }

      const campaign = as_.campaign as Record<string, unknown> | undefined

      return {
        id: as_.id as string,
        name: as_.name as string,
        status: as_.status as string,
        campaign_id: as_.campaign_id as string,
        campaign_name: (campaign?.name as string) ?? "",
        daily_budget: (as_.daily_budget as string) ?? null,
        lifetime_budget: (as_.lifetime_budget as string) ?? null,
        targeting_summary: targetingSummary,
        leadCount,
        insights,
        costPerLead,
      }
    })

    adSets.sort((a, b) => {
      if (a.status === "ACTIVE" && b.status !== "ACTIVE") return -1
      if (b.status === "ACTIVE" && a.status !== "ACTIVE") return 1
      return b.leadCount - a.leadCount
    })

    return { adSets, error: null }
  } catch (err) {
    console.error("[Meta API] Ad Sets fetch error:", err)
    return { adSets: [], error: { message: err instanceof Error ? err.message : "Erro desconhecido" } }
  }
}

// ─── Ads from Meta Graph API ────────────────────────────────────────────────

export async function getMetaAds(leads: Lead[], datePreset: MetaDatePreset = "maximum"): Promise<{
  ads: MetaAd[]
  error: MetaApiError | null
}> {
  const accessToken = process.env.META_ACCESS_TOKEN
  const adAccountId = process.env.META_AD_ACCOUNT_ID

  if (!accessToken || !adAccountId) {
    return { ads: [], error: { message: "Credenciais Meta não configuradas" } }
  }

  try {
    const accountId = adAccountId.startsWith("act_") ? adAccountId : `act_${adAccountId}`
    const url = `https://graph.facebook.com/v21.0/${accountId}/ads?fields=id,name,status,campaign_id,campaign{name},adset_id,adset{name},insights.date_preset(${datePreset}){spend,impressions,clicks,cpc,cpm,ctr,reach,actions}&limit=200&access_token=${accessToken}`

    const res = await fetch(url, { next: { revalidate: 300 } })
    if (!res.ok) {
      const errBody = await res.json().catch(() => null)
      return { ads: [], error: { message: errBody?.error?.message ?? `HTTP ${res.status}` } }
    }

    const body = await res.json()
    const rawAds = (body.data ?? []) as Array<Record<string, unknown>>

    const ads: MetaAd[] = rawAds.map((ad) => {
      const matchedLeads = leads.filter((lead) => {
        const meta = lead.meta_data as Record<string, unknown> | null
        return meta?.ad_id === ad.id || meta?.ad_name === ad.name
      })

      const insightsRaw = (ad.insights as Record<string, unknown>)?.data as Array<Record<string, unknown>> | undefined
      const ins = insightsRaw?.[0]
      const insights = ins ? parseInsights(ins) : undefined
      const leadCount = matchedLeads.length
      const costPerLead = insights && leadCount > 0 ? insights.spend / leadCount : undefined

      const campaign = ad.campaign as Record<string, unknown> | undefined
      const adset = ad.adset as Record<string, unknown> | undefined

      return {
        id: ad.id as string,
        name: ad.name as string,
        status: ad.status as string,
        campaign_id: ad.campaign_id as string,
        campaign_name: (campaign?.name as string) ?? "",
        adset_id: ad.adset_id as string,
        adset_name: (adset?.name as string) ?? "",
        leadCount,
        insights,
        costPerLead,
      }
    })

    ads.sort((a, b) => {
      if (a.status === "ACTIVE" && b.status !== "ACTIVE") return -1
      if (b.status === "ACTIVE" && a.status !== "ACTIVE") return 1
      return b.leadCount - a.leadCount
    })

    return { ads, error: null }
  } catch (err) {
    console.error("[Meta API] Ads fetch error:", err)
    return { ads: [], error: { message: err instanceof Error ? err.message : "Erro desconhecido" } }
  }
}

// ─── Single entity fetches from Meta Graph API ──────────────────────────────

export async function getMetaCampaignById(campaignId: string, leads: Lead[], datePreset: MetaDatePreset = "maximum"): Promise<MetaCampaign | null> {
  const accessToken = process.env.META_ACCESS_TOKEN
  if (!accessToken) return null

  try {
    const url = `https://graph.facebook.com/v21.0/${campaignId}?fields=id,name,status,objective,daily_budget,lifetime_budget,created_time,updated_time,insights.date_preset(${datePreset}){spend,impressions,clicks,cpc,cpm,ctr,reach,actions}&access_token=${accessToken}`
    const res = await fetch(url, { next: { revalidate: 300 } })
    if (!res.ok) return null

    const c = await res.json()
    const matchedLeads = leads.filter((lead) => {
      const meta = lead.meta_data as Record<string, unknown> | null
      return meta?.campaign_id === c.id || meta?.campaign_name === c.name
    })
    const insightsRaw = (c.insights as Record<string, unknown>)?.data as Array<Record<string, unknown>> | undefined
    const ins = insightsRaw?.[0]
    const insights = ins ? parseInsights(ins) : undefined
    const leadCount = matchedLeads.length
    const costPerLead = insights && leadCount > 0 ? insights.spend / leadCount : undefined

    return {
      id: c.id as string,
      name: c.name as string,
      status: c.status as string,
      objective: (c.objective as string) ?? "",
      daily_budget: (c.daily_budget as string) ?? null,
      lifetime_budget: (c.lifetime_budget as string) ?? null,
      created_time: c.created_time as string,
      updated_time: c.updated_time as string,
      leadCount,
      insights,
      costPerLead,
    }
  } catch {
    return null
  }
}

export async function getMetaAdSetById(adSetId: string, leads: Lead[], datePreset: MetaDatePreset = "maximum"): Promise<MetaAdSet | null> {
  const accessToken = process.env.META_ACCESS_TOKEN
  if (!accessToken) return null

  try {
    const url = `https://graph.facebook.com/v21.0/${adSetId}?fields=id,name,status,campaign_id,campaign{name},daily_budget,lifetime_budget,targeting{age_min,age_max,geo_locations},insights.date_preset(${datePreset}){spend,impressions,clicks,cpc,cpm,ctr,reach,actions}&access_token=${accessToken}`
    const res = await fetch(url, { next: { revalidate: 300 } })
    if (!res.ok) return null

    const as_ = await res.json()
    const matchedLeads = leads.filter((lead) => {
      const meta = lead.meta_data as Record<string, unknown> | null
      return meta?.adset_id === as_.id || meta?.adset_name === as_.name
    })
    const insightsRaw = (as_.insights as Record<string, unknown>)?.data as Array<Record<string, unknown>> | undefined
    const ins = insightsRaw?.[0]
    const insights = ins ? parseInsights(ins) : undefined
    const leadCount = matchedLeads.length
    const costPerLead = insights && leadCount > 0 ? insights.spend / leadCount : undefined

    const targeting = as_.targeting as Record<string, unknown> | undefined
    let targetingSummary: string | null = null
    if (targeting) {
      const parts: string[] = []
      if (targeting.age_min || targeting.age_max) parts.push(`${targeting.age_min ?? "?"}–${targeting.age_max ?? "?"} anos`)
      const geo = targeting.geo_locations as Record<string, unknown> | undefined
      if (geo?.countries) parts.push((geo.countries as string[]).join(", "))
      targetingSummary = parts.length > 0 ? parts.join(" · ") : null
    }
    const campaign = as_.campaign as Record<string, unknown> | undefined

    return {
      id: as_.id as string,
      name: as_.name as string,
      status: as_.status as string,
      campaign_id: as_.campaign_id as string,
      campaign_name: (campaign?.name as string) ?? "",
      daily_budget: (as_.daily_budget as string) ?? null,
      lifetime_budget: (as_.lifetime_budget as string) ?? null,
      targeting_summary: targetingSummary,
      leadCount,
      insights,
      costPerLead,
    }
  } catch {
    return null
  }
}

export async function getMetaAdById(adId: string, leads: Lead[], datePreset: MetaDatePreset = "maximum"): Promise<MetaAd | null> {
  const accessToken = process.env.META_ACCESS_TOKEN
  if (!accessToken) return null

  try {
    const url = `https://graph.facebook.com/v21.0/${adId}?fields=id,name,status,campaign_id,campaign{name},adset_id,adset{name},insights.date_preset(${datePreset}){spend,impressions,clicks,cpc,cpm,ctr,reach,actions}&access_token=${accessToken}`
    const res = await fetch(url, { next: { revalidate: 300 } })
    if (!res.ok) return null

    const ad = await res.json()
    const matchedLeads = leads.filter((lead) => {
      const meta = lead.meta_data as Record<string, unknown> | null
      return meta?.ad_id === ad.id || meta?.ad_name === ad.name
    })
    const insightsRaw = (ad.insights as Record<string, unknown>)?.data as Array<Record<string, unknown>> | undefined
    const ins = insightsRaw?.[0]
    const insights = ins ? parseInsights(ins) : undefined
    const leadCount = matchedLeads.length
    const costPerLead = insights && leadCount > 0 ? insights.spend / leadCount : undefined

    const campaign = ad.campaign as Record<string, unknown> | undefined
    const adset = ad.adset as Record<string, unknown> | undefined

    return {
      id: ad.id as string,
      name: ad.name as string,
      status: ad.status as string,
      campaign_id: ad.campaign_id as string,
      campaign_name: (campaign?.name as string) ?? "",
      adset_id: ad.adset_id as string,
      adset_name: (adset?.name as string) ?? "",
      leadCount,
      insights,
      costPerLead,
    }
  } catch {
    return null
  }
}

// ─── Ad Creative Preview from Meta Graph API ────────────────────────────────

export interface MetaAdCreative {
  id: string
  thumbnail_url: string | null
  image_url: string | null
  video_url: string | null
  video_source_url: string | null
  title: string | null
  body: string | null
  link_url: string | null
  call_to_action_type: string | null
}

export async function getMetaAdCreative(adId: string): Promise<MetaAdCreative | null> {
  const accessToken = process.env.META_ACCESS_TOKEN
  if (!accessToken) return null

  try {
    const url = `https://graph.facebook.com/v21.0/${adId}?fields=creative{id,thumbnail_url,image_url,object_story_spec,asset_feed_spec}&access_token=${accessToken}`
    const res = await fetch(url, { next: { revalidate: 600 } })
    if (!res.ok) return null

    const data = await res.json()
    const creative = data.creative as Record<string, unknown> | undefined
    if (!creative) return null

    // Extract from object_story_spec (single creative) or asset_feed_spec (dynamic creative)
    const spec = creative.object_story_spec as Record<string, unknown> | undefined
    const linkData = spec?.link_data as Record<string, unknown> | undefined
    const videoData = spec?.video_data as Record<string, unknown> | undefined

    // For dynamic creatives, try asset_feed_spec
    const feedSpec = creative.asset_feed_spec as Record<string, unknown> | undefined
    const feedBodies = feedSpec?.bodies as Array<{ text: string }> | undefined
    const feedTitles = feedSpec?.titles as Array<{ text: string }> | undefined
    const feedLinks = feedSpec?.link_urls as Array<{ website_url: string }> | undefined

    // If there's a video_id, fetch the actual playable source URL
    const videoId = videoData?.video_id as string | undefined
    let videoSourceUrl: string | null = null
    if (videoId) {
      try {
        const videoRes = await fetch(
          `https://graph.facebook.com/v21.0/${videoId}?fields=source&access_token=${accessToken}`,
          { next: { revalidate: 600 } }
        )
        if (videoRes.ok) {
          const videoJson = await videoRes.json()
          videoSourceUrl = (videoJson.source as string) ?? null
        }
      } catch {
        // Fall back to no source URL
      }
    }

    return {
      id: creative.id as string,
      thumbnail_url: (creative.thumbnail_url as string) ?? null,
      image_url: (linkData?.image_url as string) ?? (linkData?.picture as string) ?? null,
      video_url: videoId ? `https://www.facebook.com/watch/?v=${videoId}` : null,
      video_source_url: videoSourceUrl,
      title: (linkData?.name as string) ?? (videoData?.title as string) ?? feedTitles?.[0]?.text ?? null,
      body: (linkData?.message as string) ?? (videoData?.message as string) ?? feedBodies?.[0]?.text ?? null,
      link_url: (linkData?.link as string) ?? feedLinks?.[0]?.website_url ?? null,
      call_to_action_type: ((linkData?.call_to_action as Record<string, unknown>)?.type as string) ??
        ((videoData?.call_to_action as Record<string, unknown>)?.type as string) ??
        ((feedSpec?.call_to_action_types as string[]) ?? [])[0] ?? null,
    }
  } catch {
    return null
  }
}

// ─── Campaign Status Toggle (pause/resume) ──────────────────────────────────

export async function toggleCampaignStatus(
  campaignId: string,
  newStatus: "ACTIVE" | "PAUSED"
): Promise<{ success: boolean; error: string | null }> {
  const accessToken = process.env.META_ACCESS_TOKEN
  if (!accessToken) return { success: false, error: "META_ACCESS_TOKEN não configurado" }

  try {
    const url = `https://graph.facebook.com/v21.0/${campaignId}`
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: newStatus,
        access_token: accessToken,
      }),
    })

    if (!res.ok) {
      const errBody = await res.json().catch(() => null)
      return { success: false, error: errBody?.error?.message ?? `HTTP ${res.status}` }
    }

    revalidatePath("/dashboard/meta-ads")
    return { success: true, error: null }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Erro desconhecido" }
  }
}

// ─── Lead Quality Analysis ──────────────────────────────────────────────────

export interface LeadQualityStats {
  campaignId: string
  campaignName: string
  total: number
  new: number
  contacted: number
  qualified: number
  proposal_sent: number
  negotiation: number
  won: number
  lost: number
  conversionRate: number
  qualificationRate: number
}

export async function getLeadQualityByCampaign(leads: Lead[], campaigns: MetaCampaign[]): Promise<LeadQualityStats[]> {
  return campaigns
    .map((c) => {
      const campaignLeads = leads.filter((lead) => {
        const meta = lead.meta_data as Record<string, unknown> | null
        return meta?.campaign_id === c.id || meta?.campaign_name === c.name
      })
      const total = campaignLeads.length
      if (total === 0) return null

      const counts = {
        new: 0, contacted: 0, qualified: 0,
        proposal_sent: 0, negotiation: 0, won: 0, lost: 0, archived: 0,
      }
      for (const lead of campaignLeads) {
        if (lead.status in counts) counts[lead.status as keyof typeof counts]++
      }

      return {
        campaignId: c.id,
        campaignName: c.name,
        total,
        new: counts.new,
        contacted: counts.contacted,
        qualified: counts.qualified,
        proposal_sent: counts.proposal_sent,
        negotiation: counts.negotiation,
        won: counts.won,
        lost: counts.lost,
        conversionRate: total > 0 ? (counts.won / total) * 100 : 0,
        qualificationRate: total > 0 ? ((counts.qualified + counts.proposal_sent + counts.negotiation + counts.won) / total) * 100 : 0,
      }
    })
    .filter((s): s is LeadQualityStats => s !== null)
    .sort((a, b) => b.conversionRate - a.conversionRate || b.total - a.total)
}

// ─── Create Campaign + Ad Set + Ad ──────────────────────────────────────────

export async function createMetaCampaign(params: {
  name: string
  objective: string
  dailyBudget: number
  targeting: {
    ageMin: number
    ageMax: number
    countries: string[]
    genders?: number[] // 1=male, 2=female
  }
  adCreative: {
    pageId: string
    imageUrl?: string
    videoUrl?: string
    headline: string
    body: string
    linkUrl: string
    callToAction: string
  }
}): Promise<{ success: boolean; campaignId: string | null; error: string | null }> {
  const accessToken = process.env.META_ACCESS_TOKEN
  const adAccountId = process.env.META_AD_ACCOUNT_ID
  if (!accessToken || !adAccountId) {
    return { success: false, campaignId: null, error: "Credenciais Meta não configuradas" }
  }

  const accountId = adAccountId.startsWith("act_") ? adAccountId : `act_${adAccountId}`

  try {
    // 1. Create Campaign
    const campaignRes = await fetch(
      `https://graph.facebook.com/v21.0/${accountId}/campaigns`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: params.name,
          objective: params.objective,
          status: "PAUSED",
          special_ad_categories: [],
          access_token: accessToken,
        }),
      }
    )
    if (!campaignRes.ok) {
      const err = await campaignRes.json().catch(() => null)
      return { success: false, campaignId: null, error: err?.error?.message ?? "Erro ao criar campanha" }
    }
    const campaignData = await campaignRes.json()
    const campaignId = campaignData.id as string

    // 2. Create Ad Set
    const targeting: Record<string, unknown> = {
      age_min: params.targeting.ageMin,
      age_max: params.targeting.ageMax,
      geo_locations: { countries: params.targeting.countries },
    }
    if (params.targeting.genders?.length) {
      targeting.genders = params.targeting.genders
    }

    const adSetRes = await fetch(
      `https://graph.facebook.com/v21.0/${accountId}/adsets`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: `${params.name} — Ad Set`,
          campaign_id: campaignId,
          daily_budget: Math.round(params.dailyBudget * 100),
          billing_event: "IMPRESSIONS",
          optimization_goal: params.objective === "OUTCOME_LEADS" ? "LEAD_GENERATION" : "LINK_CLICKS",
          targeting,
          status: "PAUSED",
          access_token: accessToken,
        }),
      }
    )
    if (!adSetRes.ok) {
      const err = await adSetRes.json().catch(() => null)
      return { success: false, campaignId, error: err?.error?.message ?? "Erro ao criar ad set" }
    }
    const adSetData = await adSetRes.json()
    const adSetId = adSetData.id as string

    // 3. Create Ad Creative
    const storySpec: Record<string, unknown> = {
      page_id: params.adCreative.pageId,
    }

    if (params.adCreative.videoUrl) {
      storySpec.video_data = {
        video_url: params.adCreative.videoUrl,
        title: params.adCreative.headline,
        message: params.adCreative.body,
        link_description: params.adCreative.headline,
        call_to_action: {
          type: params.adCreative.callToAction,
          value: { link: params.adCreative.linkUrl },
        },
      }
    } else {
      storySpec.link_data = {
        image_url: params.adCreative.imageUrl,
        link: params.adCreative.linkUrl,
        message: params.adCreative.body,
        name: params.adCreative.headline,
        call_to_action: {
          type: params.adCreative.callToAction,
          value: { link: params.adCreative.linkUrl },
        },
      }
    }

    const creativeRes = await fetch(
      `https://graph.facebook.com/v21.0/${accountId}/adcreatives`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: `${params.name} — Creative`,
          object_story_spec: storySpec,
          access_token: accessToken,
        }),
      }
    )
    if (!creativeRes.ok) {
      const err = await creativeRes.json().catch(() => null)
      return { success: false, campaignId, error: err?.error?.message ?? "Erro ao criar criativo" }
    }
    const creativeData = await creativeRes.json()
    const creativeId = creativeData.id as string

    // 4. Create Ad
    const adRes = await fetch(
      `https://graph.facebook.com/v21.0/${accountId}/ads`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: `${params.name} — Ad`,
          adset_id: adSetId,
          creative: { creative_id: creativeId },
          status: "PAUSED",
          access_token: accessToken,
        }),
      }
    )
    if (!adRes.ok) {
      const err = await adRes.json().catch(() => null)
      return { success: false, campaignId, error: err?.error?.message ?? "Erro ao criar anúncio" }
    }

    revalidatePath("/dashboard/meta-ads")
    return { success: true, campaignId, error: null }
  } catch (err) {
    return { success: false, campaignId: null, error: err instanceof Error ? err.message : "Erro desconhecido" }
  }
}

// ─── Get Facebook Pages (for ad creative page_id) ───────────────────────────

export interface MetaPage {
  id: string
  name: string
}

export async function getMetaPages(): Promise<MetaPage[]> {
  const accessToken = process.env.META_USER_ACCESS_TOKEN || process.env.META_ACCESS_TOKEN
  if (!accessToken) return []

  try {
    let pagesRes = await fetch(
      `https://graph.facebook.com/v21.0/me/accounts?fields=id,name&access_token=${accessToken}`,
      { next: { revalidate: 3600 } }
    )

    if (!pagesRes.ok) {
      const appId = process.env.META_APP_ID
      const appSecret = process.env.META_APP_SECRET
      if (appId && appSecret) {
        const debugRes = await fetch(
          `https://graph.facebook.com/v21.0/debug_token?input_token=${accessToken}&access_token=${appId}|${appSecret}`
        )
        if (debugRes.ok) {
          const debugData = await debugRes.json()
          const userId = debugData?.data?.user_id as string | undefined
          if (userId) {
            pagesRes = await fetch(
              `https://graph.facebook.com/v21.0/${userId}/accounts?fields=id,name&access_token=${accessToken}`,
              { next: { revalidate: 3600 } }
            )
          }
        }
      }
    }

    if (!pagesRes.ok) return []
    const body = await pagesRes.json()
    return (body.data ?? []).map((p: Record<string, string>) => ({ id: p.id, name: p.name }))
  } catch {
    return []
  }
}

// ─── Sync leads from Meta Graph API into Supabase ─────────────────────────────

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

export async function syncMetaLeads(): Promise<{
  synced: number
  skipped: number
  error: string | null
}> {
  const accessToken = process.env.META_ACCESS_TOKEN
  const adAccountId = process.env.META_AD_ACCOUNT_ID

  if (!accessToken || !adAccountId) {
    return { synced: 0, skipped: 0, error: "META_ACCESS_TOKEN ou META_AD_ACCOUNT_ID não configurado" }
  }

  const admin = createAdminClient()
  const accountId = adAccountId.startsWith("act_") ? adAccountId : `act_${adAccountId}`

  try {
    // 1. Get all ads for this account (with their campaign/adset info)
    const adsUrl = `https://graph.facebook.com/v21.0/${accountId}/ads?fields=id,name,campaign_id,campaign{name},adset_id,adset{name}&limit=200&access_token=${accessToken}`
    const adsRes = await fetch(adsUrl, { cache: "no-store" })
    if (!adsRes.ok) {
      const err = await adsRes.json().catch(() => null)
      return { synced: 0, skipped: 0, error: err?.error?.message ?? `Ads fetch failed: HTTP ${adsRes.status}` }
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
      return { synced: 0, skipped: 0, error: "Nenhum anúncio encontrado na conta" }
    }

    console.log(`[Meta Sync] Found ${ads.length} ads in account`)

    // 2. Get existing meta lead IDs to avoid duplicates
    const { data: existingLeads } = await admin
      .from("leads")
      .select("meta_data")
      .in("origem", ["meta_ads", "meta_lead_ad"])

    const existingMetaIds = new Set(
      (existingLeads ?? [])
        .map((l) => (l.meta_data as Record<string, unknown>)?.meta_lead_id as string)
        .filter(Boolean)
    )

    // 3. Fetch leads from each ad
    let synced = 0
    let skipped = 0

    for (const ad of ads) {
      const leadsUrl = `https://graph.facebook.com/v21.0/${ad.id}/leads?fields=id,created_time,field_data,ad_id,ad_name,adset_id,adset_name,campaign_id,campaign_name,form_id,form_name,platform,is_organic&limit=500&access_token=${accessToken}`
      const leadsRes = await fetch(leadsUrl, { cache: "no-store" })

      if (!leadsRes.ok) {
        const errBody = await leadsRes.json().catch(() => null)
        console.warn(`[Meta Sync] Ad ${ad.id} (${ad.name}) leads fetch failed:`, errBody?.error?.message ?? leadsRes.status)
        continue
      }

      const leadsBody = await leadsRes.json()
      const metaLeads = (leadsBody.data ?? []) as MetaLeadRaw[]
      console.log(`[Meta Sync] Ad ${ad.id} (${ad.name}): ${metaLeads.length} leads found`)

      for (const ml of metaLeads) {
        // Skip if already synced
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

        // Collect any custom/extra fields not already mapped — stored in meta_data, not notes
        const knownFields = new Set([
          "full_name", "nome_completo", "first_name", "last_name",
          "email", "e-mail", "phone_number", "phone", "número_de_telefone", "numero_de_telefone", "telefone",
          "company_name", "empresa", "nome_da_empresa",
          "job_title", "cargo",
          "city", "cidade", "state", "estado",
          "zip_code", "codigo_postal", "código_postal", "country", "pais", "país",
          "street_address", "morada",
        ])
        const extraFields: Record<string, string> = {}
        for (const fd of ml.field_data ?? []) {
          if (!knownFields.has(fd.name) && fd.values?.[0]) {
            extraFields[fd.name] = fd.values[0]
          }
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error: insertError } = await (admin.from("leads") as any).insert({
          nome: fullName,
          full_name: fullName,
          email: email || null,
          telemovel: phone || null,
          empresa: companyName || null,
          origem: "meta_ads",
          forma_contacto: ml.form_name ?? ad.name,
          estado: "novo",
          observacoes: null,
          localidade: city || null,
          distrito: state || null,
          codigo_postal: zipCode || null,
          pais: country || null,
          morada: streetAddress || null,
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
            field_data: ml.field_data ?? [],
            extra_fields: Object.keys(extraFields).length > 0 ? extraFields : undefined,
            synced_at: new Date().toISOString(),
          },
          created_at: ml.created_time,
        })

        if (!insertError) {
          existingMetaIds.add(ml.id)
          synced++
          // Send email notification for each new lead
          emailNewLead(fullName, `Meta Ads — ${ml.form_name ?? ad.name}`, email, phone)
        } else {
          console.error(`[Meta Sync] Insert failed for lead ${ml.id}:`, insertError.message)
        }
      }
    }

    revalidatePath("/dashboard/meta-ads")
    revalidatePath("/dashboard/leads")
    return { synced, skipped, error: null }
  } catch (err) {
    console.error("[Meta API] Sync error:", err)
    return { synced: 0, skipped: 0, error: err instanceof Error ? err.message : "Erro desconhecido" }
  }
}

