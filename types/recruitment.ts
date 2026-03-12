// ─── Recruitment Module Types ────────────────────────────────────────────────

export type CandidateSource = 'linkedin' | 'social_media' | 'referral' | 'inbound' | 'paid_campaign' | 'event' | 'other'
export type CandidateStatus = 'prospect' | 'in_contact' | 'in_process' | 'decision_pending' | 'joined' | 'declined' | 'on_hold'
export type CandidateDecision = 'joined' | 'declined' | 'ghosted' | 'on_hold'
export type OriginBrand = 'remax' | 'century21' | 'era' | 'keller_williams' | 'realty_one' | 'independent' | 'other'
export type InterviewFormat = 'in_person' | 'video_call' | 'phone'
export type CampaignPlatform = 'linkedin_ads' | 'meta_ads' | 'google_ads' | 'other'

// ─── Candidate ──────────────────────────────────────────────────────────────

export interface RecruitmentCandidate {
  id: string
  full_name: string
  phone: string | null
  email: string | null
  source: CandidateSource
  source_detail: string | null
  status: CandidateStatus
  assigned_recruiter_id: string | null
  first_contact_date: string | null
  last_interaction_date: string | null
  decision_date: string | null
  decision: CandidateDecision | null
  reason_yes: string | null
  reason_no: string | null
  notes: string | null
  created_at: string
  updated_at: string
  // Joined
  recruiter?: { id: string; commercial_name: string } | null
  origin_profile?: RecruitmentOriginProfile | null
  interviews_count?: number
  last_interview_date?: string | null
}

// ─── Origin Profile ─────────────────────────────────────────────────────────

export interface RecruitmentOriginProfile {
  id: string
  candidate_id: string
  currently_active_real_estate: boolean
  origin_brand: OriginBrand | null
  origin_brand_custom: string | null
  time_at_origin_months: number | null
  reason_for_leaving: string | null
  billing_avg_month: number | null
  billing_avg_year: number | null
  created_at: string
  updated_at: string
}

// ─── Pain & Pitch ───────────────────────────────────────────────────────────

export interface RecruitmentPainPitch {
  id: string
  candidate_id: string
  identified_pains: string | null
  solutions_presented: string | null
  candidate_objections: string | null
  fit_score: number | null
  created_at: string
  updated_at: string
}

// ─── Interview ──────────────────────────────────────────────────────────────

export interface RecruitmentInterview {
  id: string
  candidate_id: string
  interview_number: number
  interview_date: string
  format: InterviewFormat
  conducted_by: string | null
  notes: string | null
  next_step: string | null
  follow_up_date: string | null
  created_at: string
  // Joined
  interviewer?: { id: string; commercial_name: string } | null
}

// ─── Financial Evolution ────────────────────────────────────────────────────

export interface RecruitmentFinancialEvolution {
  id: string
  candidate_id: string
  billing_month_1: number | null
  billing_month_2: number | null
  billing_month_3: number | null
  billing_month_6: number | null
  billing_month_12: number | null
  months_to_match_previous: number | null
  notes: string | null
  created_at: string
  updated_at: string
}

// ─── Budget ─────────────────────────────────────────────────────────────────

export interface RecruitmentBudget {
  id: string
  candidate_id: string
  paid_campaign_used: boolean
  campaign_platform: CampaignPlatform | null
  estimated_cost: number | null
  resources_used: string | null
  created_at: string
  updated_at: string
}

// ─── Onboarding ─────────────────────────────────────────────────────────────

export interface RecruitmentOnboarding {
  id: string
  candidate_id: string
  contract_sent: boolean
  contract_sent_by: string | null
  form_sent: boolean
  access_created: boolean
  onboarding_start_date: string | null
  created_at: string
  updated_at: string
  // Joined
  sent_by_user?: { id: string; commercial_name: string } | null
}

// ─── Stage Log ──────────────────────────────────────────────────────────────

export interface RecruitmentStageLog {
  id: string
  candidate_id: string
  from_status: CandidateStatus | null
  to_status: CandidateStatus
  changed_by: string | null
  notes: string | null
  created_at: string
  // Joined
  user?: { id: string; commercial_name: string } | null
}

// ─── Constants ──────────────────────────────────────────────────────────────

export const CANDIDATE_SOURCES: Record<CandidateSource, string> = {
  linkedin: 'LinkedIn',
  social_media: 'Redes Sociais',
  referral: 'Referência',
  inbound: 'Inbound',
  paid_campaign: 'Campanha Paga',
  event: 'Evento',
  other: 'Outro',
}

export const CANDIDATE_STATUSES: Record<CandidateStatus, { label: string; color: string }> = {
  prospect: { label: 'Prospecto', color: 'bg-slate-100 text-slate-700' },
  in_contact: { label: 'Em Contacto', color: 'bg-blue-100 text-blue-700' },
  in_process: { label: 'Em Processo', color: 'bg-purple-100 text-purple-700' },
  decision_pending: { label: 'Decisão Pendente', color: 'bg-amber-100 text-amber-700' },
  joined: { label: 'Aderiu', color: 'bg-emerald-100 text-emerald-700' },
  declined: { label: 'Recusou', color: 'bg-red-100 text-red-700' },
  on_hold: { label: 'Em Espera', color: 'bg-orange-100 text-orange-700' },
}

export const CANDIDATE_DECISIONS: Record<CandidateDecision, { label: string; color: string }> = {
  joined: { label: 'Aderiu', color: 'bg-emerald-100 text-emerald-700' },
  declined: { label: 'Recusou', color: 'bg-red-100 text-red-700' },
  ghosted: { label: 'Ghosted', color: 'bg-slate-100 text-slate-700' },
  on_hold: { label: 'Em Espera', color: 'bg-orange-100 text-orange-700' },
}

export const ORIGIN_BRANDS: Record<OriginBrand, string> = {
  remax: 'RE/MAX',
  century21: 'Century 21',
  era: 'ERA',
  keller_williams: 'Keller Williams',
  realty_one: 'Realty One',
  independent: 'Independente',
  other: 'Outra',
}

export const INTERVIEW_FORMATS: Record<InterviewFormat, string> = {
  in_person: 'Presencial',
  video_call: 'Videochamada',
  phone: 'Telefone',
}

export const CAMPAIGN_PLATFORMS: Record<CampaignPlatform, string> = {
  linkedin_ads: 'LinkedIn Ads',
  meta_ads: 'Meta Ads',
  google_ads: 'Google Ads',
  other: 'Outra',
}

// Pipeline stages in order
export const PIPELINE_STAGES: CandidateStatus[] = [
  'prospect',
  'in_contact',
  'in_process',
  'decision_pending',
  'joined',
  'declined',
  'on_hold',
]
