"use server"

import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import type {
  RecruitmentCandidate,
  RecruitmentOriginProfile,
  RecruitmentPainPitch,
  RecruitmentInterview,
  RecruitmentFinancialEvolution,
  RecruitmentBudget,
  RecruitmentOnboarding,
  RecruitmentStageLog,
  CandidateSource,
  CandidateStatus,
  CandidateDecision,
} from "@/types/recruitment"

// ─── Candidates ─────────────────────────────────────────────────────────────

export async function getCandidates(filters?: {
  status?: CandidateStatus
  source?: CandidateSource
  recruiterId?: string
  search?: string
}): Promise<{ candidates: RecruitmentCandidate[]; error: string | null }> {
  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (admin as any).from("recruitment_candidates")
    .select("*, recruiter:dev_users!recruitment_candidates_assigned_recruiter_id_fkey(id, commercial_name)")
    .order("updated_at", { ascending: false })

  if (filters?.status) query = query.eq("status", filters.status)
  if (filters?.source) query = query.eq("source", filters.source)
  if (filters?.recruiterId) query = query.eq("assigned_recruiter_id", filters.recruiterId)
  if (filters?.search) query = query.or(`full_name.ilike.%${filters.search}%,email.ilike.%${filters.search}%,phone.ilike.%${filters.search}%`)

  const { data, error } = await query
  if (error) return { candidates: [], error: error.message }
  return { candidates: (data ?? []) as RecruitmentCandidate[], error: null }
}

export async function getCandidate(id: string): Promise<{ candidate: RecruitmentCandidate | null; error: string | null }> {
  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (admin as any).from("recruitment_candidates")
    .select("*, recruiter:dev_users!recruitment_candidates_assigned_recruiter_id_fkey(id, commercial_name)")
    .eq("id", id)
    .single()

  if (error) return { candidate: null, error: error.message }
  return { candidate: data as RecruitmentCandidate, error: null }
}

export async function createCandidate(candidate: {
  full_name: string
  phone?: string
  email?: string
  source: CandidateSource
  source_detail?: string
  status?: CandidateStatus
  assigned_recruiter_id?: string
  first_contact_date?: string
  notes?: string
}): Promise<{ candidate: RecruitmentCandidate | null; error: string | null }> {
  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (admin as any).from("recruitment_candidates")
    .insert({
      ...candidate,
      phone: candidate.phone || null,
      email: candidate.email || null,
      source_detail: candidate.source_detail || null,
      assigned_recruiter_id: candidate.assigned_recruiter_id || null,
      first_contact_date: candidate.first_contact_date || null,
      notes: candidate.notes || null,
    })
    .select()
    .single()

  if (error) return { candidate: null, error: error.message }

  // Log stage transition
  if (data) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    await (admin as any).from("recruitment_stage_log").insert({
      candidate_id: data.id,
      from_status: null,
      to_status: candidate.status || "prospect",
      changed_by: user?.id ?? null,
      notes: "Candidato criado",
    })
  }

  return { candidate: data as RecruitmentCandidate, error: null }
}

export async function updateCandidate(
  id: string,
  updates: Partial<RecruitmentCandidate>
): Promise<{ success: boolean; error: string | null }> {
  const admin = createAdminClient()

  // If status is changing, log it
  if (updates.status) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: current } = await (admin as any).from("recruitment_candidates").select("status").eq("id", id).single()
    if (current && current.status !== updates.status) {
      const supabase = await createClient()
      const { data: { user } } = await supabase.auth.getUser()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (admin as any).from("recruitment_stage_log").insert({
        candidate_id: id,
        from_status: current.status,
        to_status: updates.status,
        changed_by: user?.id ?? null,
      })

      // Auto-set decision_date and last_interaction_date
      if (updates.status === "joined" || updates.status === "declined") {
        updates.decision_date = updates.decision_date || new Date().toISOString().split("T")[0]
        if (updates.status === "joined") updates.decision = "joined"
        if (updates.status === "declined" && !updates.decision) updates.decision = "declined"
      }
    }
  }

  // Always update last_interaction_date
  updates.last_interaction_date = new Date().toISOString().split("T")[0]

  // Remove joined fields
  const { recruiter, origin_profile, interviews_count, last_interview_date, ...cleanUpdates } = updates as any

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (admin as any).from("recruitment_candidates").update(cleanUpdates).eq("id", id)
  if (error) return { success: false, error: error.message }
  return { success: true, error: null }
}

export async function deleteCandidate(id: string): Promise<{ success: boolean; error: string | null }> {
  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (admin as any).from("recruitment_candidates").delete().eq("id", id)
  if (error) return { success: false, error: error.message }
  return { success: true, error: null }
}

// ─── Origin Profile ─────────────────────────────────────────────────────────

export async function getOriginProfile(candidateId: string): Promise<{ profile: RecruitmentOriginProfile | null; error: string | null }> {
  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (admin as any).from("recruitment_origin_profiles")
    .select("*")
    .eq("candidate_id", candidateId)
    .maybeSingle()

  if (error) return { profile: null, error: error.message }
  return { profile: data as RecruitmentOriginProfile | null, error: null }
}

export async function upsertOriginProfile(
  candidateId: string,
  profile: Partial<RecruitmentOriginProfile>
): Promise<{ success: boolean; error: string | null }> {
  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (admin as any).from("recruitment_origin_profiles").upsert({
    ...profile,
    candidate_id: candidateId,
  }, { onConflict: "candidate_id" })

  if (error) return { success: false, error: error.message }
  return { success: true, error: null }
}

// ─── Pain & Pitch ───────────────────────────────────────────────────────────

export async function getPainPitchRecords(candidateId: string): Promise<{ records: RecruitmentPainPitch[]; error: string | null }> {
  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (admin as any).from("recruitment_pain_pitch")
    .select("*")
    .eq("candidate_id", candidateId)
    .order("created_at", { ascending: false })

  if (error) return { records: [], error: error.message }
  return { records: (data ?? []) as RecruitmentPainPitch[], error: null }
}

export async function upsertPainPitch(
  candidateId: string,
  record: Partial<RecruitmentPainPitch>
): Promise<{ success: boolean; error: string | null }> {
  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (admin as any).from("recruitment_pain_pitch").upsert({
    ...record,
    candidate_id: candidateId,
  })

  if (error) return { success: false, error: error.message }
  return { success: true, error: null }
}

export async function deletePainPitch(id: string): Promise<{ success: boolean; error: string | null }> {
  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (admin as any).from("recruitment_pain_pitch").delete().eq("id", id)
  if (error) return { success: false, error: error.message }
  return { success: true, error: null }
}

// ─── Interviews ─────────────────────────────────────────────────────────────

export async function getInterviews(candidateId: string): Promise<{ interviews: RecruitmentInterview[]; error: string | null }> {
  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (admin as any).from("recruitment_interviews")
    .select("*, interviewer:dev_users!recruitment_interviews_conducted_by_fkey(id, commercial_name)")
    .eq("candidate_id", candidateId)
    .order("interview_number")

  if (error) return { interviews: [], error: error.message }
  return { interviews: (data ?? []) as RecruitmentInterview[], error: null }
}

export async function createInterview(
  candidateId: string,
  interview: {
    interview_date: string
    format: string
    conducted_by?: string
    notes?: string
    next_step?: string
    follow_up_date?: string
  }
): Promise<{ success: boolean; error: string | null }> {
  const admin = createAdminClient()

  // Get next interview number
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: existing } = await (admin as any).from("recruitment_interviews")
    .select("interview_number")
    .eq("candidate_id", candidateId)
    .order("interview_number", { ascending: false })
    .limit(1)

  const nextNumber = existing?.length ? existing[0].interview_number + 1 : 1

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (admin as any).from("recruitment_interviews").insert({
    candidate_id: candidateId,
    interview_number: nextNumber,
    interview_date: interview.interview_date,
    format: interview.format,
    conducted_by: interview.conducted_by || null,
    notes: interview.notes || null,
    next_step: interview.next_step || null,
    follow_up_date: interview.follow_up_date || null,
  })

  if (error) return { success: false, error: error.message }

  // Update candidate last_interaction_date
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (admin as any).from("recruitment_candidates").update({
    last_interaction_date: new Date().toISOString().split("T")[0],
  }).eq("id", candidateId)

  return { success: true, error: null }
}

export async function updateInterview(
  id: string,
  updates: Partial<RecruitmentInterview>
): Promise<{ success: boolean; error: string | null }> {
  const admin = createAdminClient()
  const { interviewer, ...clean } = updates as any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (admin as any).from("recruitment_interviews").update(clean).eq("id", id)
  if (error) return { success: false, error: error.message }
  return { success: true, error: null }
}

export async function deleteInterview(id: string): Promise<{ success: boolean; error: string | null }> {
  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (admin as any).from("recruitment_interviews").delete().eq("id", id)
  if (error) return { success: false, error: error.message }
  return { success: true, error: null }
}

// ─── Financial Evolution ────────────────────────────────────────────────────

export async function getFinancialEvolution(candidateId: string): Promise<{ financial: RecruitmentFinancialEvolution | null; error: string | null }> {
  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (admin as any).from("recruitment_financial_evolution")
    .select("*")
    .eq("candidate_id", candidateId)
    .maybeSingle()

  if (error) return { financial: null, error: error.message }
  return { financial: data as RecruitmentFinancialEvolution | null, error: null }
}

export async function upsertFinancialEvolution(
  candidateId: string,
  data: Partial<RecruitmentFinancialEvolution>
): Promise<{ success: boolean; error: string | null }> {
  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (admin as any).from("recruitment_financial_evolution").upsert({
    ...data,
    candidate_id: candidateId,
  }, { onConflict: "candidate_id" })

  if (error) return { success: false, error: error.message }
  return { success: true, error: null }
}

// ─── Budget ─────────────────────────────────────────────────────────────────

export async function getBudget(candidateId: string): Promise<{ budget: RecruitmentBudget | null; error: string | null }> {
  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (admin as any).from("recruitment_budget")
    .select("*")
    .eq("candidate_id", candidateId)
    .maybeSingle()

  if (error) return { budget: null, error: error.message }
  return { budget: data as RecruitmentBudget | null, error: null }
}

export async function upsertBudget(
  candidateId: string,
  data: Partial<RecruitmentBudget>
): Promise<{ success: boolean; error: string | null }> {
  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (admin as any).from("recruitment_budget").upsert({
    ...data,
    candidate_id: candidateId,
  }, { onConflict: "candidate_id" })

  if (error) return { success: false, error: error.message }
  return { success: true, error: null }
}

// ─── Onboarding ─────────────────────────────────────────────────────────────

export async function getOnboarding(candidateId: string): Promise<{ onboarding: RecruitmentOnboarding | null; error: string | null }> {
  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (admin as any).from("recruitment_onboarding")
    .select("*, sent_by_user:dev_users!recruitment_onboarding_contract_sent_by_fkey(id, commercial_name)")
    .eq("candidate_id", candidateId)
    .maybeSingle()

  if (error) return { onboarding: null, error: error.message }
  return { onboarding: data as RecruitmentOnboarding | null, error: null }
}

export async function upsertOnboarding(
  candidateId: string,
  data: Partial<RecruitmentOnboarding>
): Promise<{ success: boolean; error: string | null }> {
  const admin = createAdminClient()
  const { sent_by_user, ...clean } = data as any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (admin as any).from("recruitment_onboarding").upsert({
    ...clean,
    candidate_id: candidateId,
  }, { onConflict: "candidate_id" })

  if (error) return { success: false, error: error.message }
  return { success: true, error: null }
}

// ─── Stage Log ──────────────────────────────────────────────────────────────

export async function getStageLog(candidateId: string): Promise<{ logs: RecruitmentStageLog[]; error: string | null }> {
  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (admin as any).from("recruitment_stage_log")
    .select("*, user:dev_users!recruitment_stage_log_changed_by_fkey(id, commercial_name)")
    .eq("candidate_id", candidateId)
    .order("created_at", { ascending: false })

  if (error) return { logs: [], error: error.message }
  return { logs: (data ?? []) as RecruitmentStageLog[], error: null }
}

// ─── Recruiters (for dropdowns) ─────────────────────────────────────────────

export async function getRecruiters(): Promise<{ recruiters: Array<{ id: string; commercial_name: string }>; error: string | null }> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from("dev_users")
    .select("id, commercial_name")
    .eq("is_active", true)
    .order("commercial_name")

  if (error) return { recruiters: [], error: error.message }
  return { recruiters: data ?? [], error: null }
}

// ─── KPI Aggregations ───────────────────────────────────────────────────────

export async function getRecruitmentKPIs(): Promise<{
  total: number
  byStatus: Record<string, number>
  bySource: Record<string, number>
  byBrand: Record<string, number>
  avgTimeToDecision: number | null
  conversionRate: number
  error: string | null
}> {
  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (admin as any).from("recruitment_candidates").select("*")

  if (error) return { total: 0, byStatus: {}, bySource: {}, byBrand: {}, avgTimeToDecision: null, conversionRate: 0, error: error.message }

  const candidates = (data ?? []) as RecruitmentCandidate[]
  const total = candidates.length

  const byStatus: Record<string, number> = {}
  const bySource: Record<string, number> = {}
  candidates.forEach((c) => {
    byStatus[c.status] = (byStatus[c.status] || 0) + 1
    bySource[c.source] = (bySource[c.source] || 0) + 1
  })

  // Conversion rate
  const joined = candidates.filter((c) => c.status === "joined").length
  const conversionRate = total > 0 ? (joined / total) * 100 : 0

  // Avg time to decision (for those with first_contact_date and decision_date)
  const withDecision = candidates.filter((c) => c.first_contact_date && c.decision_date)
  let avgTimeToDecision: number | null = null
  if (withDecision.length > 0) {
    const totalDays = withDecision.reduce((sum, c) => {
      const first = new Date(c.first_contact_date!)
      const dec = new Date(c.decision_date!)
      return sum + Math.round((dec.getTime() - first.getTime()) / (1000 * 60 * 60 * 24))
    }, 0)
    avgTimeToDecision = Math.round(totalDays / withDecision.length)
  }

  // By brand (need origin profiles)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: origins } = await (admin as any).from("recruitment_origin_profiles").select("candidate_id, origin_brand")
  const byBrand: Record<string, number> = {}
  if (origins) {
    (origins as any[]).forEach((o) => {
      if (o.origin_brand) byBrand[o.origin_brand] = (byBrand[o.origin_brand] || 0) + 1
    })
  }

  return { total, byStatus, bySource, byBrand, avgTimeToDecision, conversionRate, error: null }
}

// ─── Form Field Config ──────────────────────────────────────────────────────

export interface FormFieldConfig {
  id: string
  field_key: string
  label: string
  section: string
  section_label: string | null
  field_type: string
  options: string[] | null
  placeholder: string | null
  is_visible: boolean
  is_required: boolean
  is_ai_extractable: boolean
  order_index: number
}

export async function getFormFields(): Promise<{ fields: FormFieldConfig[]; error: string | null }> {
  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (admin as any).from("recruitment_form_fields")
    .select("*")
    .order("order_index")

  if (error) return { fields: [], error: error.message }
  return { fields: (data ?? []) as FormFieldConfig[], error: null }
}

export async function updateFormField(
  id: string,
  updates: Partial<FormFieldConfig>
): Promise<{ success: boolean; error: string | null }> {
  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (admin as any).from("recruitment_form_fields")
    .update(updates)
    .eq("id", id)

  if (error) return { success: false, error: error.message }
  return { success: true, error: null }
}

export async function reorderFormFields(
  orderedIds: { id: string; order_index: number }[]
): Promise<{ success: boolean; error: string | null }> {
  const admin = createAdminClient()
  for (const item of orderedIds) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (admin as any).from("recruitment_form_fields")
      .update({ order_index: item.order_index })
      .eq("id", item.id)
    if (error) return { success: false, error: error.message }
  }
  return { success: true, error: null }
}

export async function updateSectionLabel(
  section: string,
  label: string
): Promise<{ success: boolean; error: string | null }> {
  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (admin as any).from("recruitment_form_fields")
    .update({ section_label: label })
    .eq("section", section)

  if (error) return { success: false, error: error.message }
  return { success: true, error: null }
}

// ─── Entry Form Submissions ─────────────────────────────────────────────────

export interface EntrySubmission {
  id: string
  candidate_id: string | null
  full_name: string
  cc_number: string | null
  cc_expiry: string | null
  cc_issue_date: string | null
  date_of_birth: string | null
  nif: string | null
  niss: string | null
  naturalidade: string | null
  estado_civil: string | null
  display_name: string | null
  full_address: string | null
  professional_phone: string | null
  emergency_contact_name: string | null
  emergency_contact_phone: string | null
  personal_email: string | null
  email_suggestion_1: string | null
  email_suggestion_2: string | null
  email_suggestion_3: string | null
  has_sales_experience: boolean
  has_real_estate_experience: boolean
  previous_agency: string | null
  instagram_handle: string | null
  facebook_page: string | null
  id_document_front_url: string | null
  id_document_back_url: string | null
  professional_photo_url: string | null
  status: string
  submitted_at: string
  reviewed_at: string | null
  reviewed_by: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export async function getEntrySubmissions(status?: string): Promise<{ submissions: EntrySubmission[]; error: string | null }> {
  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (admin as any).from("recruitment_entry_submissions")
    .select("*")
    .order("submitted_at", { ascending: false })

  if (status) query = query.eq("status", status)

  const { data, error } = await query
  if (error) return { submissions: [], error: error.message }
  return { submissions: (data ?? []) as EntrySubmission[], error: null }
}

export async function updateEntrySubmission(
  id: string,
  updates: { status?: string; notes?: string; reviewed_by?: string; reviewed_at?: string }
): Promise<{ success: boolean; error: string | null }> {
  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (admin as any).from("recruitment_entry_submissions")
    .update(updates)
    .eq("id", id)

  if (error) return { success: false, error: error.message }
  return { success: true, error: null }
}

// ─── Communication History ──────────────────────────────────────────────────

export type CommunicationType = 'call' | 'email' | 'whatsapp' | 'sms' | 'meeting' | 'note'

export interface RecruitmentCommunication {
  id: string
  candidate_id: string
  type: CommunicationType
  subject: string | null
  content: string | null
  direction: 'inbound' | 'outbound'
  logged_by: string | null
  created_at: string
  user?: { id: string; commercial_name: string } | null
}

export async function getCommunications(candidateId: string): Promise<{ communications: RecruitmentCommunication[]; error: string | null }> {
  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (admin as any).from("temp_recruitment_communications")
    .select("*, user:dev_users!temp_recruitment_communications_logged_by_fkey(id, commercial_name)")
    .eq("candidate_id", candidateId)
    .order("created_at", { ascending: false })

  if (error) return { communications: [], error: error.message }
  return { communications: (data ?? []) as RecruitmentCommunication[], error: null }
}

export async function createCommunication(
  candidateId: string,
  commData: {
    type: CommunicationType
    subject?: string
    content?: string
    direction: 'inbound' | 'outbound'
  }
): Promise<{ success: boolean; error: string | null }> {
  const admin = createAdminClient()
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (admin as any).from("temp_recruitment_communications").insert({
    candidate_id: candidateId,
    type: commData.type,
    subject: commData.subject || null,
    content: commData.content || null,
    direction: commData.direction,
    logged_by: user?.id ?? null,
  })

  if (error) return { success: false, error: error.message }

  // Update candidate last_interaction_date
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (admin as any).from("recruitment_candidates").update({
    last_interaction_date: new Date().toISOString().split("T")[0],
  }).eq("id", candidateId)

  return { success: true, error: null }
}

// ─── Probation Tracking ────────────────────────────────────────────────────

export interface RecruitmentProbation {
  id: string
  candidate_id: string
  start_date: string
  end_date: string | null
  milestone_30_days: boolean
  milestone_30_notes: string | null
  milestone_60_days: boolean
  milestone_60_notes: string | null
  milestone_90_days: boolean
  milestone_90_notes: string | null
  billing_target_month_1: number | null
  billing_actual_month_1: number | null
  billing_target_month_2: number | null
  billing_actual_month_2: number | null
  billing_target_month_3: number | null
  billing_actual_month_3: number | null
  status: 'active' | 'completed' | 'failed'
  notes: string | null
  created_at: string
  updated_at: string
}

export async function getProbation(candidateId: string): Promise<{ probation: RecruitmentProbation | null; error: string | null }> {
  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (admin as any).from("temp_recruitment_probation")
    .select("*")
    .eq("candidate_id", candidateId)
    .maybeSingle()

  if (error) return { probation: null, error: error.message }
  return { probation: data as RecruitmentProbation | null, error: null }
}

export async function upsertProbation(
  candidateId: string,
  probationData: Partial<RecruitmentProbation>
): Promise<{ success: boolean; error: string | null }> {
  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (admin as any).from("temp_recruitment_probation").upsert({
    ...probationData,
    candidate_id: candidateId,
  }, { onConflict: "candidate_id" })

  if (error) return { success: false, error: error.message }
  return { success: true, error: null }
}

// ─── Communication Templates ───────────────────────────────────────────────

export interface RecruitmentCommTemplate {
  id: string
  name: string
  stage: CandidateStatus
  channel: 'email' | 'whatsapp' | 'sms'
  subject: string | null
  body: string
  variables: string[]
  is_active: boolean
  created_at: string
  updated_at: string
}

export async function getCommTemplates(stage?: CandidateStatus): Promise<{ templates: RecruitmentCommTemplate[]; error: string | null }> {
  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (admin as any).from("temp_recruitment_comm_templates")
    .select("*")
    .order("created_at", { ascending: false })

  if (stage) query = query.eq("stage", stage)

  const { data, error } = await query
  if (error) return { templates: [], error: error.message }
  return { templates: (data ?? []) as RecruitmentCommTemplate[], error: null }
}

export async function createCommTemplate(
  templateData: {
    name: string
    stage: CandidateStatus
    channel: 'email' | 'whatsapp' | 'sms'
    subject?: string
    body: string
    variables?: string[]
    is_active?: boolean
  }
): Promise<{ template: RecruitmentCommTemplate | null; error: string | null }> {
  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (admin as any).from("temp_recruitment_comm_templates").insert({
    name: templateData.name,
    stage: templateData.stage,
    channel: templateData.channel,
    subject: templateData.subject || null,
    body: templateData.body,
    variables: templateData.variables || [],
    is_active: templateData.is_active ?? true,
  }).select().single()

  if (error) return { template: null, error: error.message }
  return { template: data as RecruitmentCommTemplate, error: null }
}

export async function updateCommTemplate(
  id: string,
  updates: Partial<RecruitmentCommTemplate>
): Promise<{ success: boolean; error: string | null }> {
  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (admin as any).from("temp_recruitment_comm_templates")
    .update(updates)
    .eq("id", id)

  if (error) return { success: false, error: error.message }
  return { success: true, error: null }
}

export async function deleteCommTemplate(id: string): Promise<{ success: boolean; error: string | null }> {
  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (admin as any).from("temp_recruitment_comm_templates").delete().eq("id", id)
  if (error) return { success: false, error: error.message }
  return { success: true, error: null }
}

// ─── Duplicate Detection ───────────────────────────────────────────────────

export async function findDuplicates(candidateId: string): Promise<{
  duplicates: (RecruitmentCandidate & { match_reason: 'phone' | 'email' | 'both' })[]
  error: string | null
}> {
  const admin = createAdminClient()

  // Get the target candidate
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: candidate, error: fetchError } = await (admin as any).from("recruitment_candidates")
    .select("*")
    .eq("id", candidateId)
    .single()

  if (fetchError || !candidate) return { duplicates: [], error: fetchError?.message ?? "Candidato não encontrado" }

  const phoneMatches: RecruitmentCandidate[] = []
  const emailMatches: RecruitmentCandidate[] = []

  // Find by phone
  if (candidate.phone) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: byPhone } = await (admin as any).from("recruitment_candidates")
      .select("*, recruiter:dev_users!recruitment_candidates_assigned_recruiter_id_fkey(id, commercial_name)")
      .eq("phone", candidate.phone)
      .neq("id", candidateId)
    if (byPhone) phoneMatches.push(...(byPhone as RecruitmentCandidate[]))
  }

  // Find by email
  if (candidate.email) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: byEmail } = await (admin as any).from("recruitment_candidates")
      .select("*, recruiter:dev_users!recruitment_candidates_assigned_recruiter_id_fkey(id, commercial_name)")
      .eq("email", candidate.email)
      .neq("id", candidateId)
    if (byEmail) emailMatches.push(...(byEmail as RecruitmentCandidate[]))
  }

  // Merge and deduplicate, determine match_reason
  const phoneIds = new Set(phoneMatches.map((c) => c.id))
  const emailIds = new Set(emailMatches.map((c) => c.id))
  const allIds = new Set([...phoneIds, ...emailIds])

  const duplicates: (RecruitmentCandidate & { match_reason: 'phone' | 'email' | 'both' })[] = []
  const seen = new Map<string, RecruitmentCandidate>()

  for (const c of [...phoneMatches, ...emailMatches]) {
    if (!seen.has(c.id)) seen.set(c.id, c)
  }

  for (const dupId of allIds) {
    const c = seen.get(dupId)!
    const matchPhone = phoneIds.has(dupId)
    const matchEmail = emailIds.has(dupId)
    duplicates.push({
      ...c,
      match_reason: matchPhone && matchEmail ? 'both' : matchPhone ? 'phone' : 'email',
    })
  }

  return { duplicates, error: null }
}

export async function mergeCandidates(
  keepId: string,
  mergeId: string
): Promise<{ success: boolean; error: string | null }> {
  const admin = createAdminClient()

  try {
    // Update all related records to point to the kept candidate
    const tables = [
      { table: "temp_recruitment_communications", column: "candidate_id" },
      { table: "recruitment_interviews", column: "candidate_id" },
      { table: "recruitment_pain_pitch", column: "candidate_id" },
      { table: "recruitment_stage_log", column: "candidate_id" },
    ]

    for (const { table, column } of tables) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (admin as any).from(table)
        .update({ [column]: keepId })
        .eq(column, mergeId)
      if (error) return { success: false, error: `Erro ao migrar ${table}: ${error.message}` }
    }

    // Delete the merged candidate (cascade should handle remaining 1:1 records)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: deleteError } = await (admin as any).from("recruitment_candidates")
      .delete()
      .eq("id", mergeId)

    if (deleteError) return { success: false, error: deleteError.message }

    return { success: true, error: null }
  } catch (err) {
    return { success: false, error: `Erro inesperado: ${(err as Error).message}` }
  }
}

// ─── Alerts / Pending Tasks ────────────────────────────────────────────────

export interface RecruitmentAlert {
  type: 'no_contact' | 'follow_up_today' | 'interview_tomorrow' | 'onboarding_incomplete' | 'probation_milestone'
  severity: 'info' | 'warning' | 'urgent'
  candidate_id: string
  candidate_name: string
  message: string
  date: string | null
}

export async function getRecruitmentAlerts(): Promise<{ alerts: RecruitmentAlert[]; error: string | null }> {
  const admin = createAdminClient()
  const alerts: RecruitmentAlert[] = []
  const today = new Date()
  const todayStr = today.toISOString().split("T")[0]
  const tomorrowStr = new Date(today.getTime() + 86400000).toISOString().split("T")[0]
  const sevenDaysAgo = new Date(today.getTime() - 7 * 86400000).toISOString().split("T")[0]
  const fourteenDaysAgo = new Date(today.getTime() - 14 * 86400000).toISOString().split("T")[0]
  const threeDaysFromNow = new Date(today.getTime() + 3 * 86400000).toISOString().split("T")[0]
  const fifteenDaysAgo = new Date(today.getTime() - 15 * 86400000).toISOString().split("T")[0]

  // Terminal statuses that should not trigger no_contact alerts
  const terminalStatuses = ['joined', 'declined']

  // 1. No contact alerts — candidates not in terminal status with stale last_interaction_date
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: staleCandidates } = await (admin as any).from("recruitment_candidates")
    .select("id, full_name, last_interaction_date, status")
    .not("status", "in", `(${terminalStatuses.join(",")})`)

  if (staleCandidates) {
    for (const c of staleCandidates as RecruitmentCandidate[]) {
      const lastDate = c.last_interaction_date
      if (!lastDate || lastDate <= fourteenDaysAgo) {
        alerts.push({
          type: 'no_contact',
          severity: 'urgent',
          candidate_id: c.id,
          candidate_name: c.full_name,
          message: `Sem contacto há mais de 14 dias`,
          date: lastDate || null,
        })
      } else if (lastDate <= sevenDaysAgo) {
        alerts.push({
          type: 'no_contact',
          severity: 'warning',
          candidate_id: c.id,
          candidate_name: c.full_name,
          message: `Sem contacto há mais de 7 dias`,
          date: lastDate,
        })
      }
    }
  }

  // 2. Follow-up today — interviews with follow_up_date = today
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: followUps } = await (admin as any).from("recruitment_interviews")
    .select("id, candidate_id, follow_up_date")
    .eq("follow_up_date", todayStr)

  if (followUps) {
    const candidateIds = [...new Set((followUps as any[]).map((f) => f.candidate_id))]
    if (candidateIds.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: candidates } = await (admin as any).from("recruitment_candidates")
        .select("id, full_name")
        .in("id", candidateIds)
      const nameMap = new Map((candidates as any[] ?? []).map((c: any) => [c.id, c.full_name]))

      for (const f of followUps as any[]) {
        alerts.push({
          type: 'follow_up_today',
          severity: 'info',
          candidate_id: f.candidate_id,
          candidate_name: nameMap.get(f.candidate_id) || 'Desconhecido',
          message: `Follow-up agendado para hoje`,
          date: todayStr,
        })
      }
    }
  }

  // 3. Interview tomorrow
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: tomorrowInterviews } = await (admin as any).from("recruitment_interviews")
    .select("id, candidate_id, interview_date")
    .eq("interview_date", tomorrowStr)

  if (tomorrowInterviews) {
    const candidateIds = [...new Set((tomorrowInterviews as any[]).map((i) => i.candidate_id))]
    if (candidateIds.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: candidates } = await (admin as any).from("recruitment_candidates")
        .select("id, full_name")
        .in("id", candidateIds)
      const nameMap = new Map((candidates as any[] ?? []).map((c: any) => [c.id, c.full_name]))

      for (const i of tomorrowInterviews as any[]) {
        alerts.push({
          type: 'interview_tomorrow',
          severity: 'info',
          candidate_id: i.candidate_id,
          candidate_name: nameMap.get(i.candidate_id) || 'Desconhecido',
          message: `Entrevista agendada para amanhã`,
          date: tomorrowStr,
        })
      }
    }
  }

  // 4. Onboarding incomplete — candidates with status 'joined' where onboarding is incomplete after 15 days
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: joinedCandidates } = await (admin as any).from("recruitment_candidates")
    .select("id, full_name, updated_at")
    .eq("status", "joined")

  if (joinedCandidates) {
    const joinedIds = (joinedCandidates as any[]).map((c) => c.id)
    if (joinedIds.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: onboardings } = await (admin as any).from("recruitment_onboarding")
        .select("candidate_id, contract_sent, form_sent, access_created")
        .in("candidate_id", joinedIds)

      const onboardingMap = new Map((onboardings as any[] ?? []).map((o: any) => [o.candidate_id, o]))
      const nameMap = new Map((joinedCandidates as any[]).map((c: any) => [c.id, c.full_name]))

      for (const c of joinedCandidates as any[]) {
        // Check if joined > 15 days ago (use stage log or updated_at)
        const joinedDate = c.updated_at?.split("T")[0]
        if (joinedDate && joinedDate <= fifteenDaysAgo) {
          const ob = onboardingMap.get(c.id)
          if (!ob || !ob.contract_sent || !ob.form_sent || !ob.access_created) {
            const missing: string[] = []
            if (!ob || !ob.contract_sent) missing.push("contrato")
            if (!ob || !ob.form_sent) missing.push("formulário")
            if (!ob || !ob.access_created) missing.push("acessos")
            alerts.push({
              type: 'onboarding_incomplete',
              severity: 'warning',
              candidate_id: c.id,
              candidate_name: nameMap.get(c.id) || 'Desconhecido',
              message: `Onboarding incompleto (falta: ${missing.join(", ")})`,
              date: joinedDate,
            })
          }
        }
      }
    }
  }

  // 5. Probation milestones approaching (within 3 days)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: probations } = await (admin as any).from("temp_recruitment_probation")
    .select("candidate_id, start_date, milestone_30_days, milestone_60_days, milestone_90_days, status")
    .eq("status", "active")

  if (probations) {
    const candidateIds = (probations as any[]).map((p) => p.candidate_id)
    if (candidateIds.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: candidates } = await (admin as any).from("recruitment_candidates")
        .select("id, full_name")
        .in("id", candidateIds)
      const nameMap = new Map((candidates as any[] ?? []).map((c: any) => [c.id, c.full_name]))

      for (const p of probations as any[]) {
        if (!p.start_date) continue
        const start = new Date(p.start_date)
        const milestones = [
          { days: 30, done: p.milestone_30_days, label: "30 dias" },
          { days: 60, done: p.milestone_60_days, label: "60 dias" },
          { days: 90, done: p.milestone_90_days, label: "90 dias" },
        ]

        for (const m of milestones) {
          if (m.done) continue
          const milestoneDate = new Date(start.getTime() + m.days * 86400000).toISOString().split("T")[0]
          if (milestoneDate >= todayStr && milestoneDate <= threeDaysFromNow) {
            alerts.push({
              type: 'probation_milestone',
              severity: 'info',
              candidate_id: p.candidate_id,
              candidate_name: nameMap.get(p.candidate_id) || 'Desconhecido',
              message: `Marco de ${m.label} a aproximar-se (${milestoneDate})`,
              date: milestoneDate,
            })
          }
        }
      }
    }
  }

  return { alerts, error: null }
}

// ─── Extended KPIs for Reports ─────────────────────────────────────────────

export async function getRecruitmentReportData(dateFrom?: string, dateTo?: string): Promise<{
  candidatesByMonth: { month: string; count: number }[]
  sourceEffectiveness: { source: string; total: number; joined: number; rate: number }[]
  avgTimeByStage: Record<string, number>
  recruiterPerformance: { recruiter_name: string; total: number; joined: number; avg_time: number }[]
  conversionFunnel: { stage: string; count: number }[]
  error: string | null
}> {
  const admin = createAdminClient()
  const emptyResult = {
    candidatesByMonth: [] as { month: string; count: number }[],
    sourceEffectiveness: [] as { source: string; total: number; joined: number; rate: number }[],
    avgTimeByStage: {} as Record<string, number>,
    recruiterPerformance: [] as { recruiter_name: string; total: number; joined: number; avg_time: number }[],
    conversionFunnel: [] as { stage: string; count: number }[],
    error: null as string | null,
  }

  // Fetch all candidates (optionally filtered by date range)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let candidateQuery = (admin as any).from("recruitment_candidates")
    .select("*, recruiter:dev_users!recruitment_candidates_assigned_recruiter_id_fkey(id, commercial_name)")
  if (dateFrom) candidateQuery = candidateQuery.gte("created_at", dateFrom)
  if (dateTo) candidateQuery = candidateQuery.lte("created_at", dateTo)

  const { data: candidatesData, error: candidatesError } = await candidateQuery
  if (candidatesError) return { ...emptyResult, error: candidatesError.message }

  const candidates = (candidatesData ?? []) as (RecruitmentCandidate & { recruiter?: { id: string; commercial_name: string } | null })[]

  // 1. Candidates by month (last 12 months)
  const monthCounts: Record<string, number> = {}
  const now = new Date()
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
    monthCounts[key] = 0
  }
  for (const c of candidates) {
    const month = c.created_at.substring(0, 7) // YYYY-MM
    if (month in monthCounts) monthCounts[month]++
  }
  const candidatesByMonth = Object.entries(monthCounts).map(([month, count]) => ({ month, count }))

  // 2. Source effectiveness
  const sourceGroups: Record<string, { total: number; joined: number }> = {}
  for (const c of candidates) {
    if (!sourceGroups[c.source]) sourceGroups[c.source] = { total: 0, joined: 0 }
    sourceGroups[c.source].total++
    if (c.status === "joined") sourceGroups[c.source].joined++
  }
  const sourceEffectiveness = Object.entries(sourceGroups).map(([source, sData]) => ({
    source,
    total: sData.total,
    joined: sData.joined,
    rate: sData.total > 0 ? Math.round((sData.joined / sData.total) * 100) : 0,
  }))

  // 3. Average time by stage (from stage_log)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let stageLogQuery = (admin as any).from("recruitment_stage_log")
    .select("candidate_id, from_status, to_status, created_at")
    .order("created_at")
  if (dateFrom) stageLogQuery = stageLogQuery.gte("created_at", dateFrom)
  if (dateTo) stageLogQuery = stageLogQuery.lte("created_at", dateTo)

  const { data: stageLogsData } = await stageLogQuery
  const stageLogs = (stageLogsData ?? []) as { candidate_id: string; from_status: string | null; to_status: string; created_at: string }[]

  // Group logs by candidate to compute time in each stage
  const logsByCandidate: Record<string, typeof stageLogs> = {}
  for (const log of stageLogs) {
    if (!logsByCandidate[log.candidate_id]) logsByCandidate[log.candidate_id] = []
    logsByCandidate[log.candidate_id].push(log)
  }

  const stageDurations: Record<string, number[]> = {}
  for (const logs of Object.values(logsByCandidate)) {
    for (let i = 0; i < logs.length - 1; i++) {
      const stage = logs[i].to_status
      const enteredAt = new Date(logs[i].created_at)
      const leftAt = new Date(logs[i + 1].created_at)
      const days = Math.round((leftAt.getTime() - enteredAt.getTime()) / (1000 * 60 * 60 * 24))
      if (!stageDurations[stage]) stageDurations[stage] = []
      stageDurations[stage].push(days)
    }
  }

  const avgTimeByStage: Record<string, number> = {}
  for (const [stage, durations] of Object.entries(stageDurations)) {
    avgTimeByStage[stage] = Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
  }

  // 4. Recruiter performance
  const recruiterGroups: Record<string, { name: string; total: number; joined: number; totalDays: number; decisionCount: number }> = {}
  for (const c of candidates) {
    const recruiterId = c.assigned_recruiter_id
    if (!recruiterId) continue
    const recruiterName = c.recruiter?.commercial_name || 'Desconhecido'
    if (!recruiterGroups[recruiterId]) {
      recruiterGroups[recruiterId] = { name: recruiterName, total: 0, joined: 0, totalDays: 0, decisionCount: 0 }
    }
    recruiterGroups[recruiterId].total++
    if (c.status === "joined") recruiterGroups[recruiterId].joined++
    if (c.first_contact_date && c.decision_date) {
      const days = Math.round((new Date(c.decision_date).getTime() - new Date(c.first_contact_date).getTime()) / (1000 * 60 * 60 * 24))
      recruiterGroups[recruiterId].totalDays += days
      recruiterGroups[recruiterId].decisionCount++
    }
  }
  const recruiterPerformance = Object.values(recruiterGroups).map((r) => ({
    recruiter_name: r.name,
    total: r.total,
    joined: r.joined,
    avg_time: r.decisionCount > 0 ? Math.round(r.totalDays / r.decisionCount) : 0,
  }))

  // 5. Conversion funnel (in pipeline order)
  const pipelineOrder: CandidateStatus[] = ['prospect', 'in_contact', 'in_process', 'decision_pending', 'joined', 'declined', 'on_hold']
  const statusCounts: Record<string, number> = {}
  for (const c of candidates) {
    statusCounts[c.status] = (statusCounts[c.status] || 0) + 1
  }
  const conversionFunnel = pipelineOrder.map((stage) => ({
    stage,
    count: statusCounts[stage] || 0,
  }))

  return {
    candidatesByMonth,
    sourceEffectiveness,
    avgTimeByStage,
    recruiterPerformance,
    conversionFunnel,
    error: null,
  }
}

// ─── Bulk Actions ──────────────────────────────────────────────────────────

export async function bulkUpdateStatus(
  ids: string[],
  newStatus: CandidateStatus
): Promise<{ success: boolean; error: string | null }> {
  if (ids.length === 0) return { success: true, error: null }

  const admin = createAdminClient()
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Get current statuses for stage log
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: currentCandidates } = await (admin as any).from("recruitment_candidates")
    .select("id, status")
    .in("id", ids)

  // Log stage transitions
  if (currentCandidates) {
    const logEntries = (currentCandidates as any[])
      .filter((c) => c.status !== newStatus)
      .map((c) => ({
        candidate_id: c.id,
        from_status: c.status,
        to_status: newStatus,
        changed_by: user?.id ?? null,
        notes: "Alteração em massa",
      }))

    if (logEntries.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (admin as any).from("recruitment_stage_log").insert(logEntries)
    }
  }

  // Update all candidates
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updateData: Record<string, any> = {
    status: newStatus,
    last_interaction_date: new Date().toISOString().split("T")[0],
  }

  if (newStatus === "joined" || newStatus === "declined") {
    updateData.decision_date = new Date().toISOString().split("T")[0]
    if (newStatus === "joined") updateData.decision = "joined"
    if (newStatus === "declined") updateData.decision = "declined"
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (admin as any).from("recruitment_candidates")
    .update(updateData)
    .in("id", ids)

  if (error) return { success: false, error: error.message }
  return { success: true, error: null }
}

export async function bulkAssignRecruiter(
  ids: string[],
  recruiterId: string
): Promise<{ success: boolean; error: string | null }> {
  if (ids.length === 0) return { success: true, error: null }

  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (admin as any).from("recruitment_candidates")
    .update({
      assigned_recruiter_id: recruiterId,
      last_interaction_date: new Date().toISOString().split("T")[0],
    })
    .in("id", ids)

  if (error) return { success: false, error: error.message }
  return { success: true, error: null }
}

export async function exportCandidatesCsv(filters?: {
  status?: CandidateStatus
  source?: CandidateSource
  recruiterId?: string
}): Promise<{ csv: string; error: string | null }> {
  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (admin as any).from("recruitment_candidates")
    .select("*, recruiter:dev_users!recruitment_candidates_assigned_recruiter_id_fkey(id, commercial_name)")
    .order("created_at", { ascending: false })

  if (filters?.status) query = query.eq("status", filters.status)
  if (filters?.source) query = query.eq("source", filters.source)
  if (filters?.recruiterId) query = query.eq("assigned_recruiter_id", filters.recruiterId)

  const { data, error } = await query
  if (error) return { csv: "", error: error.message }

  const candidates = (data ?? []) as (RecruitmentCandidate & { recruiter?: { id: string; commercial_name: string } | null })[]

  // Build CSV
  const headers = [
    "Nome", "Telefone", "Email", "Origem", "Estado", "Recrutador",
    "Primeiro Contacto", "Última Interacção", "Data Decisão", "Decisão",
    "Notas", "Criado Em",
  ]

  const rows = candidates.map((c) => [
    c.full_name,
    c.phone || "",
    c.email || "",
    c.source,
    c.status,
    c.recruiter?.commercial_name || "",
    c.first_contact_date || "",
    c.last_interaction_date || "",
    c.decision_date || "",
    c.decision || "",
    (c.notes || "").replace(/"/g, '""'),
    c.created_at.split("T")[0],
  ])

  const csvContent = [
    headers.join(","),
    ...rows.map((row) => row.map((cell) => `"${cell}"`).join(",")),
  ].join("\n")

  return { csv: csvContent, error: null }
}

// ─── Candidate Scoring ─────────────────────────────────────────────────────

export async function calculateCandidateScore(candidateId: string): Promise<{
  score: number
  breakdown: Record<string, number>
  error: string | null
}> {
  const admin = createAdminClient()
  const breakdown: Record<string, number> = {}
  let score = 0

  // Fetch candidate
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: candidate, error: candidateError } = await (admin as any).from("recruitment_candidates")
    .select("*")
    .eq("id", candidateId)
    .single()

  if (candidateError || !candidate) {
    return { score: 0, breakdown: {}, error: candidateError?.message ?? "Candidato não encontrado" }
  }

  // 1. Has phone & email: +10
  if (candidate.phone && candidate.email) {
    breakdown.contacto_completo = 10
    score += 10
  } else {
    breakdown.contacto_completo = 0
  }

  // 2. Has origin profile filled: +15
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: originProfile } = await (admin as any).from("recruitment_origin_profiles")
    .select("id")
    .eq("candidate_id", candidateId)
    .maybeSingle()

  if (originProfile) {
    breakdown.perfil_origem = 15
    score += 15
  } else {
    breakdown.perfil_origem = 0
  }

  // 3. Number of interviews (max 3 = +10 each, cap at +30)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: interviews } = await (admin as any).from("recruitment_interviews")
    .select("id")
    .eq("candidate_id", candidateId)

  const interviewCount = interviews?.length || 0
  const interviewScore = Math.min(interviewCount, 3) * 10
  breakdown.entrevistas = interviewScore
  score += interviewScore

  // 4. Has pain/pitch records with fit_score >= 4: +20
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: painPitch } = await (admin as any).from("recruitment_pain_pitch")
    .select("fit_score")
    .eq("candidate_id", candidateId)

  const hasGoodFit = (painPitch as any[] ?? []).some((pp) => pp.fit_score && pp.fit_score >= 4)
  if (hasGoodFit) {
    breakdown.pain_pitch = 20
    score += 20
  } else {
    breakdown.pain_pitch = 0
  }

  // 5. Response time (days between creation and first_contact_date, lower is better): +15 max
  if (candidate.first_contact_date) {
    const createdDate = new Date(candidate.created_at)
    const firstContact = new Date(candidate.first_contact_date)
    const daysDiff = Math.round((firstContact.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24))

    let responseScore = 0
    if (daysDiff <= 1) responseScore = 15
    else if (daysDiff <= 3) responseScore = 12
    else if (daysDiff <= 7) responseScore = 8
    else if (daysDiff <= 14) responseScore = 4
    else responseScore = 0

    breakdown.tempo_resposta = responseScore
    score += responseScore
  } else {
    breakdown.tempo_resposta = 0
  }

  // 6. Has recruiter assigned: +10
  if (candidate.assigned_recruiter_id) {
    breakdown.recrutador_atribuido = 10
    score += 10
  } else {
    breakdown.recrutador_atribuido = 0
  }

  return { score: Math.min(score, 100), breakdown, error: null }
}

// ─── Calendar: All Interviews ────────────────────────────────────────────────

export async function getAllInterviews(monthStart: string, monthEnd: string) {
  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (admin as any)
    .from("recruitment_interviews")
    .select(
      "id, candidate_id, interview_date, format, interview_number, notes, follow_up_date, candidate:recruitment_candidates!recruitment_interviews_candidate_id_fkey(id, full_name), interviewer:dev_users!recruitment_interviews_conducted_by_fkey(id, commercial_name)"
    )
    .gte("interview_date", monthStart)
    .lte("interview_date", monthEnd)
    .order("interview_date")

  if (error) return { interviews: [], error: error.message }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const interviews = ((data ?? []) as any[]).map((d: any) => ({
    id: d.id,
    candidate_id: d.candidate?.id ?? d.candidate_id,
    candidate_name: d.candidate?.full_name ?? "Desconhecido",
    interview_date: d.interview_date,
    format: d.format,
    interviewer_name: d.interviewer?.commercial_name ?? null,
    follow_up_date: d.follow_up_date,
    interview_number: d.interview_number,
    notes: d.notes,
  }))

  return { interviews, error: null }
}

// ─── Contract Templates ─────────────────────────────────────────────────

export async function getContractTemplates(): Promise<{ templates: any[]; error: string | null }> {
  const admin = createAdminClient()
  const { data, error } = await (admin as any).from("recruitment_contract_templates")
    .select("*")
    .eq("is_active", true)
    .order("name")
  if (error) return { templates: [], error: error.message }
  return { templates: data ?? [], error: null }
}

export async function createContractTemplate(template: {
  name: string
  description?: string
  content_html: string
  variables?: string[]
}): Promise<{ template: any | null; error: string | null }> {
  const admin = createAdminClient()
  const { data, error } = await (admin as any).from("recruitment_contract_templates")
    .insert({
      name: template.name,
      description: template.description || null,
      content_html: template.content_html,
      variables: template.variables || [],
    })
    .select()
    .single()
  if (error) return { template: null, error: error.message }
  return { template: data, error: null }
}

export async function updateContractTemplate(id: string, updates: {
  name?: string
  description?: string
  content_html?: string
  variables?: string[]
  is_active?: boolean
}): Promise<{ error: string | null }> {
  const admin = createAdminClient()
  const { error } = await (admin as any).from("recruitment_contract_templates")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", id)
  return { error: error?.message || null }
}

// ─── Contract Generation ────────────────────────────────────────────────

export async function generateContract(candidateId: string, templateId: string, contractData: Record<string, string>): Promise<{ contract: any | null; error: string | null }> {
  const admin = createAdminClient()

  // Get template
  const { data: template, error: tplErr } = await (admin as any).from("recruitment_contract_templates")
    .select("*")
    .eq("id", templateId)
    .single()
  if (tplErr || !template) return { contract: null, error: tplErr?.message || "Template não encontrado" }

  // Replace variables in template HTML
  let html = template.content_html as string
  for (const [key, value] of Object.entries(contractData)) {
    html = html.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value || '')
  }

  // Save contract
  const { data, error } = await (admin as any).from("recruitment_contracts")
    .insert({
      candidate_id: candidateId,
      template_id: templateId,
      contract_data: contractData,
      generated_html: html,
      status: 'draft',
    })
    .select()
    .single()
  if (error) return { contract: null, error: error.message }
  return { contract: data, error: null }
}

export async function getContracts(candidateId: string): Promise<{ contracts: any[]; error: string | null }> {
  const admin = createAdminClient()
  const { data, error } = await (admin as any).from("recruitment_contracts")
    .select("*, template:recruitment_contract_templates(id, name)")
    .eq("candidate_id", candidateId)
    .order("created_at", { ascending: false })
  if (error) return { contracts: [], error: error.message }
  return { contracts: data ?? [], error: null }
}

export async function updateContractStatus(contractId: string, status: string, sentToEmail?: string): Promise<{ error: string | null }> {
  const admin = createAdminClient()
  const updates: Record<string, any> = { status, updated_at: new Date().toISOString() }
  if (status === 'sent') {
    updates.sent_at = new Date().toISOString()
    if (sentToEmail) updates.sent_to_email = sentToEmail
  }
  const { error } = await (admin as any).from("recruitment_contracts")
    .update(updates)
    .eq("id", contractId)
  return { error: error?.message || null }
}

// ─── Linked Entry Submission ────────────────────────────────────────────

export async function getLinkedSubmission(candidateId: string): Promise<{ submission: any | null; error: string | null }> {
  const admin = createAdminClient()
  const { data, error } = await (admin as any).from("recruitment_entry_submissions")
    .select("*")
    .eq("candidate_id", candidateId)
    .single()
  if (error && error.code !== 'PGRST116') return { submission: null, error: error.message }
  return { submission: data || null, error: null }
}

export async function linkSubmissionToCandidate(submissionId: string, candidateId: string): Promise<{ error: string | null }> {
  const admin = createAdminClient()
  const { error } = await (admin as any).from("recruitment_entry_submissions")
    .update({ candidate_id: candidateId, updated_at: new Date().toISOString() })
    .eq("id", submissionId)
  return { error: error?.message || null }
}

// ─── Create Consultor from Candidate ────────────────────────────────────

export async function createConsultorFromCandidate(candidateId: string, data: {
  professional_email: string
  commercial_name: string
  full_name: string
  nif?: string
  iban?: string
  address_private?: string
  commission_rate?: number
  monthly_salary?: number
  hiring_date?: string
  profile_photo_url?: string
  phone_commercial?: string
  instagram_handle?: string
}): Promise<{ userId: string | null; error: string | null }> {
  const admin = createAdminClient()

  // 1. Get the "Consultor" role
  const { data: role, error: roleErr } = await (admin as any).from("roles")
    .select("id")
    .eq("name", "Consultor")
    .single()
  if (roleErr || !role) return { userId: null, error: "Role 'Consultor' não encontrada" }

  // 2. Create auth user (invite)
  const { data: authData, error: authErr } = await admin.auth.admin.createUser({
    email: data.professional_email,
    email_confirm: false,
    user_metadata: { full_name: data.full_name },
  })
  if (authErr || !authData.user) return { userId: null, error: authErr?.message || "Erro ao criar utilizador" }

  const userId = authData.user.id

  // 3. Create dev_users record
  const { error: userErr } = await (admin as any).from("dev_users").insert({
    id: userId,
    role_id: role.id,
    commercial_name: data.commercial_name,
    professional_email: data.professional_email,
    is_active: true,
  })
  if (userErr) return { userId: null, error: userErr.message }

  // 4. Create dev_consultant_profiles
  await (admin as any).from("dev_consultant_profiles").insert({
    user_id: userId,
    profile_photo_url: data.profile_photo_url || null,
    phone_commercial: data.phone_commercial || null,
    instagram_handle: data.instagram_handle || null,
  })

  // 5. Create dev_consultant_private_data
  await (admin as any).from("dev_consultant_private_data").insert({
    user_id: userId,
    full_name: data.full_name,
    nif: data.nif || null,
    iban: data.iban || null,
    address_private: data.address_private || null,
    commission_rate: data.commission_rate || null,
    monthly_salary: data.monthly_salary || null,
    hiring_date: data.hiring_date || null,
  })

  // 6. Link candidate to consultant
  await (admin as any).from("recruitment_candidates")
    .update({ consultant_user_id: userId, updated_at: new Date().toISOString() })
    .eq("id", candidateId)

  // 7. Auto-start probation
  const startDate = data.hiring_date || new Date().toISOString().slice(0, 10)
  const endDate = new Date(new Date(startDate).getTime() + 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  await (admin as any).from("temp_recruitment_probation").upsert({
    candidate_id: candidateId,
    start_date: startDate,
    end_date: endDate,
    status: 'active',
  }, { onConflict: 'candidate_id' })

  return { userId, error: null }
}
