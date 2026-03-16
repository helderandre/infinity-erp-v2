export type VisitStatus = 'scheduled' | 'confirmed' | 'completed' | 'cancelled' | 'no_show'
export type FeedbackInterest = 'very_interested' | 'interested' | 'neutral' | 'not_interested'
export type FeedbackNextStep = 'second_visit' | 'proposal' | 'discard' | 'thinking'
export type ConfirmationMethod = 'whatsapp' | 'phone' | 'email' | 'sms'

export interface Visit {
  id: string
  property_id: string
  consultant_id: string
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
  client_name: string | null
  client_phone: string | null
  client_email: string | null
  notes: string | null
  calendar_event_id: string | null
  external_calendar_id: string | null
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
  consultant_id?: string
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
