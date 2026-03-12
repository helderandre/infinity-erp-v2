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
