export type LeadStatus =
  | "new"
  | "contacted"
  | "qualified"
  | "proposal_sent"
  | "negotiation"
  | "won"
  | "lost"
  | "cancelled"
  | "junk"

export type LeadSource =
  | "website_form"
  | "meta_ads"
  | "google_ads"
  | "manual"
  | "referral"
  | "linkedin"
  | "marketplace"
  | "other"

export interface Lead {
  id: string
  full_name: string
  email: string | null
  phone: string | null
  company_name: string | null
  source: LeadSource
  source_detail: string | null
  form_id: string | null
  status: LeadStatus
  assigned_to: string | null
  notes: string | null
  tags: string[]
  meta_data: Record<string, unknown>
  job_title: string | null
  city: string | null
  state: string | null
  zip_code: string | null
  country: string | null
  street_address: string | null
  platform: string | null
  ig_username: string | null
  converted_to_client_id: string | null
  converted_at: string | null
  last_contacted_at: string | null
  created_at: string
  updated_at: string
  is_archived: boolean
  deleted_at: string | null
}

export interface LeadActivity {
  id: string
  lead_id: string
  performed_by: string | null
  activity_type: string
  title: string
  description: string | null
  metadata: Record<string, unknown>
  created_at: string
}
