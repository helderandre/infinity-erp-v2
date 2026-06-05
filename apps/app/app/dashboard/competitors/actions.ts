"use server"

import { createAdminClient } from "@/lib/supabase/admin"

// ─── Types ───────────────────────────────────────────────────────────────────

export interface SavedCompetitor {
  id: string
  username: string
  display_name: string | null
  profile_pic_url: string | null
  followers_count: number
  media_count: number
  last_synced_at: string | null
  created_at: string
}

export interface CompetitorProfile {
  username: string
  name: string | null
  biography: string | null
  profile_pic_url: string | null
  followers_count: number
  follows_count: number
  media_count: number
  website: string | null
  recent_media: Array<{
    id: string
    caption: string | null
    media_url: string | null
    thumbnail_url: string | null
    media_type: string
    timestamp: string
    like_count: number
    comments_count: number
  }>
}

export interface AdLibraryAd {
  id: string
  ad_creative_body: string | null
  ad_creative_link_title: string | null
  ad_creative_link_caption: string | null
  ad_creative_link_description: string | null
  page_name: string | null
  ad_snapshot_url: string | null
  ad_delivery_start_time: string | null
  ad_delivery_stop_time: string | null
  publisher_platforms: string[]
  impressions: { lower_bound: string; upper_bound: string } | null
  spend: { lower_bound: string; upper_bound: string } | null
  currency: string | null
}

// ─── CRUD ────────────────────────────────────────────────────────────────────

export async function getSavedCompetitors(): Promise<SavedCompetitor[]> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from("competitors")
    .select("*")
    .order("created_at", { ascending: false })

  if (error) {
    console.error("[Competitors] Error fetching:", error.message)
    return []
  }

  return (data ?? []) as SavedCompetitor[]
}

export async function addCompetitor(
  username: string,
  notes?: string,
): Promise<{ competitor: SavedCompetitor | null; error: string | null }> {
  const supabase = createAdminClient()
  const cleanUsername = username.replace(/^@/, "").trim().toLowerCase()

  if (!cleanUsername) {
    return { competitor: null, error: "Username inválido" }
  }

  // Fetch profile info from Instagram Graph API
  const profile = await fetchCompetitorProfile(cleanUsername)

  const { data, error } = await supabase
    .from("competitors")
    .insert({
      username: cleanUsername,
      display_name: profile.profile?.name ?? null,
      profile_pic_url: profile.profile?.profile_pic_url ?? null,
      followers_count: profile.profile?.followers_count ?? 0,
      media_count: profile.profile?.media_count ?? 0,
      last_synced_at: new Date().toISOString(),
    })
    .select()
    .single()

  if (error) {
    if (error.code === "23505") {
      return { competitor: null, error: "Este concorrente já foi adicionado" }
    }
    return { competitor: null, error: error.message }
  }

  return { competitor: data as SavedCompetitor, error: null }
}

export async function removeCompetitor(
  id: string,
): Promise<{ error: string | null }> {
  const supabase = createAdminClient()
  const { error } = await supabase.from("competitors").delete().eq("id", id)

  if (error) return { error: error.message }
  return { error: null }
}

export async function refreshCompetitorSnapshot(
  id: string,
  username: string,
): Promise<{ snapshot: SavedCompetitor | null; error: string | null }> {
  const profile = await fetchCompetitorProfile(username)

  if (profile.error || !profile.profile) {
    return { snapshot: null, error: profile.error ?? "Perfil não encontrado" }
  }

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from("competitors")
    .update({
      display_name: profile.profile.name,
      profile_pic_url: profile.profile.profile_pic_url,
      followers_count: profile.profile.followers_count,
      media_count: profile.profile.media_count,
      last_synced_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .single()

  if (error) return { snapshot: null, error: error.message }
  return { snapshot: data as SavedCompetitor, error: null }
}

// ─── Instagram Graph API ─────────────────────────────────────────────────────

export async function fetchCompetitorProfile(
  username: string,
): Promise<{ profile: CompetitorProfile | null; error: string | null }> {
  const accessToken = process.env.META_PAGE_ACCESS_TOKEN ?? process.env.INSTAGRAM_ACCESS_TOKEN
  const igAccountId = process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID

  if (!accessToken || !igAccountId) {
    return { profile: null, error: "Credenciais Instagram em falta" }
  }

  try {
    // Search for the business account by username
    const searchRes = await fetch(
      `https://graph.facebook.com/v21.0/${igAccountId}?fields=business_discovery.fields(username,name,biography,profile_picture_url,followers_count,follows_count,media_count,website,media.limit(12){id,caption,media_url,thumbnail_url,media_type,timestamp,like_count,comments_count}).username(${username})&access_token=${accessToken}`,
      { cache: "no-store" },
    )

    if (!searchRes.ok) {
      const err = await searchRes.json().catch(() => null)
      return {
        profile: null,
        error: err?.error?.message ?? `HTTP ${searchRes.status}`,
      }
    }

    const body = await searchRes.json()
    const bd = body.business_discovery

    if (!bd) {
      return { profile: null, error: "Perfil não encontrado" }
    }

    const profile: CompetitorProfile = {
      username: bd.username,
      name: bd.name ?? null,
      biography: bd.biography ?? null,
      profile_pic_url: bd.profile_picture_url ?? null,
      followers_count: bd.followers_count ?? 0,
      follows_count: bd.follows_count ?? 0,
      media_count: bd.media_count ?? 0,
      website: bd.website ?? null,
      recent_media: (bd.media?.data ?? []).map((m: Record<string, unknown>) => ({
        id: m.id as string,
        caption: (m.caption as string) ?? null,
        media_url: (m.media_url as string) ?? null,
        thumbnail_url: (m.thumbnail_url as string) ?? null,
        media_type: (m.media_type as string) ?? "IMAGE",
        timestamp: (m.timestamp as string) ?? "",
        like_count: (m.like_count as number) ?? 0,
        comments_count: (m.comments_count as number) ?? 0,
      })),
    }

    return { profile, error: null }
  } catch (err) {
    return {
      profile: null,
      error: err instanceof Error ? err.message : "Erro desconhecido",
    }
  }
}

// ─── Meta Ad Library ─────────────────────────────────────────────────────────

export async function searchAdLibrary(params: {
  search_terms?: string
  ad_reached_countries?: string
  search_page_ids?: string
  limit?: number
}): Promise<{ ads: AdLibraryAd[]; error: string | null }> {
  const accessToken = process.env.META_PAGE_ACCESS_TOKEN ?? process.env.META_ACCESS_TOKEN

  if (!accessToken) {
    return { ads: [], error: "META_ACCESS_TOKEN em falta" }
  }

  try {
    const searchParams = new URLSearchParams({
      access_token: accessToken,
      ad_type: "ALL",
      ad_reached_countries: params.ad_reached_countries ?? '["PT"]',
      fields:
        "id,ad_creative_bodies,ad_creative_link_titles,ad_creative_link_captions,ad_creative_link_descriptions,page_name,ad_snapshot_url,ad_delivery_start_time,ad_delivery_stop_time,publisher_platforms,impressions,spend,currency",
      limit: String(params.limit ?? 25),
    })

    if (params.search_terms) {
      searchParams.set("search_terms", params.search_terms)
    }
    if (params.search_page_ids) {
      searchParams.set("search_page_ids", params.search_page_ids)
    }

    const res = await fetch(
      `https://graph.facebook.com/v21.0/ads_archive?${searchParams.toString()}`,
      { cache: "no-store" },
    )

    if (!res.ok) {
      const err = await res.json().catch(() => null)
      return { ads: [], error: err?.error?.message ?? `HTTP ${res.status}` }
    }

    const body = await res.json()
    const ads: AdLibraryAd[] = (body.data ?? []).map(
      (a: Record<string, unknown>) => ({
        id: (a.id as string) ?? "",
        ad_creative_body: ((a.ad_creative_bodies as string[]) ?? [])[0] ?? null,
        ad_creative_link_title:
          ((a.ad_creative_link_titles as string[]) ?? [])[0] ?? null,
        ad_creative_link_caption:
          ((a.ad_creative_link_captions as string[]) ?? [])[0] ?? null,
        ad_creative_link_description:
          ((a.ad_creative_link_descriptions as string[]) ?? [])[0] ?? null,
        page_name: (a.page_name as string) ?? null,
        ad_snapshot_url: (a.ad_snapshot_url as string) ?? null,
        ad_delivery_start_time:
          (a.ad_delivery_start_time as string) ?? null,
        ad_delivery_stop_time:
          (a.ad_delivery_stop_time as string) ?? null,
        publisher_platforms:
          (a.publisher_platforms as string[]) ?? [],
        impressions: (a.impressions as AdLibraryAd["impressions"]) ?? null,
        spend: (a.spend as AdLibraryAd["spend"]) ?? null,
        currency: (a.currency as string) ?? null,
      }),
    )

    return { ads, error: null }
  } catch (err) {
    return {
      ads: [],
      error: err instanceof Error ? err.message : "Erro desconhecido",
    }
  }
}
