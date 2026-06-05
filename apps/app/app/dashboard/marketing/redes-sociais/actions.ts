"use server"

import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import type {
  MarketingAgentProfile,
  MarketingAgentAsset,
  MarketingTemplate,
  MarketingContentCalendar,
  MarketingPublication,
  MarketingContentRequest,
  MarketingAgentMetric,
  AssetCategory,
  TemplateCategory,
  SocialPlatform,
  ContentType,
  CalendarStatus,
  RequestStatus,
} from "@/types/marketing-social"

// ─── Agents (list all consultors) ───────────────────────────────────────────

export async function getAgents() {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from("dev_users")
    .select("id, commercial_name, professional_email, is_active, dev_consultant_profiles(profile_photo_url, specializations, instagram_handle)")
    .eq("is_active", true)
    .order("commercial_name")

  if (error) return { agents: [], error: error.message }
  return { agents: data ?? [], error: null }
}

// ─── Agent Profiles ─────────────────────────────────────────────────────────

export async function getAgentProfiles(): Promise<{ profiles: MarketingAgentProfile[]; error: string | null }> {
  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (admin as any).from("marketing_agent_profiles")
    .select("*, agent:dev_users(id, commercial_name, professional_email, is_active, agent_profile:dev_consultant_profiles(profile_photo_url, specializations, instagram_handle))")
    .order("created_at", { ascending: false })

  if (error) return { profiles: [], error: error.message }
  // Flatten nested agent_profile to top level for component compatibility
  const profiles = (data ?? []).map((row: any) => {
    const { agent, ...rest } = row
    const { agent_profile, ...agentData } = agent ?? {}
    return { ...rest, agent: agentData, agent_profile: agent_profile ?? null }
  })
  return { profiles: profiles as MarketingAgentProfile[], error: null }
}

export async function upsertAgentProfile(agentId: string, profile: Partial<MarketingAgentProfile>): Promise<{ success: boolean; error: string | null }> {
  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (admin as any).from("marketing_agent_profiles").upsert({
    agent_id: agentId,
    instagram_url: profile.instagram_url ?? null,
    facebook_url: profile.facebook_url ?? null,
    linkedin_url: profile.linkedin_url ?? null,
    tiktok_url: profile.tiktok_url ?? null,
    canva_workspace_url: profile.canva_workspace_url ?? null,
    google_drive_url: profile.google_drive_url ?? null,
    other_links: profile.other_links ?? [],
    notes: profile.notes ?? null,
    brand_voice_notes: profile.brand_voice_notes ?? null,
    updated_at: new Date().toISOString(),
  }, { onConflict: "agent_id" })

  if (error) return { success: false, error: error.message }
  return { success: true, error: null }
}

// ─── Assets ─────────────────────────────────────────────────────────────────

export async function getAgentAssets(agentId?: string): Promise<{ assets: MarketingAgentAsset[]; error: string | null }> {
  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (admin as any).from("marketing_agent_assets").select("*").order("created_at", { ascending: false })
  if (agentId) query = query.eq("agent_id", agentId)
  const { data, error } = await query
  if (error) return { assets: [], error: error.message }
  return { assets: (data ?? []) as MarketingAgentAsset[], error: null }
}

export async function createAsset(asset: { agent_id: string; file_url: string; file_name: string; file_type?: string; file_size?: number; category: AssetCategory; description?: string }): Promise<{ success: boolean; error: string | null }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (admin as any).from("marketing_agent_assets").insert({
    ...asset,
    uploaded_by: user?.id ?? null,
  })
  if (error) return { success: false, error: error.message }
  return { success: true, error: null }
}

export async function deleteAsset(id: string): Promise<{ success: boolean; error: string | null }> {
  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (admin as any).from("marketing_agent_assets").delete().eq("id", id)
  if (error) return { success: false, error: error.message }
  return { success: true, error: null }
}

// ─── Templates ──────────────────────────────────────────────────────────────

export async function getTemplates(): Promise<{ templates: MarketingTemplate[]; error: string | null }> {
  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (admin as any).from("marketing_templates").select("*").eq("is_active", true).order("category").order("name")
  if (error) return { templates: [], error: error.message }
  return { templates: (data ?? []) as MarketingTemplate[], error: null }
}

export async function upsertTemplate(template: Partial<MarketingTemplate> & { name: string; category: TemplateCategory }): Promise<{ success: boolean; error: string | null }> {
  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const payload: any = {
    name: template.name,
    category: template.category,
    canva_url: template.canva_url ?? null,
    thumbnail_url: template.thumbnail_url ?? null,
    description: template.description ?? null,
    is_active: template.is_active ?? true,
    updated_at: new Date().toISOString(),
  }
  if (template.id) payload.id = template.id
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (admin as any).from("marketing_templates").upsert(payload)
  if (error) return { success: false, error: error.message }
  return { success: true, error: null }
}

export async function deleteTemplate(id: string): Promise<{ success: boolean; error: string | null }> {
  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (admin as any).from("marketing_templates").update({ is_active: false }).eq("id", id)
  if (error) return { success: false, error: error.message }
  return { success: true, error: null }
}

// ─── Content Calendar ───────────────────────────────────────────────────────

export async function getCalendarEntries(month?: string, agentId?: string): Promise<{ entries: MarketingContentCalendar[]; error: string | null }> {
  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (admin as any).from("marketing_content_calendar")
    .select("*, agent:dev_users(id, commercial_name), property:dev_properties(id, title, slug)")
    .order("scheduled_date")

  if (agentId) query = query.eq("agent_id", agentId)
  if (month) {
    const start = `${month}-01`
    const d = new Date(start)
    d.setMonth(d.getMonth() + 1)
    const end = d.toISOString().split("T")[0]
    query = query.gte("scheduled_date", start).lt("scheduled_date", end)
  }

  const { data, error } = await query
  if (error) return { entries: [], error: error.message }
  return { entries: (data ?? []) as MarketingContentCalendar[], error: null }
}

export async function upsertCalendarEntry(entry: Partial<MarketingContentCalendar> & { agent_id: string; title: string; scheduled_date: string }): Promise<{ success: boolean; error: string | null }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const admin = createAdminClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const payload: any = {
    agent_id: entry.agent_id,
    platform: entry.platform ?? "instagram",
    content_type: entry.content_type ?? "post",
    title: entry.title,
    description: entry.description ?? null,
    scheduled_date: entry.scheduled_date,
    scheduled_time: entry.scheduled_time ?? null,
    status: entry.status ?? "draft",
    property_id: entry.property_id ?? null,
    post_url: entry.post_url ?? null,
    created_by: user?.id ?? null,
    updated_at: new Date().toISOString(),
  }
  if (entry.id) payload.id = entry.id

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (admin as any).from("marketing_content_calendar").upsert(payload)
  if (error) return { success: false, error: error.message }
  return { success: true, error: null }
}

export async function deleteCalendarEntry(id: string): Promise<{ success: boolean; error: string | null }> {
  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (admin as any).from("marketing_content_calendar").delete().eq("id", id)
  if (error) return { success: false, error: error.message }
  return { success: true, error: null }
}

// ─── Publications ───────────────────────────────────────────────────────────

export async function getPublications(agentId?: string): Promise<{ publications: MarketingPublication[]; error: string | null }> {
  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (admin as any).from("marketing_publications")
    .select("*, agent:dev_users(id, commercial_name)")
    .order("published_at", { ascending: false })

  if (agentId) query = query.eq("agent_id", agentId)
  const { data, error } = await query
  if (error) return { publications: [], error: error.message }
  return { publications: (data ?? []) as MarketingPublication[], error: null }
}

export async function upsertPublication(pub: Partial<MarketingPublication> & { agent_id: string }): Promise<{ success: boolean; error: string | null }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const admin = createAdminClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const payload: any = {
    agent_id: pub.agent_id,
    platform: pub.platform ?? "instagram",
    content_type: pub.content_type ?? "post",
    title: pub.title ?? null,
    description: pub.description ?? null,
    published_at: pub.published_at ?? new Date().toISOString(),
    post_url: pub.post_url ?? null,
    thumbnail_url: pub.thumbnail_url ?? null,
    performance_notes: pub.performance_notes ?? null,
    likes: pub.likes ?? 0,
    comments: pub.comments ?? 0,
    shares: pub.shares ?? 0,
    reach: pub.reach ?? 0,
    impressions: pub.impressions ?? 0,
    created_by: user?.id ?? null,
  }
  if (pub.id) payload.id = pub.id

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (admin as any).from("marketing_publications").upsert(payload)
  if (error) return { success: false, error: error.message }
  return { success: true, error: null }
}

export async function deletePublication(id: string): Promise<{ success: boolean; error: string | null }> {
  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (admin as any).from("marketing_publications").delete().eq("id", id)
  if (error) return { success: false, error: error.message }
  return { success: true, error: null }
}

// ─── Content Requests ───────────────────────────────────────────────────────

export async function getContentRequests(status?: RequestStatus, agentId?: string): Promise<{ requests: MarketingContentRequest[]; error: string | null }> {
  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (admin as any).from("marketing_content_requests")
    .select("*, agent:dev_users!marketing_content_requests_agent_id_fkey(id, commercial_name), assigned:dev_users!marketing_content_requests_assigned_to_fkey(id, commercial_name), property:dev_properties(id, title)")
    .order("created_at", { ascending: false })

  if (status) query = query.eq("status", status)
  if (agentId) query = query.eq("agent_id", agentId)
  const { data, error } = await query
  if (error) return { requests: [], error: error.message }
  return { requests: (data ?? []) as MarketingContentRequest[], error: null }
}

export async function upsertContentRequest(req: Partial<MarketingContentRequest> & { agent_id: string; title: string }): Promise<{ success: boolean; error: string | null }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const admin = createAdminClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const payload: any = {
    agent_id: req.agent_id,
    requested_by: req.requested_by ?? user?.id ?? null,
    title: req.title,
    description: req.description ?? null,
    content_type: req.content_type ?? "post",
    platform: req.platform ?? "instagram",
    deadline: req.deadline ?? null,
    property_id: req.property_id ?? null,
    property_reference: req.property_reference ?? null,
    status: req.status ?? "pending",
    draft_url: req.draft_url ?? null,
    draft_notes: req.draft_notes ?? null,
    approval_notes: req.approval_notes ?? null,
    assigned_to: req.assigned_to ?? null,
    updated_at: new Date().toISOString(),
  }
  if (req.id) payload.id = req.id
  if (req.status === "completed" && !req.completed_at) payload.completed_at = new Date().toISOString()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (admin as any).from("marketing_content_requests").upsert(payload)
  if (error) return { success: false, error: error.message }
  return { success: true, error: null }
}

export async function updateRequestStatus(id: string, status: RequestStatus, notes?: string): Promise<{ success: boolean; error: string | null }> {
  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const update: any = { status, updated_at: new Date().toISOString() }
  if (status === "completed") update.completed_at = new Date().toISOString()
  if (notes) {
    if (status === "approved" || status === "changes_requested") update.approval_notes = notes
    else update.draft_notes = notes
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (admin as any).from("marketing_content_requests").update(update).eq("id", id)
  if (error) return { success: false, error: error.message }
  return { success: true, error: null }
}

// ─── Metrics ────────────────────────────────────────────────────────────────

export async function getAgentMetrics(agentId?: string, platform?: SocialPlatform): Promise<{ metrics: MarketingAgentMetric[]; error: string | null }> {
  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (admin as any).from("marketing_agent_metrics")
    .select("*, agent:dev_users(id, commercial_name)")
    .order("month", { ascending: false })

  if (agentId) query = query.eq("agent_id", agentId)
  if (platform) query = query.eq("platform", platform)
  const { data, error } = await query
  if (error) return { metrics: [], error: error.message }
  return { metrics: (data ?? []) as MarketingAgentMetric[], error: null }
}

export async function upsertMetric(metric: Partial<MarketingAgentMetric> & { agent_id: string; month: string; platform: SocialPlatform }): Promise<{ success: boolean; error: string | null }> {
  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const payload: any = {
    agent_id: metric.agent_id,
    month: metric.month,
    platform: metric.platform,
    followers_count: metric.followers_count ?? 0,
    posts_count: metric.posts_count ?? 0,
    avg_engagement: metric.avg_engagement ?? 0,
    avg_reach: metric.avg_reach ?? 0,
    notes: metric.notes ?? null,
    updated_at: new Date().toISOString(),
  }
  if (metric.id) payload.id = metric.id

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (admin as any).from("marketing_agent_metrics").upsert(payload)
  if (error) return { success: false, error: error.message }
  return { success: true, error: null }
}
