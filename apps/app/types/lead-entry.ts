// Types for Leads Entries (inbound leads from Meta Ads, manual, voice, etc.)
// These reference the old `leads` table as "contactos" (contact_id → leads.id)

export type LeadEntryStatus = 'new' | 'seen' | 'processing' | 'converted' | 'discarded'

export type LeadEntrySource = 'meta_ads' | 'google_ads' | 'website' | 'landing_page' | 'manual' | 'voice' | 'partner' | 'organic' | 'walk_in' | 'phone_call' | 'social_media' | 'other'

export type LeadMatchType = 'phone' | 'email' | 'both' | 'none'

export interface LeadEntry {
  id: string
  contact_id: string
  source: LeadEntrySource
  campaign_id: string | null
  partner_id: string | null
  utm_source: string | null
  utm_medium: string | null
  utm_campaign: string | null
  utm_content: string | null
  utm_term: string | null
  form_data: Record<string, unknown> | null
  form_url: string | null
  raw_name: string | null
  raw_email: string | null
  raw_phone: string | null
  match_type: LeadMatchType | null
  match_details: {
    matched_contact_id?: string
    matched_by_phone?: boolean
    matched_by_email?: boolean
    phone_contact_id?: string
    email_contact_id?: string
    is_duplicate_conflict?: boolean
  } | null
  status: LeadEntryStatus
  assigned_consultant_id: string | null
  processed_at: string | null
  processed_by: string | null
  notes: string | null
  created_at: string
  // Joined
  contact?: {
    id: string
    nome: string
    email: string | null
    telemovel: string | null
    agent_id: string | null
    agent?: { id: string; commercial_name: string } | null
  }
  campaign?: {
    id: string
    name: string
    platform: string
    external_campaign_id?: string | null
    status?: string | null
    start_date?: string | null
    end_date?: string | null
  } | null
  // Hydrated server-side from meta.meta_campaigns_raw when the joined `campaign`
  // is missing but form_data carries the Meta IDs — used to render the Campanha
  // card for Meta Ads leads that bypassed the leads_campaigns mirror.
  meta_campaign?: {
    id: string
    name: string | null
    platform: 'meta'
    status?: string | null
    objective?: string | null
    start_date?: string | null
    end_date?: string | null
  } | null
  meta_ad?: {
    id: string
    name: string | null
    status?: string | null
    creative_name?: string | null
  } | null
  // Hydrated server-side from form_data.raw_fields + the Meta form definition
  // (meta.meta_forms_raw) — the humanized question/answer pairs (field name →
  // question label, option key → human value), so the sheet renders the same
  // form responses as the Análise → Meta section instead of raw Meta keys.
  form_answers?: {
    name: string
    label: string
    type: string | null
    value: string
  }[]
  // Joined from leads_entries.property_id → dev_properties. This is the
  // canonical source for "imóvel associado a esta entrada" — consultants can
  // attach a property to a lead-entry after ingestion, so always prefer this
  // over form_data.property_* (which is only populated by some ingestion paths).
  property?: {
    id: string
    title: string | null
    slug: string | null
    external_ref: string | null
  } | null
  property_id?: string | null
  property_external_ref?: string | null
  assigned_consultant?: { id: string; commercial_name: string } | null
  // Referral denormalization (set on the entry so the "Referenciação" block
  // renders). For internal consultor→consultor referrals these are populated
  // by POST /api/crm/referrals; the referrer's free-text note lives in the
  // joined `referrals` rows (leads_referrals.notes), not on the entry.
  has_referral?: boolean | null
  referral_pct?: number | null
  referral_consultant_id?: string | null
  referral_consultant?: { id: string; commercial_name: string } | null
  referral_external_name?: string | null
  referral_external_phone?: string | null
  referral_external_email?: string | null
  referral_external_agency?: string | null
  referrals?: Array<{
    id: string
    status: string
    notes: string | null
    referral_pct: number | null
    from_consultant_id: string | null
    to_consultant_id: string | null
    created_at: string
    referrer?: { id: string; commercial_name: string } | null
  }> | null
}

export interface LeadCampaign {
  id: string
  name: string
  platform: string
  external_campaign_id: string | null
  status: string
  budget: number | null
  start_date: string | null
  end_date: string | null
  created_at: string
}

export interface LeadSettings {
  id: string
  key: string
  value: string
  label: string
  description: string | null
  category: string
  options: string[] | null
}
