// ─── Social Media Management Types ──────────────────────────────────────────

export type SocialPlatform = 'instagram' | 'facebook' | 'linkedin' | 'tiktok' | 'other'
export type ContentType = 'post' | 'story' | 'reel' | 'carousel' | 'video' | 'other'
export type CalendarStatus = 'draft' | 'scheduled' | 'published' | 'cancelled'
export type RequestStatus = 'pending' | 'in_progress' | 'draft_ready' | 'approved' | 'changes_requested' | 'completed' | 'cancelled'
export type AssetCategory = 'logo' | 'headshot' | 'template' | 'brand_guideline' | 'photo' | 'video' | 'other'
export type TemplateCategory = 'post' | 'story' | 'carousel' | 'reel_cover' | 'banner' | 'flyer' | 'other'

// ─── Agent Profile ──────────────────────────────────────────────────────────

export interface MarketingAgentProfile {
  id: string
  agent_id: string
  instagram_url: string | null
  facebook_url: string | null
  linkedin_url: string | null
  tiktok_url: string | null
  canva_workspace_url: string | null
  google_drive_url: string | null
  other_links: Array<{ label: string; url: string }>
  notes: string | null
  brand_voice_notes: string | null
  created_at: string
  updated_at: string
  // Joined fields
  agent?: {
    id: string
    commercial_name: string
    professional_email: string
    is_active: boolean
  }
  agent_profile?: {
    profile_photo_url: string | null
    specializations: string[] | null
    instagram_handle: string | null
  }
}

// ─── Assets ─────────────────────────────────────────────────────────────────

export interface MarketingAgentAsset {
  id: string
  agent_id: string
  file_url: string
  file_name: string
  file_type: string | null
  file_size: number | null
  category: AssetCategory
  description: string | null
  uploaded_by: string | null
  created_at: string
}

// ─── Templates ──────────────────────────────────────────────────────────────

export interface MarketingTemplate {
  id: string
  name: string
  category: TemplateCategory
  canva_url: string | null
  thumbnail_url: string | null
  description: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

// ─── Content Calendar ───────────────────────────────────────────────────────

export interface MarketingContentCalendar {
  id: string
  agent_id: string
  platform: SocialPlatform
  content_type: ContentType
  title: string
  description: string | null
  scheduled_date: string
  scheduled_time: string | null
  status: CalendarStatus
  property_id: string | null
  post_url: string | null
  created_by: string | null
  created_at: string
  updated_at: string
  // Joined
  agent?: { id: string; commercial_name: string }
  property?: { id: string; title: string; slug: string }
}

// ─── Publications ───────────────────────────────────────────────────────────

export interface MarketingPublication {
  id: string
  agent_id: string
  platform: SocialPlatform
  content_type: ContentType
  title: string | null
  description: string | null
  published_at: string
  post_url: string | null
  thumbnail_url: string | null
  performance_notes: string | null
  likes: number
  comments: number
  shares: number
  reach: number
  impressions: number
  created_by: string | null
  created_at: string
  // Joined
  agent?: { id: string; commercial_name: string }
}

// ─── Content Requests ───────────────────────────────────────────────────────

export interface MarketingContentRequest {
  id: string
  agent_id: string
  requested_by: string | null
  title: string
  description: string | null
  content_type: ContentType
  platform: SocialPlatform
  deadline: string | null
  property_id: string | null
  property_reference: string | null
  status: RequestStatus
  draft_url: string | null
  draft_notes: string | null
  approval_notes: string | null
  assigned_to: string | null
  completed_at: string | null
  created_at: string
  updated_at: string
  // Joined
  agent?: { id: string; commercial_name: string }
  assigned?: { id: string; commercial_name: string }
  property?: { id: string; title: string }
}

// ─── Metrics ────────────────────────────────────────────────────────────────

export interface MarketingAgentMetric {
  id: string
  agent_id: string
  month: string
  platform: SocialPlatform
  followers_count: number
  posts_count: number
  avg_engagement: number
  avg_reach: number
  notes: string | null
  created_at: string
  updated_at: string
  // Joined
  agent?: { id: string; commercial_name: string }
}

// ─── Constants ──────────────────────────────────────────────────────────────

export const SOCIAL_PLATFORMS: Record<SocialPlatform, string> = {
  instagram: 'Instagram',
  facebook: 'Facebook',
  linkedin: 'LinkedIn',
  tiktok: 'TikTok',
  other: 'Outro',
}

export const CONTENT_TYPES: Record<ContentType, string> = {
  post: 'Post',
  story: 'Story',
  reel: 'Reel',
  carousel: 'Carrossel',
  video: 'Vídeo',
  other: 'Outro',
}

export const CALENDAR_STATUS: Record<CalendarStatus, { label: string; color: string }> = {
  draft: { label: 'Rascunho', color: 'bg-slate-100 text-slate-700' },
  scheduled: { label: 'Agendado', color: 'bg-blue-100 text-blue-700' },
  published: { label: 'Publicado', color: 'bg-emerald-100 text-emerald-700' },
  cancelled: { label: 'Cancelado', color: 'bg-red-100 text-red-700' },
}

export const REQUEST_STATUS: Record<RequestStatus, { label: string; color: string }> = {
  pending: { label: 'Pendente', color: 'bg-amber-100 text-amber-700' },
  in_progress: { label: 'Em Progresso', color: 'bg-blue-100 text-blue-700' },
  draft_ready: { label: 'Rascunho Pronto', color: 'bg-purple-100 text-purple-700' },
  approved: { label: 'Aprovado', color: 'bg-emerald-100 text-emerald-700' },
  changes_requested: { label: 'Alterações Pedidas', color: 'bg-orange-100 text-orange-700' },
  completed: { label: 'Concluído', color: 'bg-emerald-100 text-emerald-700' },
  cancelled: { label: 'Cancelado', color: 'bg-red-100 text-red-700' },
}

export const ASSET_CATEGORIES: Record<AssetCategory, string> = {
  logo: 'Logo',
  headshot: 'Foto Perfil',
  template: 'Template',
  brand_guideline: 'Guia de Marca',
  photo: 'Fotografia',
  video: 'Vídeo',
  other: 'Outro',
}

export const TEMPLATE_CATEGORIES: Record<TemplateCategory, string> = {
  post: 'Post',
  story: 'Story',
  carousel: 'Carrossel',
  reel_cover: 'Capa de Reel',
  banner: 'Banner',
  flyer: 'Flyer',
  other: 'Outro',
}
