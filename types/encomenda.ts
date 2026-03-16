// Types for Encomendas (Physical Materials & Stock)

export type RequisitionStatus = 'pending' | 'approved' | 'rejected' | 'in_production' | 'ready' | 'delivered' | 'cancelled' | 'partially_delivered'

export type RequisitionPriority = 'low' | 'normal' | 'high' | 'urgent'

export type DeliveryType = 'pickup' | 'delivery'

export type SupplierOrderStatus = 'draft' | 'sent' | 'confirmed' | 'in_production' | 'shipped' | 'partially_received' | 'received' | 'cancelled'

export type StockMovementType = 'in_purchase' | 'in_return' | 'in_adjustment' | 'out_requisition' | 'out_damage' | 'out_adjustment'

export type ReturnCondition = 'good' | 'damaged' | 'destroyed'

export type PersonalizationFieldType = 'text' | 'textarea' | 'select' | 'image'

export interface PersonalizationField {
  key: string
  label: string
  type: PersonalizationFieldType
  required: boolean
  options?: string[]
  placeholder?: string
}

// --- Product Categories ---

export interface ProductCategory {
  id: string
  name: string
  description: string | null
  icon: string | null
  sort_order: number
  is_active: boolean
  created_at: string
  updated_at: string
}

// --- Products ---

export interface Product {
  id: string
  category_id: string
  supplier_id: string | null
  name: string
  description: string | null
  sku: string | null
  unit_cost: number | null
  sell_price: number
  thumbnail_url: string | null
  is_personalizable: boolean
  personalization_fields: PersonalizationField[] | null
  is_property_linked: boolean
  requires_approval: boolean
  approval_threshold: number | null
  min_stock_alert: number
  is_returnable: boolean
  is_active: boolean
  created_at: string
  updated_at: string
  // Joined
  category?: ProductCategory
  supplier?: Supplier | null
  variants?: ProductVariant[]
  templates?: ProductTemplate[]
  stock?: StockRecord[]
}

// --- Product Variants ---

export interface ProductVariant {
  id: string
  product_id: string
  name: string
  sku_suffix: string | null
  additional_cost: number
  thumbnail_url: string | null
  is_active: boolean
  sort_order: number
  created_at: string
}

// --- Product Templates ---

export interface ProductTemplate {
  id: string
  product_id: string
  name: string
  file_url: string
  file_type: string | null
  is_current: boolean
  version: string | null
  notes: string | null
  uploaded_by: string | null
  created_at: string
}

// --- Suppliers ---

export interface Supplier {
  id: string
  name: string
  contact_name: string | null
  email: string | null
  phone: string | null
  website: string | null
  nif: string | null
  address: string | null
  city: string | null
  postal_code: string | null
  notes: string | null
  average_delivery_days: number | null
  payment_terms: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

// --- Stock ---

export interface StockRecord {
  id: string
  product_id: string
  variant_id: string | null
  location: string
  quantity_available: number
  quantity_reserved: number
  quantity_on_order: number
  last_restock_at: string | null
  created_at: string
  updated_at: string
  // Joined
  product?: Product
  variant?: ProductVariant | null
}

export interface StockMovement {
  id: string
  stock_id: string
  movement_type: StockMovementType
  quantity: number
  reference_type: string | null
  reference_id: string | null
  notes: string | null
  performed_by: string
  created_at: string
  // Joined
  performer?: { id: string; commercial_name: string }
}

// --- Requisitions ---

export interface Requisition {
  id: string
  reference: string
  agent_id: string
  property_id: string | null
  status: RequisitionStatus
  priority: RequisitionPriority
  total_amount: number
  delivery_type: DeliveryType
  delivery_address: string | null
  delivery_notes: string | null
  requested_delivery_date: string | null
  actual_delivery_date: string | null
  rejection_reason: string | null
  cancellation_reason: string | null
  approved_by: string | null
  approved_at: string | null
  delivered_by: string | null
  internal_notes: string | null
  conta_corrente_tx_id: string | null
  created_at: string
  updated_at: string
  // Joined
  agent?: { id: string; commercial_name: string }
  property?: { id: string; title: string; slug: string } | null
  items?: RequisitionItem[]
  approved_by_user?: { id: string; commercial_name: string } | null
}

export interface RequisitionItem {
  id: string
  requisition_id: string
  product_id: string
  variant_id: string | null
  quantity: number
  unit_price: number
  subtotal: number
  personalization_data: Record<string, any> | null
  status: string
  notes: string | null
  created_at: string
  // Joined
  product?: Product
  variant?: ProductVariant | null
}

// --- Supplier Orders ---

export interface SupplierOrder {
  id: string
  reference: string
  supplier_id: string
  status: SupplierOrderStatus
  total_cost: number
  expected_delivery_date: string | null
  actual_delivery_date: string | null
  invoice_reference: string | null
  invoice_url: string | null
  notes: string | null
  ordered_by: string
  received_by: string | null
  created_at: string
  updated_at: string
  // Joined
  supplier?: Supplier
  items?: SupplierOrderItem[]
  ordered_by_user?: { id: string; commercial_name: string }
}

export interface SupplierOrderItem {
  id: string
  supplier_order_id: string
  product_id: string
  variant_id: string | null
  quantity_ordered: number
  quantity_received: number
  unit_cost: number
  subtotal: number
  notes: string | null
  created_at: string
  // Joined
  product?: Product
  variant?: ProductVariant | null
}

// --- Returns ---

export interface Return {
  id: string
  requisition_item_id: string | null
  product_id: string
  variant_id: string | null
  agent_id: string
  quantity: number
  condition: ReturnCondition
  refund_amount: number
  reason: string | null
  processed_by: string | null
  processed_at: string | null
  conta_corrente_tx_id: string | null
  created_at: string
  // Joined
  agent?: { id: string; commercial_name: string }
  product?: Product
  variant?: ProductVariant | null
}
