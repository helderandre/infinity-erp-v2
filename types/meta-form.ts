export type FieldType =
  | "text"
  | "email"
  | "phone"
  | "textarea"
  | "select"
  | "checkbox"
  | "number"
  | "date"

export type LeadSource =
  | "website_form"
  | "meta_ads"
  | "google_ads"
  | "manual"
  | "referral"
  | "linkedin"
  | "marketplace"
  | "other"

export interface FormField {
  id: string
  type: FieldType
  label: string
  placeholder?: string
  required: boolean
  options?: string[] // for select / checkbox
  width?: "full" | "half"
}

export interface FormSettings {
  submit_button_text?: string
  thank_you_message?: string
  redirect_url?: string
  notification_email?: string
  meta_pixel_id?: string
  meta_event_name?: string
}

export interface Form {
  id: string
  name: string
  slug: string
  description: string | null
  fields: FormField[]
  settings: FormSettings
  is_active: boolean
  source_tag: LeadSource
  submission_count: number
  created_by: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export interface FormSubmission {
  id: string
  form_id: string
  lead_id: string | null
  data: Record<string, string>
  ip_address: string | null
  user_agent: string | null
  referrer: string | null
  utm_params: Record<string, string>
  created_at: string
}
