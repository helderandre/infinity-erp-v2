"use server"

import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"

// ─── Types ───────────────────────────────────────────────────────────────────

export interface IGMedia {
  id: string
  media_type: "IMAGE" | "VIDEO" | "CAROUSEL_ALBUM" | "REELS"
  media_url: string | null
  thumbnail_url: string | null
  permalink: string
  caption: string | null
  timestamp: string
  like_count: number
  comments_count: number
  impressions: number
  reach: number
  saved: number
  shares: number
  plays: number
  engagement: number
  engagement_rate: number
  account_name: string
}

export interface IGComment {
  id: string
  text: string
  username: string
  timestamp: string
  like_count: number
  replies?: IGComment[]
  media_id: string
  media_permalink?: string
  media_caption?: string
  sentiment?: "positive" | "neutral" | "negative"
  account_name: string
}

export interface IGProfile {
  id: string
  name: string
  username: string
  biography: string | null
  website: string | null
  profile_picture_url: string | null
  followers_count: number
  follows_count: number
  media_count: number
  account_name: string
}

export interface ScheduledPost {
  id: string
  caption: string
  media_url: string | null
  media_type: "IMAGE" | "VIDEO" | "CAROUSEL_ALBUM" | "REELS"
  scheduled_for: string | null
  scheduled_at?: string // alias for scheduled_for (compat)
  status: "scheduled" | "published" | "failed"
  published_at: string | null
  ig_container_id: string | null
  published_post_id: string | null
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

interface IGAccount {
  igAccountId: string
  pageId: string
  accessToken: string
  pageAccessToken: string
  pageName: string
}

async function getIGAccounts(): Promise<IGAccount[]> {
  const accessToken = process.env.META_USER_ACCESS_TOKEN || process.env.META_ACCESS_TOKEN
  if (!accessToken) return []

  try {
    // First try /me/accounts — include access_token field to get page tokens
    let pagesRes = await fetch(
      `https://graph.facebook.com/v21.0/me/accounts?fields=id,name,access_token,instagram_business_account&access_token=${accessToken}`,
      { next: { revalidate: 3600 } }
    )

    // If /me fails (system user tokens), try debug_token to get user_id
    if (!pagesRes.ok) {
      const appId = process.env.META_APP_ID
      const appSecret = process.env.META_APP_SECRET
      if (appId && appSecret) {
        const debugRes = await fetch(
          `https://graph.facebook.com/v21.0/debug_token?input_token=${accessToken}&access_token=${appId}|${appSecret}`,
          { next: { revalidate: 86400 } }
        )
        if (debugRes.ok) {
          const debugData = await debugRes.json()
          const userId = debugData?.data?.user_id as string | undefined
          if (userId) {
            pagesRes = await fetch(
              `https://graph.facebook.com/v21.0/${userId}/accounts?fields=id,name,access_token,instagram_business_account&access_token=${accessToken}`,
              { next: { revalidate: 3600 } }
            )
          }
        }
      }
    }

    if (!pagesRes.ok) return []
    const pages = await pagesRes.json()
    const pagesData = (pages.data ?? []) as Array<Record<string, unknown>>

    return pagesData
      .filter((p) => p.instagram_business_account)
      .map((p) => ({
        igAccountId: (p.instagram_business_account as Record<string, string>).id,
        pageId: p.id as string,
        accessToken,
        pageAccessToken: (p.access_token as string) ?? accessToken,
        pageName: (p.name as string) ?? "Unknown",
      }))
  } catch {
    return []
  }
}

// Backwards-compatible: returns first account
async function getIGAccountId(): Promise<{ igAccountId: string; accessToken: string } | null> {
  const accounts = await getIGAccounts()
  return accounts[0] ?? null
}

// ─── Profile ─────────────────────────────────────────────────────────────────

export async function getIGProfiles(): Promise<IGProfile[]> {
  const accounts = await getIGAccounts()
  if (accounts.length === 0) return []

  const profiles = await Promise.all(
    accounts.map(async (account) => {
      try {
        const res = await fetch(
          `https://graph.facebook.com/v21.0/${account.igAccountId}?fields=id,name,username,biography,website,profile_picture_url,followers_count,follows_count,media_count&access_token=${account.accessToken}`,
          { next: { revalidate: 600 } }
        )
        if (!res.ok) return null
        const data = await res.json()
        return {
          id: data.id,
          name: data.name ?? data.username,
          username: data.username,
          biography: data.biography ?? null,
          website: data.website ?? null,
          profile_picture_url: data.profile_picture_url ?? null,
          followers_count: data.followers_count ?? 0,
          follows_count: data.follows_count ?? 0,
          media_count: data.media_count ?? 0,
          account_name: account.pageName,
        } as IGProfile
      } catch {
        return null
      }
    })
  )

  return profiles.filter((p): p is IGProfile => p !== null)
}

// ─── Media (Posts + Reels) with insights ─────────────────────────────────────

async function fetchMediaForAccount(account: IGAccount, limit: number): Promise<IGMedia[]> {
  // Fetch followers_count as fallback denominator for ER
  let followersCount = 0
  try {
    const profileRes = await fetch(
      `https://graph.facebook.com/v21.0/${account.igAccountId}?fields=followers_count&access_token=${account.accessToken}`,
      { next: { revalidate: 600 } }
    )
    if (profileRes.ok) {
      const profileData = await profileRes.json()
      followersCount = (profileData.followers_count as number) ?? 0
    }
  } catch { /* ignore */ }

  const res = await fetch(
    `https://graph.facebook.com/v21.0/${account.igAccountId}/media?fields=id,media_type,media_url,thumbnail_url,permalink,caption,timestamp,like_count,comments_count&limit=${limit}&access_token=${account.accessToken}`,
    { next: { revalidate: 300 } }
  )
  if (!res.ok) return []

  const body = await res.json()
  const rawMedia = (body.data ?? []) as Array<Record<string, unknown>>

  return Promise.all(
    rawMedia.map(async (m) => {
      const mediaType = m.media_type as string
      let impressions = 0, reach = 0, saved = 0, shares = 0, plays = 0

      try {
        const isVideo = mediaType === "REELS" || mediaType === "VIDEO"
        const metrics = isVideo
          ? "reach,saved,likes,comments,shares,total_interactions,views"
          : "reach,saved,likes,comments,shares,total_interactions"

        const insRes = await fetch(
          `https://graph.facebook.com/v21.0/${m.id}/insights?metric=${metrics}&access_token=${account.accessToken}`,
          { next: { revalidate: 300 } }
        )
        if (insRes.ok) {
          const insBody = await insRes.json()
          if (!insBody.error) {
            const insData = (insBody.data ?? []) as Array<{ name: string; values: Array<{ value: number }> }>
            for (const metric of insData) {
              const val = metric.values?.[0]?.value ?? 0
              switch (metric.name) {
                case "reach": reach = val; break
                case "saved": saved = val; break
                case "shares": shares = val; break
                case "views": plays = val; break
                case "total_interactions": impressions = val; break
              }
            }
          }
        }
      } catch { /* ignore */ }

      const likeCount = (m.like_count as number) ?? 0
      const commentsCount = (m.comments_count as number) ?? 0
      const engagement = likeCount + commentsCount + saved + shares
      const erDenominator = reach > 0 ? reach : followersCount
      const engagementRate = erDenominator > 0 ? (engagement / erDenominator) * 100 : 0

      return {
        id: m.id as string,
        media_type: mediaType as IGMedia["media_type"],
        media_url: (m.media_url as string) ?? null,
        thumbnail_url: (m.thumbnail_url as string) ?? null,
        permalink: m.permalink as string,
        caption: (m.caption as string) ?? null,
        timestamp: m.timestamp as string,
        like_count: likeCount,
        comments_count: commentsCount,
        impressions,
        reach,
        saved,
        shares,
        plays,
        engagement,
        engagement_rate: engagementRate,
        account_name: account.pageName,
      }
    })
  )
}

export async function getIGMedia(limit = 50): Promise<{
  media: IGMedia[]
  error: string | null
}> {
  const accounts = await getIGAccounts()
  if (accounts.length === 0) return { media: [], error: "Conta Instagram não encontrada. Verifica a ligação Meta." }

  try {
    const allMedia = await Promise.all(
      accounts.map((account) => fetchMediaForAccount(account, limit))
    )
    const media = allMedia.flat().sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

    const hasInsights = media.some((m) => m.reach > 0 || m.plays > 0)
    const warning = !hasInsights && media.length > 0
      ? "Métricas detalhadas indisponíveis — o token Meta pode estar expirado."
      : null

    return { media, error: warning }
  } catch (err) {
    return { media: [], error: err instanceof Error ? err.message : "Erro desconhecido" }
  }
}

// ─── Comments ────────────────────────────────────────────────────────────────

const NEGATIVE_WORDS = [
  "mau", "péssimo", "horrível", "terrível", "fraude", "scam", "roubo",
  "lixo", "nojo", "vergonha", "nunca mais", "não recomendo", "pior",
  "bad", "terrible", "awful", "horrible", "worst", "scam", "fake",
  "hate", "disappointed", "disappointing", "waste", "garbage", "trash",
]

const POSITIVE_WORDS = [
  "excelente", "fantástico", "incrível", "ótimo", "maravilhoso", "recomendo",
  "top", "perfeito", "adorei", "melhor", "parabéns", "obrigado",
  "amazing", "great", "excellent", "perfect", "love", "wonderful",
  "awesome", "best", "recommend", "thanks", "beautiful",
]

function analyzeSentiment(text: string): "positive" | "neutral" | "negative" {
  const lower = text.toLowerCase()
  const hasNegative = NEGATIVE_WORDS.some((w) => lower.includes(w))
  const hasPositive = POSITIVE_WORDS.some((w) => lower.includes(w))
  if (hasNegative && !hasPositive) return "negative"
  if (hasPositive && !hasNegative) return "positive"
  return "neutral"
}

export async function getIGComments(mediaIds?: string[]): Promise<{
  comments: IGComment[]
  error: string | null
}> {
  const accounts = await getIGAccounts()
  if (accounts.length === 0) return { comments: [], error: "Conta Instagram não encontrada." }

  try {
    const allComments: IGComment[] = []

    await Promise.all(
      accounts.map(async (account) => {
        // Get recent media for this account
        let targetIds = mediaIds
        if (!targetIds || targetIds.length === 0) {
          const res = await fetch(
            `https://graph.facebook.com/v21.0/${account.igAccountId}/media?fields=id&limit=25&access_token=${account.accessToken}`,
            { next: { revalidate: 300 } }
          )
          if (!res.ok) return
          const body = await res.json()
          const media = (body.data ?? []) as Array<Record<string, string>>
          targetIds = media.map((m) => m.id)
        }

        await Promise.all(
          targetIds.map(async (mediaId) => {
            try {
              const res = await fetch(
                `https://graph.facebook.com/v21.0/${mediaId}?fields=permalink,caption,comments{id,text,username,timestamp,like_count,replies{id,text,username,timestamp,like_count}}&access_token=${account.accessToken}`,
                { next: { revalidate: 300 } }
              )
              if (!res.ok) return
              const data = await res.json()
              const comments = (data.comments?.data ?? []) as Array<Record<string, unknown>>

              for (const c of comments) {
                const replies = ((c.replies as Record<string, unknown>)?.data as Array<Record<string, unknown>> ?? []).map((r) => ({
                  id: r.id as string,
                  text: r.text as string,
                  username: r.username as string,
                  timestamp: r.timestamp as string,
                  like_count: (r.like_count as number) ?? 0,
                  media_id: mediaId,
                  sentiment: analyzeSentiment(r.text as string),
                  account_name: account.pageName,
                }))

                allComments.push({
                  id: c.id as string,
                  text: c.text as string,
                  username: c.username as string,
                  timestamp: c.timestamp as string,
                  like_count: (c.like_count as number) ?? 0,
                  replies: replies.length > 0 ? replies : undefined,
                  media_id: mediaId,
                  media_permalink: data.permalink as string,
                  media_caption: (data.caption as string)?.slice(0, 80) ?? undefined,
                  sentiment: analyzeSentiment(c.text as string),
                  account_name: account.pageName,
                })
              }
            } catch { /* skip */ }
          })
        )
      })
    )

    allComments.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    return { comments: allComments, error: null }
  } catch (err) {
    return { comments: [], error: err instanceof Error ? err.message : "Erro desconhecido" }
  }
}

// ─── Reply to comment ────────────────────────────────────────────────────────

export async function replyToComment(
  commentId: string,
  message: string
): Promise<{ success: boolean; error: string | null }> {
  const accessToken = process.env.META_USER_ACCESS_TOKEN || process.env.META_ACCESS_TOKEN
  if (!accessToken) return { success: false, error: "META_ACCESS_TOKEN não configurado" }

  try {
    const res = await fetch(
      `https://graph.facebook.com/v21.0/${commentId}/replies`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message,
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

// ─── Content Publishing (Schedule) ───────────────────────────────────────────

export async function publishIGMedia(params: {
  imageUrl?: string
  videoUrl?: string
  caption: string
  mediaType: "IMAGE" | "VIDEO" | "REELS"
}): Promise<{ success: boolean; mediaId: string | null; error: string | null }> {
  const account = await getIGAccountId()
  if (!account) return { success: false, mediaId: null, error: "Conta Instagram não encontrada." }

  try {
    // Step 1: Create media container
    const containerParams: Record<string, string> = {
      caption: params.caption,
      access_token: account.accessToken,
    }

    if (params.mediaType === "IMAGE" && params.imageUrl) {
      containerParams.image_url = params.imageUrl
    } else if ((params.mediaType === "VIDEO" || params.mediaType === "REELS") && params.videoUrl) {
      containerParams.video_url = params.videoUrl
      containerParams.media_type = params.mediaType
    } else {
      return { success: false, mediaId: null, error: "URL de média em falta" }
    }

    const createRes = await fetch(
      `https://graph.facebook.com/v21.0/${account.igAccountId}/media`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(containerParams),
      }
    )
    if (!createRes.ok) {
      const errBody = await createRes.json().catch(() => null)
      return { success: false, mediaId: null, error: errBody?.error?.message ?? "Erro ao criar container" }
    }
    const createData = await createRes.json()
    const containerId = createData.id as string

    // Step 2: Publish the container
    const publishRes = await fetch(
      `https://graph.facebook.com/v21.0/${account.igAccountId}/media_publish`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          creation_id: containerId,
          access_token: account.accessToken,
        }),
      }
    )
    if (!publishRes.ok) {
      const errBody = await publishRes.json().catch(() => null)
      return { success: false, mediaId: null, error: errBody?.error?.message ?? "Erro ao publicar" }
    }
    const publishData = await publishRes.json()
    return { success: true, mediaId: publishData.id as string, error: null }
  } catch (err) {
    return { success: false, mediaId: null, error: err instanceof Error ? err.message : "Erro desconhecido" }
  }
}

// ─── File Upload to Supabase Storage ────────────────────────────────────────

export async function uploadIGMedia(formData: FormData): Promise<{
  publicUrl: string | null
  storagePath: string | null
  error: string | null
}> {
  const file = formData.get("file") as File | null
  if (!file) return { publicUrl: null, storagePath: null, error: "Ficheiro em falta" }

  const supabase = createAdminClient()
  const ext = file.name.split(".").pop() ?? "jpg"
  const storagePath = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`

  const { error: uploadError } = await supabase.storage
    .from("ig-media")
    .upload(storagePath, file, { cacheControl: "3600", upsert: false })

  if (uploadError) return { publicUrl: null, storagePath: null, error: uploadError.message }

  const { data: urlData } = supabase.storage
    .from("ig-media")
    .getPublicUrl(storagePath)

  return { publicUrl: urlData.publicUrl, storagePath, error: null }
}

// ─── Publish with file upload ───────────────────────────────────────────────

export async function publishIGMediaWithUpload(formData: FormData): Promise<{
  success: boolean
  mediaId: string | null
  error: string | null
}> {
  const caption = formData.get("caption") as string
  const mediaType = formData.get("mediaType") as "IMAGE" | "REELS"
  const mediaUrl = formData.get("mediaUrl") as string | null
  const file = formData.get("file") as File | null

  if (!caption?.trim()) return { success: false, mediaId: null, error: "Legenda em falta" }

  let finalUrl = mediaUrl?.trim() || null

  // If a file was uploaded, store it and get the public URL
  if (file && file.size > 0) {
    const uploadForm = new FormData()
    uploadForm.set("file", file)
    const upload = await uploadIGMedia(uploadForm)
    if (upload.error) return { success: false, mediaId: null, error: upload.error }
    finalUrl = upload.publicUrl
  }

  if (!finalUrl) return { success: false, mediaId: null, error: "Imagem/vídeo em falta" }

  return publishIGMedia({
    caption: caption.trim(),
    mediaType,
    ...(mediaType === "IMAGE" ? { imageUrl: finalUrl } : { videoUrl: finalUrl }),
  })
}

// ─── Scheduled Posts ────────────────────────────────────────────────────────

export interface ScheduledPostRow {
  id: string
  caption: string | null
  media_url: string | null
  media_type: string | null
  scheduled_for: string | null
  status: string | null
  published_at: string | null
  ig_container_id: string | null
  published_post_id: string | null
  error_message: string | null
  platform: string | null
  created_by: string | null
  created_at: string
  updated_at: string | null
}

export async function getScheduledPosts(): Promise<{
  posts: ScheduledPostRow[]
  error: string | null
}> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("scheduled_posts")
    .select("*")
    .order("scheduled_for", { ascending: true })

  if (error) return { posts: [], error: error.message }
  return { posts: (data ?? []) as ScheduledPostRow[], error: null }
}

export async function createScheduledPost(formData: FormData): Promise<{
  success: boolean
  error: string | null
}> {
  const caption = formData.get("caption") as string
  const mediaType = formData.get("mediaType") as "IMAGE" | "REELS"
  const scheduledAt = formData.get("scheduledAt") as string
  const file = formData.get("file") as File | null
  const mediaUrl = formData.get("mediaUrl") as string | null

  if (!caption?.trim()) return { success: false, error: "Legenda em falta" }
  if (!scheduledAt) return { success: false, error: "Data de agendamento em falta" }

  let finalUrl = mediaUrl?.trim() || null
  let storagePath: string | null = null

  if (file && file.size > 0) {
    const uploadForm = new FormData()
    uploadForm.set("file", file)
    const upload = await uploadIGMedia(uploadForm)
    if (upload.error) return { success: false, error: upload.error }
    finalUrl = upload.publicUrl
    storagePath = upload.storagePath
  }

  if (!finalUrl) return { success: false, error: "Imagem/vídeo em falta" }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { error } = await supabase.from("scheduled_posts").insert({
    caption: caption.trim(),
    media_url: finalUrl,
    media_type: mediaType,
    scheduled_for: scheduledAt,
    created_by: user?.id ?? null,
  })

  if (error) return { success: false, error: error.message }
  return { success: true, error: null }
}

// ─── Audience Demographics ───────────────────────────────────────────────────

export interface IGDemographics {
  cities: Array<{ name: string; value: number }>
  countries: Array<{ name: string; value: number }>
  genderAge: Array<{ label: string; value: number }>
  locales: Array<{ name: string; value: number }>
}

export async function getIGDemographics(): Promise<{
  demographics: IGDemographics | null
  error: string | null
}> {
  const account = await getIGAccountId()
  if (!account) return { demographics: null, error: "Conta Instagram não encontrada." }

  try {
    const res = await fetch(
      `https://graph.facebook.com/v21.0/${account.igAccountId}/insights?metric=audience_city,audience_country,audience_gender_age,audience_locale&period=lifetime&access_token=${account.accessToken}`,
      { next: { revalidate: 3600 } }
    )

    if (!res.ok) {
      const errBody = await res.json().catch(() => null)
      return { demographics: null, error: errBody?.error?.message ?? `HTTP ${res.status}` }
    }

    const body = await res.json()
    const data = (body.data ?? []) as Array<{ name: string; values: Array<{ value: Record<string, number> }> }>

    const cities: Array<{ name: string; value: number }> = []
    const countries: Array<{ name: string; value: number }> = []
    const genderAge: Array<{ label: string; value: number }> = []
    const locales: Array<{ name: string; value: number }> = []

    for (const metric of data) {
      const val = metric.values?.[0]?.value ?? {}
      const entries = Object.entries(val)
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value)

      switch (metric.name) {
        case "audience_city":
          cities.push(...entries)
          break
        case "audience_country":
          countries.push(...entries)
          break
        case "audience_gender_age":
          genderAge.push(...entries.map((e) => ({ label: e.name, value: e.value })))
          break
        case "audience_locale":
          locales.push(...entries)
          break
      }
    }

    return {
      demographics: { cities, countries, genderAge, locales },
      error: null,
    }
  } catch (err) {
    return { demographics: null, error: err instanceof Error ? err.message : "Erro desconhecido" }
  }
}

// ─── Competitor Analysis (Business Discovery) ────────────────────────────────

export interface IGCompetitor {
  username: string
  name: string
  biography: string | null
  profile_picture_url: string | null
  followers_count: number
  follows_count: number
  media_count: number
  recentMedia: Array<{
    id: string
    media_type: string
    like_count: number
    comments_count: number
    timestamp: string
    permalink: string
    caption: string | null
    media_url: string | null
    thumbnail_url: string | null
  }>
  avgLikes: number
  avgComments: number
  avgEngagementRate: number
}

export async function getCompetitorProfile(competitorUsername: string): Promise<{
  competitor: IGCompetitor | null
  error: string | null
}> {
  const account = await getIGAccountId()
  if (!account) return { competitor: null, error: "Conta Instagram não encontrada." }

  const cleanUsername = competitorUsername.replace(/^@/, "").trim()
  if (!cleanUsername) return { competitor: null, error: "Username em falta" }

  try {
    const res = await fetch(
      `https://graph.facebook.com/v21.0/${account.igAccountId}?fields=business_discovery.fields(username,name,biography,profile_picture_url,followers_count,follows_count,media_count,media.limit(12){id,media_type,like_count,comments_count,timestamp,permalink,caption,media_url,thumbnail_url}).username(${cleanUsername})&access_token=${account.accessToken}`,
      { next: { revalidate: 1800 } }
    )

    if (!res.ok) {
      const errBody = await res.json().catch(() => null)
      const msg = errBody?.error?.message ?? `HTTP ${res.status}`
      if (msg.includes("not found") || msg.includes("does not exist")) {
        return { competitor: null, error: `Conta @${cleanUsername} não encontrada ou não é uma conta profissional.` }
      }
      return { competitor: null, error: msg }
    }

    const body = await res.json()
    const bd = body.business_discovery as Record<string, unknown>
    if (!bd) return { competitor: null, error: "Dados de Business Discovery indisponíveis." }

    const mediaData = ((bd.media as Record<string, unknown>)?.data ?? []) as Array<Record<string, unknown>>
    const recentMedia = mediaData.map((m) => ({
      id: m.id as string,
      media_type: m.media_type as string,
      like_count: (m.like_count as number) ?? 0,
      comments_count: (m.comments_count as number) ?? 0,
      timestamp: m.timestamp as string,
      permalink: m.permalink as string,
      caption: (m.caption as string) ?? null,
      media_url: (m.media_url as string) ?? null,
      thumbnail_url: (m.thumbnail_url as string) ?? null,
    }))

    const totalLikes = recentMedia.reduce((sum, m) => sum + m.like_count, 0)
    const totalComments = recentMedia.reduce((sum, m) => sum + m.comments_count, 0)
    const mediaCount = recentMedia.length || 1
    const followersCount = (bd.followers_count as number) ?? 0

    return {
      competitor: {
        username: bd.username as string,
        name: (bd.name as string) ?? bd.username as string,
        biography: (bd.biography as string) ?? null,
        profile_picture_url: (bd.profile_picture_url as string) ?? null,
        followers_count: followersCount,
        follows_count: (bd.follows_count as number) ?? 0,
        media_count: (bd.media_count as number) ?? 0,
        recentMedia,
        avgLikes: totalLikes / mediaCount,
        avgComments: totalComments / mediaCount,
        avgEngagementRate: followersCount > 0
          ? ((totalLikes + totalComments) / mediaCount / followersCount) * 100
          : 0,
      },
      error: null,
    }
  } catch (err) {
    return { competitor: null, error: err instanceof Error ? err.message : "Erro desconhecido" }
  }
}

// ─── Scheduled Posts CRUD ────────────────────────────────────────────────────

export async function deleteScheduledPost(postId: string): Promise<{
  success: boolean
  error: string | null
}> {
  const supabase = await createClient()
  const { error } = await supabase
    .from("scheduled_posts")
    .delete()
    .eq("id", postId)
    .eq("status", "scheduled")

  if (error) return { success: false, error: error.message }
  return { success: true, error: null }
}

export async function publishScheduledPost(postId: string): Promise<{
  success: boolean
  error: string | null
}> {
  const supabase = createAdminClient()

  const { data: post, error: fetchError } = await supabase
    .from("scheduled_posts")
    .select("*")
    .eq("id", postId)
    .single()

  if (fetchError || !post) return { success: false, error: "Post não encontrado" }
  if (post.status !== "scheduled") return { success: false, error: "Post já não está agendado" }

  await supabase.from("scheduled_posts").update({ status: "publishing" }).eq("id", postId)

  const result = await publishIGMedia({
    caption: post.caption ?? "",
    mediaType: (post.media_type ?? "IMAGE") as "IMAGE" | "VIDEO" | "REELS",
    ...(post.media_type === "IMAGE"
      ? { imageUrl: post.media_url ?? undefined }
      : { videoUrl: post.media_url ?? undefined }),
  })

  if (result.success) {
    await supabase.from("scheduled_posts").update({
      status: "published",
      published_at: new Date().toISOString(),
      published_post_id: result.mediaId,
    }).eq("id", postId)
  } else {
    await supabase.from("scheduled_posts").update({
      status: "failed",
      error_message: result.error,
    }).eq("id", postId)
  }

  return { success: result.success, error: result.error }
}

// ─── Instagram DM Types ──────────────────────────────────────────────────────

export interface IGConversation {
  id: string
  participantName: string
  participantId: string
  lastMessage: string
  lastMessageTime: string
  isFromMe: boolean
  accountName: string
  accountPageId: string
}

export interface IGDirectMessage {
  id: string
  message: string
  from: { name: string; id: string }
  to: { name: string; id: string }[]
  created_time: string
}

// ─── Instagram DM Actions ────────────────────────────────────────────────────

export async function getIGConversations(): Promise<{
  conversations: IGConversation[]
  accounts: { pageId: string; name: string }[]
  error: string | null
}> {
  const accounts = await getIGAccounts()
  if (accounts.length === 0) return { conversations: [], accounts: [], error: "Conta Instagram não encontrada." }

  const accountList = accounts.map((a) => ({ pageId: a.pageId, name: a.pageName }))

  // Get hidden conversation IDs
  const supabase = await createClient()
  const { data: hiddenRows } = await supabase
    .from("hidden_ig_conversations")
    .select("conversation_id")
  const hiddenIds = new Set((hiddenRows ?? []).map((r: { conversation_id: string }) => r.conversation_id))

  try {
    const allConversations: IGConversation[] = []
    const errors: string[] = []

    // Cutoff: only show conversations updated in the last 30 days
    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

    for (const account of accounts) {
      console.log(`[IG DM] Fetching conversations for ${account.pageName} (pageId=${account.pageId})`)

      // Use page access token for Conversations API
      const res = await fetch(
        `https://graph.facebook.com/v21.0/${account.pageId}/conversations?platform=instagram&fields=id,updated_time,participants,messages.limit(1){message,created_time,from}&access_token=${account.pageAccessToken}`,
        { cache: "no-store" }
      )

      if (!res.ok) {
        const errBody = await res.json().catch(() => null)
        const errMsg = errBody?.error?.message ?? `HTTP ${res.status}`
        console.error(`[IG DM] Error for ${account.pageName}:`, errMsg)
        errors.push(`${account.pageName}: ${errMsg}`)
        continue
      }

      const body = await res.json()
      const convos = (body.data ?? []) as Array<Record<string, unknown>>
      console.log(`[IG DM] ${account.pageName}: ${convos.length} conversations returned from API`)

      let skippedOld = 0
      for (const c of convos) {
        const id = c.id as string
        if (hiddenIds.has(id)) continue

        // Filter by updated_time (last 2 days)
        const updatedTime = c.updated_time as string | undefined
        if (updatedTime && new Date(updatedTime) < cutoff) {
          skippedOld++
          continue
        }

        const participants = ((c.participants as Record<string, unknown>)?.data ?? []) as Array<{ name: string; id: string }>
        const messagesData = ((c.messages as Record<string, unknown>)?.data ?? []) as Array<{ message: string; created_time: string; from: { name: string; id: string } }>
        const lastMsg = messagesData[0]

        // Find the participant that is NOT the page
        const otherParticipant = participants.find((p) => p.id !== account.pageId) ?? participants[0]

        allConversations.push({
          id,
          participantName: otherParticipant?.name ?? "Desconhecido",
          participantId: otherParticipant?.id ?? "",
          lastMessage: lastMsg?.message ?? "",
          lastMessageTime: lastMsg?.created_time ?? "",
          isFromMe: lastMsg?.from?.id === account.pageId,
          accountName: account.pageName,
          accountPageId: account.pageId,
        })
      }
      if (skippedOld > 0) console.log(`[IG DM] ${account.pageName}: skipped ${skippedOld} old conversations (>30 days)`)
    }

    allConversations.sort((a, b) => new Date(b.lastMessageTime).getTime() - new Date(a.lastMessageTime).getTime())
    console.log(`[IG DM] Total conversations after filtering: ${allConversations.length}`)

    return {
      conversations: allConversations,
      accounts: accountList,
      error: errors.length > 0 && allConversations.length === 0 ? errors.join("; ") : null,
    }
  } catch (err) {
    console.error("[IG DM] Fatal error:", err)
    return { conversations: [], accounts: accountList, error: err instanceof Error ? err.message : "Erro desconhecido" }
  }
}

export async function getIGMessages(conversationId: string, accountPageId?: string): Promise<{
  messages: IGDirectMessage[]
  error: string | null
}> {
  const accounts = await getIGAccounts()
  if (accounts.length === 0) return { messages: [], error: "Conta Instagram não encontrada." }

  const account = (accountPageId ? accounts.find((a) => a.pageId === accountPageId) : null) ?? accounts[0]

  try {
    const res = await fetch(
      `https://graph.facebook.com/v21.0/${conversationId}?fields=messages{id,message,from,to,created_time}&access_token=${account.pageAccessToken}`,
      { cache: "no-store" }
    )

    if (!res.ok) {
      const errBody = await res.json().catch(() => null)
      return { messages: [], error: errBody?.error?.message ?? `HTTP ${res.status}` }
    }

    const body = await res.json()
    const rawMessages = ((body.messages as Record<string, unknown>)?.data ?? []) as Array<Record<string, unknown>>

    const messages: IGDirectMessage[] = rawMessages.map((m) => ({
      id: m.id as string,
      message: (m.message as string) ?? "",
      from: (m.from as { name: string; id: string }) ?? { name: "Desconhecido", id: "" },
      to: ((m.to as Record<string, unknown>)?.data as { name: string; id: string }[]) ?? [],
      created_time: m.created_time as string,
    }))

    return { messages, error: null }
  } catch (err) {
    return { messages: [], error: err instanceof Error ? err.message : "Erro desconhecido" }
  }
}

export async function sendIGMessage(
  recipientId: string,
  messageText: string,
  accountPageId?: string
): Promise<{ success: boolean; error: string | null }> {
  const accounts = await getIGAccounts()
  if (accounts.length === 0) return { success: false, error: "Conta Instagram não encontrada." }

  const account = (accountPageId ? accounts.find((a) => a.pageId === accountPageId) : null) ?? accounts[0]

  try {
    const res = await fetch(
      `https://graph.facebook.com/v21.0/${account.pageId}/messages`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipient: { id: recipientId },
          message: { text: messageText },
          access_token: account.pageAccessToken,
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

export async function hideIGConversation(conversationId: string): Promise<{
  success: boolean
  error: string | null
}> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user?.id) return { success: false, error: "Não autenticado" }

  const { error } = await supabase.from("hidden_ig_conversations").insert({
    conversation_id: conversationId,
    hidden_by: user.id,
  })

  if (error) return { success: false, error: error.message }
  return { success: true, error: null }
}
