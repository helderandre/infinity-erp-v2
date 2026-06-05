export type VisitStatus = 'proposal' | 'rejected' | 'scheduled' | 'completed' | 'no_show' | 'cancelled'
export type FeedbackInterest = 'very_interested' | 'interested' | 'neutral' | 'not_interested'
export type FeedbackNextStep = 'second_visit' | 'proposal' | 'discard' | 'thinking'
export type ConfirmationMethod = 'whatsapp' | 'phone' | 'email' | 'sms'

export interface Visit {
  id: string
  property_id: string
  consultant_id: string
  /**
   * Snapshot do consultor da angariação no momento da criação da visita.
   * Preenchido automaticamente pelo trigger `trg_visits_snapshot_seller_consultant`
   * a partir de `dev_properties.consultant_id`. Não muda quando a angariação é
   * reatribuída — protege o histórico para os relatórios de objectivos.
   */
  seller_consultant_id: string | null
  lead_id: string | null
  visit_date: string
  visit_time: string
  duration_minutes: number
  status: VisitStatus
  confirmed_at: string | null
  confirmed_by: string | null
  confirmation_method: ConfirmationMethod | null
  feedback_rating: number | null
  feedback_interest: FeedbackInterest | null
  feedback_notes: string | null
  feedback_next_step: FeedbackNextStep | null
  feedback_submitted_at: string | null
  cancelled_reason: string | null
  cancelled_by: string | null
  // Workflow proposal/outcome (introduzido em 20260408_visits_proposal_workflow.sql)
  proposal_responded_at: string | null
  proposal_responded_by: string | null
  rejected_reason: string | null
  outcome_set_at: string | null
  outcome_set_by: string | null
  outcome_prompt_fallback_sent_at: string | null
  client_name: string | null
  client_phone: string | null
  client_email: string | null
  notes: string | null
  created_at: string
  updated_at: string
  created_by: string | null
}

export interface VisitWithRelations extends Visit {
  property?: {
    id: string
    title: string
    external_ref: string | null
    city: string | null
    zone: string | null
    address_street: string | null
    slug: string | null
  }
  consultant?: {
    id: string
    commercial_name: string | null
  }
  lead?: {
    id: string
    name: string
    telemovel: string | null
    email: string | null
  }
}

export interface VisitFilters {
  status?: VisitStatus
  statuses?: string[]
  consultant_id?: string
  consultant_ids?: string[]
  property_id?: string
  lead_id?: string
  date_from?: string
  date_to?: string
  search?: string
}

export interface VisitFeedbackInput {
  feedback_rating: number
  feedback_interest: FeedbackInterest
  feedback_notes?: string
  feedback_next_step: FeedbackNextStep
}
