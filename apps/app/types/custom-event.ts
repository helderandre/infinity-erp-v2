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

export type ChannelEffectiveState = "active" | "unavailable" | "off"

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
  /**
   * Computado server-side a partir de event.channels + contas do consultor.
   * Única fonte de verdade para os chips visuais.
   */
  effective_channels: {
    email: ChannelEffectiveState
    whatsapp: ChannelEffectiveState
  }
}

export interface HealthSummaryFailedItem {
  run_id: string
  lead_id: string
  lead_name: string | null
  error_short: string | null
}

export interface HealthSummaryRow {
  /** 'aniversario_contacto' | 'natal' | 'ano_novo' | `custom:<uuid>` */
  event_key: string
  last_run_at: string | null
  last_run_status: "sent" | "failed" | "skipped" | "pending" | null
  runs_last_30d: { sent: number; failed: number; skipped: number; pending: number }
  failed_unresolved: HealthSummaryFailedItem[]
  /** Pode exceder failed_unresolved.length (cap de 5 no payload). */
  failed_unresolved_count: number
  /** true apenas se custom event com is_recurring=false e ≥1 sent. */
  completed_one_shot: boolean
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
