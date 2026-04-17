// Types for Custom Commemorative Events

export interface CustomEvent {
  id: string
  consultant_id: string
  name: string
  description: string | null
  event_date: string // ISO date (yyyy-mm-dd)
  send_hour: number
  is_recurring: boolean
  channels: string[]
  email_template_id: string | null
  wpp_template_id: string | null
  smtp_account_id: string | null
  wpp_instance_id: string | null
  status: "active" | "paused" | "archived"
  last_triggered_year: number | null
  created_at: string
  updated_at: string
}

export interface CustomEventLead {
  event_id: string
  lead_id: string
  added_at: string
}

export interface CustomEventWithCounts extends CustomEvent {
  lead_count: number
  last_sent_at: string | null
}

export interface CustomEventWithLeads extends CustomEvent {
  leads: Array<{
    lead_id: string
    added_at: string
    lead_name: string | null
    lead_email: string | null
    lead_phone: string | null
    lead_status: string | null
  }>
}

export interface CustomEventRun {
  id: string
  kind: string
  lead_id: string | null
  event_type: string | null
  custom_event_id: string | null
  auto_run_id: string | null
  scheduled_for: string
  sent_at: string | null
  status: string
  skip_reason: string | null
  error: string | null
  delivery_log_ids: string[] | null
  lead_name?: string | null
  lead_email?: string | null
  smtp_account_email?: string | null
  wpp_instance_name?: string | null
}

export interface CustomEventDetail extends CustomEvent {
  lead_count: number
  leads: Array<{
    lead_id: string
    added_at: string
    name: string | null
    email: string | null
    telemovel: string | null
    status: string | null
  }>
  runs: CustomEventRun[]
}

export type CustomEventFormData = {
  name: string
  description?: string
  event_date: string
  send_hour: number
  is_recurring: boolean
  channels: string[]
  email_template_id?: string | null
  wpp_template_id?: string | null
  smtp_account_id?: string | null
  wpp_instance_id?: string | null
}
