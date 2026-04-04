import { z } from 'zod'

const categories = ['photography', 'video', 'design', 'physical_materials', 'ads', 'social_media', 'other'] as const

// --- Catalog ---

export const createCatalogItemSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório').trim(),
  description: z.string().default(''),
  category: z.enum(categories, { message: 'Categoria inválida' }),
  price: z.coerce.number().min(0, 'Preço deve ser positivo'),
  estimated_delivery_days: z.coerce.number().int().min(1, 'Mínimo 1 dia'),
  thumbnail: z.string().url().optional().nullable(),
  is_active: z.boolean().default(true),
  requires_scheduling: z.boolean().default(false),
  requires_property: z.boolean().default(true),
})

export const updateCatalogItemSchema = createCatalogItemSchema.partial()

// --- Addons ---

export const createAddonSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório').trim(),
  description: z.string().default(''),
  price: z.coerce.number().min(0, 'Preço deve ser positivo ou zero'),
  is_active: z.boolean().default(true),
})

export const updateAddonSchema = createAddonSchema.partial()

// --- Packs ---

export const createPackSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório').trim(),
  description: z.string().default(''),
  price: z.coerce.number().min(0, 'Preço deve ser positivo'),
  thumbnail: z.string().url().optional().nullable(),
  is_active: z.boolean().default(true),
  item_ids: z.array(z.string().uuid()).min(1, 'Seleccione pelo menos um serviço'),
})

export const updatePackSchema = createPackSchema.partial()

// --- Orders (purchase only — no property/scheduling data needed) ---

export const createOrderSchema = z.object({
  items: z.array(z.object({
    catalog_item_id: z.string().optional().nullable(),
    pack_id: z.string().optional().nullable(),
    name: z.string().min(1),
    price: z.coerce.number().min(0),
  })).min(1, 'Seleccione pelo menos um item'),
  checkout_group_id: z.string().optional().nullable(),
  payment_method: z.enum(['conta_corrente', 'invoice']).default('conta_corrente'),
  property_id: z.string().optional().nullable(),
  property_bundle_data: z.any().optional().nullable(),
  proposed_dates: z.array(z.object({
    date: z.string(),
    time_slot: z.string(),
  })).optional().nullable(),
})

// --- Subscriptions ---

export const cancelSubscriptionSchema = z.object({
  immediate: z.boolean().default(false),
})

// --- Campaigns ---

export const createCampaignSchema = z.object({
  property_id: z.string().optional().nullable(),
  promote_url: z.string().optional().nullable(),
  objective: z.enum(['notoriedade', 'trafego', 'leads', 'conversoes']),
  campaign_type: z.enum(['compradores', 'vendedores', 'arrendatarios', 'senhorios', 'outros']),
  target_zone: z.string().optional().nullable(),
  target_age_min: z.coerce.number().int().min(18).optional().nullable(),
  target_age_max: z.coerce.number().int().max(99).optional().nullable(),
  target_interests: z.string().optional().nullable(),
  budget_type: z.enum(['daily', 'total']),
  budget_amount: z.coerce.number().positive('Orçamento deve ser positivo'),
  duration_days: z.coerce.number().int().min(1, 'Mínimo 1 dia'),
  management_fee: z.coerce.number().min(0).default(70),
  creative_notes: z.string().optional().nullable(),
  checkout_group_id: z.string().optional().nullable(),
  payment_method: z.enum(['conta_corrente', 'invoice']).default('conta_corrente'),
})

// --- Conta Corrente ---

export const manualTransactionSchema = z.object({
  agent_id: z.string().uuid('ID do consultor inválido'),
  type: z.enum(['DEBIT', 'CREDIT']),
  category: z.literal('manual_adjustment'),
  amount: z.coerce.number().positive('Valor deve ser positivo'),
  description: z.string().min(1, 'Descrição é obrigatória').trim(),
})

// --- Payouts ---

export const createPayoutSchema = z.object({
  agent_id: z.string().uuid('ID do consultor inválido'),
  credit_transaction_ids: z.array(z.string().uuid()).min(1, 'Seleccione pelo menos um crédito'),
  deduction_transaction_ids: z.array(z.string().uuid()).default([]),
  notes: z.string().optional().nullable(),
})

export const updatePayoutSchema = z.object({
  action: z.enum(['submit', 'receive_invoice', 'mark_paid', 'cancel']),
  consultant_invoice_number: z.string().optional().nullable(),
  consultant_invoice_date: z.string().optional().nullable(),
  consultant_invoice_type: z.enum(['factura', 'recibo_verde', 'recibo']).optional().nullable(),
  consultant_invoice_url: z.string().optional().nullable(),
  paid_date: z.string().optional().nullable(),
  paid_amount: z.coerce.number().optional().nullable(),
  payment_method: z.string().optional().nullable(),
  payment_reference: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
})
