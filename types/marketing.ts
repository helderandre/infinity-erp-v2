// Types for Marketing Shop & Conta Corrente

export type MarketingCategory = 'photography' | 'video' | 'design' | 'physical_materials' | 'ads' | 'social_media' | 'other'

export type MarketingOrderStatus = 'pending' | 'accepted' | 'scheduled' | 'in_production' | 'delivered' | 'completed' | 'rejected' | 'cancelled'

export type MarketingRequestStatus = 'pending' | 'scheduled' | 'in_progress' | 'completed' | 'cancelled'

export type ContaCorrenteType = 'DEBIT' | 'CREDIT'

export type ContaCorrenteCategory =
  | 'marketing_purchase' | 'physical_material' | 'fee_registration' | 'fee_renewal'
  | 'fee_technology' | 'fee_process_management' | 'manual_adjustment'
  | 'commission_payment' | 'refund'

// --- Catalog ---

export interface MarketingCatalogAddon {
  id: string
  parent_service_id: string
  name: string
  description: string
  price: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface MarketingCatalogItem {
  id: string
  name: string
  description: string
  category: MarketingCategory
  price: number
  estimated_delivery_days: number
  thumbnail: string | null
  is_active: boolean
  requires_scheduling: boolean
  requires_property: boolean
  is_subscription: boolean
  billing_cycle: string | null
  created_at: string
  updated_at: string
  addons?: MarketingCatalogAddon[]
}

// --- Packs ---

export interface MarketingPack {
  id: string
  name: string
  description: string
  price: number
  thumbnail: string | null
  is_active: boolean
  created_at: string
  updated_at: string
  items?: MarketingCatalogItem[]
}

export interface MarketingPackItem {
  id: string
  pack_id: string
  catalog_item_id: string
  catalog_item?: MarketingCatalogItem
}

// --- Orders ---

export interface MarketingOrder {
  id: string
  agent_id: string
  property_id: string | null
  status: MarketingOrderStatus
  total_amount: number
  rejection_reason: string | null
  cancellation_reason: string | null
  internal_notes: string | null
  assigned_to: string | null
  checkout_group_id: string | null
  created_at: string
  updated_at: string
  // Joined
  agent?: { id: string; commercial_name: string }
  property?: { id: string; title: string; slug: string } | null
  items?: MarketingOrderItem[]
}

export interface MarketingOrderItem {
  id: string
  order_id: string
  catalog_item_id: string | null
  pack_id: string | null
  name: string
  price: number
  status: 'available' | 'used' | 'expired'
  quantity: number
  used_count: number
  // Joined
  catalog_item?: MarketingCatalogItem
  pack?: MarketingPack
}

export interface MarketingOrderDeliverable {
  id: string
  order_id: string
  file_url: string
  file_name: string
  file_type: string | null
  file_size: number | null
  uploaded_by: string | null
  created_at: string
}

// --- Marketing Requests (when user "uses" a purchased item) ---

export interface MarketingRequest {
  id: string
  order_item_id: string
  agent_id: string
  status: MarketingRequestStatus
  property_id: string | null
  address: string | null
  postal_code: string | null
  city: string | null
  parish: string | null
  floor_door: string | null
  access_instructions: string | null
  preferred_date: string | null
  preferred_time: string | null
  alternative_date: string | null
  alternative_time: string | null
  confirmed_date: string | null
  confirmed_time: string | null
  property_type: string | null
  typology: string | null
  area_m2: number | null
  has_exteriors: boolean
  has_facades: boolean
  is_occupied: boolean
  is_staged: boolean
  number_of_divisions: number | null
  parking_available: boolean
  contact_is_agent: boolean
  contact_name: string | null
  contact_phone: string | null
  contact_relationship: string | null
  contact_observations: string | null
  assigned_to: string | null
  internal_notes: string | null
  created_at: string
  updated_at: string
  // Joined
  order_item?: MarketingOrderItem
  agent?: { id: string; commercial_name: string }
  property?: { id: string; title: string; slug: string } | null
}

// --- Conta Corrente ---

export interface ContaCorrenteTransaction {
  id: string
  agent_id: string
  date: string
  type: ContaCorrenteType
  category: ContaCorrenteCategory
  amount: number
  description: string
  reference_id: string | null
  reference_type: string | null
  balance_after: number
  created_by: string | null
  created_at: string
  // Joined
  agent?: { id: string; commercial_name: string }
}

export interface ContaCorrenteLimit {
  id: string
  agent_id: string
  credit_limit: number
  created_at: string
  updated_at: string
}

export interface AgentBalance {
  agent_id: string
  commercial_name: string
  profile_photo_url: string | null
  current_balance: number
  credit_limit: number | null
}

// --- Subscriptions ---

export type SubscriptionStatus = 'active' | 'paused' | 'cancelled' | 'expired' | 'billing_failed'

export interface MarketingSubscription {
  id: string
  agent_id: string
  order_item_id: string
  catalog_item_id: string
  status: SubscriptionStatus
  billing_cycle: 'monthly' | 'quarterly' | 'yearly'
  price_per_cycle: number
  started_at: string
  current_period_start: string
  current_period_end: string
  next_billing_date: string
  cancelled_at: string | null
  cancel_at_period_end: boolean
  paused_at: string | null
  failed_billing_count: number
  last_billing_error: string | null
  last_billing_attempt: string | null
  created_at: string
  updated_at: string
  // Joined
  catalog_item?: MarketingCatalogItem
  order_item?: MarketingOrderItem
}

export interface SubscriptionBillingLog {
  id: string
  subscription_id: string
  billing_date: string
  amount: number
  status: 'success' | 'failed'
  transaction_id: string | null
  error_message: string | null
  created_at: string
}

// --- Gestão calendar/history ---

export type CalendarEventType = 'service_scheduled' | 'purchase' | 'subscription_renewal'

export interface GestaoCalendarEvent {
  date: string
  type: CalendarEventType
  label: string
  metadata: Record<string, unknown>
}

export interface GestaoHistoryItem {
  id: string
  type: 'service_used' | 'material_delivered'
  name: string
  date: string
  amount?: number
  metadata: Record<string, unknown>
}

// --- Campaigns ---

export type CampaignStatus = 'pending' | 'approved' | 'active' | 'paused' | 'completed' | 'rejected' | 'cancelled'

export interface MarketingCampaign {
  id: string
  agent_id: string
  property_id: string | null
  promote_url: string | null
  objective: string
  target_zone: string | null
  target_age_min: number | null
  target_age_max: number | null
  target_interests: string | null
  budget_type: 'daily' | 'total'
  budget_amount: number
  duration_days: number
  total_cost: number
  creative_notes: string | null
  status: CampaignStatus
  rejection_reason: string | null
  checkout_group_id: string | null
  payment_method: string
  created_at: string
  updated_at: string
  // Joined
  agent?: { id: string; commercial_name: string }
  property?: { id: string; title: string; slug: string } | null
}

// --- Cart types for shop (shared with shop-tab) ---

export interface CartPropertyBundle {
  type: 'property_bundle'
  propertyId: string | null
  propertyInfo: {
    address: string
    postal_code: string
    city: string
    parish: string
    floor_door?: string
    access_instructions?: string
    property_type?: string
    typology?: string
    area_m2?: number
    has_exteriors: boolean
    has_facades: boolean
    is_occupied: boolean
    is_staged: boolean
    parking_available: boolean
    number_of_divisions?: number
  }
  propertyTitle: string
  services: Array<{
    service: MarketingCatalogItem
    selectedAddons: MarketingCatalogAddon[]
  }>
  availability?: {
    will_be_present: boolean
    replacement_name?: string
    replacement_phone?: string
    preferred_dates: Array<{ date: string; time_slot: string }>
    notes?: string
  }
}

export interface CartCampaignItem {
  type: 'campaign'
  campaignData: {
    objective: string
    property_id?: string
    promote_url?: string
    target_zone?: string
    target_age_min?: number
    target_age_max?: number
    target_interests?: string
    budget_type: 'daily' | 'total'
    budget_amount: number
    duration_days: number
    creative_notes?: string
  }
  totalCost: number
  label: string
}
