// Types for Marketing Shop & Conta Corrente

export type MarketingCategory = 'photography' | 'video' | 'design' | 'physical_materials' | 'ads' | 'social_media' | 'other'

export type MarketingOrderStatus = 'pending' | 'accepted' | 'scheduled' | 'in_production' | 'delivered' | 'completed' | 'rejected' | 'cancelled'

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
  internal_notes: string | null
  assigned_to: string | null
  confirmed_date: string | null
  confirmed_time: string | null
  calendar_event_id: string | null
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
  current_balance: number
  credit_limit: number | null
}
