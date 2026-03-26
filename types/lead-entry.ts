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
  campaign?: { id: string; name: string; platform: string } | null
  assigned_consultant?: { id: string; commercial_name: string } | null
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
