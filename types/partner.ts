export type PartnerCategory =
  | 'supplier'
  | 'lawyer'
  | 'notary'
  | 'bank'
  | 'photographer'
  | 'constructor'
  | 'insurance'
  | 'energy_cert'
  | 'cleaning'
  | 'moving'
  | 'appraiser'
  | 'architect'
  | 'home_staging'
  | 'credit_broker'
  | 'interior_design'
  | 'marketing'
  | 'other'

export type PartnerVisibility = 'public' | 'private'
export type PersonType = 'singular' | 'coletiva'
export type PaymentMethod = 'transfer' | 'check' | 'cash' | 'other'

export interface Partner {
  id: string
  name: string
  person_type: PersonType
  nif: string | null
  category: PartnerCategory
  visibility: PartnerVisibility

  email: string | null
  phone: string | null
  phone_secondary: string | null
  website: string | null
  address: string | null
  city: string | null
  postal_code: string | null
  contact_person: string | null

  specialties: string[] | null
  service_areas: string[] | null
  commercial_conditions: string | null
  payment_method: PaymentMethod | null

  rating_avg: number
  rating_count: number
  is_recommended: boolean
  internal_notes: string | null

  average_delivery_days: number | null
  payment_terms: string | null

  is_active: boolean
  created_at: string
  updated_at: string
  created_by: string | null
}

export interface PartnerRating {
  id: string
  partner_id: string
  user_id: string
  rating: number
  comment: string | null
  created_at: string
  user?: {
    id: string
    commercial_name: string | null
  }
}

export interface PartnerFilters {
  category?: PartnerCategory
  visibility?: PartnerVisibility
  is_active?: boolean
  search?: string
  is_recommended?: boolean
}
