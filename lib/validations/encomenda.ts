import { z } from 'zod'

export const createProductSchema = z.object({
  category_id: z.string().min(1, 'Categoria obrigatória'),
  supplier_id: z.string().optional().nullable(),
  name: z.string().min(1, 'Nome obrigatório').max(200),
  description: z.string().optional().nullable(),
  sku: z.string().optional().nullable(),
  unit_cost: z.number().min(0).optional().nullable(),
  sell_price: z.number().min(0, 'Preço obrigatório'),
  is_personalizable: z.boolean().default(false),
  personalization_fields: z.array(z.object({
    key: z.string(),
    label: z.string(),
    type: z.enum(['text', 'textarea', 'select', 'image']),
    required: z.boolean(),
    options: z.array(z.string()).optional(),
    placeholder: z.string().optional(),
  })).optional().nullable(),
  is_property_linked: z.boolean().default(false),
  requires_approval: z.boolean().default(false),
  approval_threshold: z.number().min(0).optional().nullable(),
  min_stock_alert: z.number().int().min(0).default(0),
  is_returnable: z.boolean().default(false),
})

export const updateProductSchema = createProductSchema.partial()

export const createVariantSchema = z.object({
  name: z.string().min(1, 'Nome obrigatório'),
  sku_suffix: z.string().optional().nullable(),
  additional_cost: z.number().min(0).default(0),
  sort_order: z.number().int().default(0),
})

export const createCategorySchema = z.object({
  name: z.string().min(1, 'Nome obrigatório'),
  description: z.string().optional().nullable(),
  icon: z.string().optional().nullable(),
  sort_order: z.number().int().default(0),
})

export const createRequisitionSchema = z.object({
  property_id: z.string().optional().nullable(),
  items: z.array(z.object({
    product_id: z.string().min(1),
    variant_id: z.string().optional().nullable(),
    quantity: z.number().int().min(1, 'Quantidade mínima: 1'),
    personalization_data: z.record(z.string(), z.any()).optional().nullable(),
    notes: z.string().optional().nullable(),
  })).min(1, 'Adicione pelo menos 1 item'),
  delivery_type: z.enum(['pickup', 'delivery']).default('pickup'),
  delivery_address: z.string().optional().nullable(),
  delivery_notes: z.string().optional().nullable(),
  requested_delivery_date: z.string().optional().nullable(),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).default('normal'),
})

export const createSupplierSchema = z.object({
  name: z.string().min(1, 'Nome obrigatório'),
  contact_name: z.string().optional().nullable(),
  email: z.string().email('Email inválido').optional().or(z.literal('')).nullable(),
  phone: z.string().optional().nullable(),
  nif: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  postal_code: z.string().optional().nullable(),
  website: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  average_delivery_days: z.number().int().min(0).optional().nullable(),
  payment_terms: z.string().optional().nullable(),
})

export const updateSupplierSchema = createSupplierSchema.partial()

export const createSupplierOrderSchema = z.object({
  supplier_id: z.string().min(1, 'Fornecedor obrigatório'),
  items: z.array(z.object({
    product_id: z.string().min(1),
    variant_id: z.string().optional().nullable(),
    quantity_ordered: z.number().int().min(1),
    unit_cost: z.number().min(0),
  })).min(1, 'Adicione pelo menos 1 item'),
  expected_delivery_date: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
})

export const stockAdjustSchema = z.object({
  quantity: z.number().int(),
  reason: z.string().min(1, 'Motivo obrigatório'),
})

export const createReturnSchema = z.object({
  requisition_item_id: z.string().optional().nullable(),
  product_id: z.string().min(1),
  variant_id: z.string().optional().nullable(),
  agent_id: z.string().min(1),
  quantity: z.number().int().min(1).default(1),
  condition: z.enum(['good', 'damaged', 'destroyed']),
  refund_amount: z.number().min(0).default(0),
  reason: z.string().optional().nullable(),
})

export const rejectRequisitionSchema = z.object({
  rejection_reason: z.string().min(1, 'Motivo obrigatório'),
})

export const cancelRequisitionSchema = z.object({
  cancellation_reason: z.string().min(1, 'Motivo obrigatório'),
})

export const receiveSupplierOrderSchema = z.object({
  items: z.array(z.object({
    item_id: z.string().min(1),
    quantity_received: z.number().int().min(0),
  })).min(1),
})
