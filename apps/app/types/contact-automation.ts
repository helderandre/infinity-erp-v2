export const CONTACT_AUTOMATION_EVENT_TYPES = [
  "aniversario_contacto",
  "aniversario_fecho",
  "natal",
  "ano_novo",
  "festividade",
] as const

export type ContactAutomationEventType = (typeof CONTACT_AUTOMATION_EVENT_TYPES)[number]

export const CONTACT_AUTOMATION_EVENT_LABELS_PT: Record<ContactAutomationEventType, string> = {
  aniversario_contacto: "Aniversário do contacto",
  aniversario_fecho: "Aniversário de fecho de negócio",
  natal: "Natal",
  ano_novo: "Ano Novo",
  festividade: "Festividade personalizada",
}

export type ContactAutomationChannel = "email" | "whatsapp"
export type ContactAutomationRecurrence = "once" | "yearly"
export type ContactAutomationStatus = "scheduled" | "completed" | "cancelled" | "failed"
export type ContactAutomationRunStatus = "pending" | "sent" | "failed" | "skipped"

export interface FestividadeEventConfig {
  label: string
  month: number // 1-12
  day: number // 1-31
}

export interface ContactAutomationEventConfig {
  label?: string
  month?: number
  day?: number
}

export interface TemplateOverrides {
  email?: { subject?: string; body_html?: string }
  whatsapp?: { messages?: unknown[] }
}

export interface ContactAutomation {
  id: string
  contact_id: string
  deal_id: string | null
  event_type: ContactAutomationEventType
  event_config: ContactAutomationEventConfig
  channels: ContactAutomationChannel[]
  email_template_id: string | null
  wpp_template_id: string | null
  smtp_account_id: string | null
  wpp_instance_id: string | null
  template_overrides: TemplateOverrides
  recurrence: ContactAutomationRecurrence
  send_hour: number
  timezone: string
  trigger_at: string
  status: ContactAutomationStatus
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface ContactAutomationRun {
  id: string
  contact_automation_id: string
  auto_run_id: string | null
  scheduled_for: string
  sent_at: string | null
  status: ContactAutomationRunStatus
  skip_reason: string | null
  error: string | null
  delivery_log_ids: string[]
  created_at: string
}

/** Flow sentinela reservado para runs efémeros de contact_automations. */
export const CONTACT_AUTOMATIONS_SENTINEL_FLOW_ID = "00000000-0000-0000-0000-00000c0a0a17"
