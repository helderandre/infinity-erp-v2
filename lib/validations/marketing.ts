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
  property_bundle_data: z.any().optional().nullable(),
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
  target_zone: z.string().optional().nullable(),
  target_age_min: z.coerce.number().int().min(18).optional().nullable(),
  target_age_max: z.coerce.number().int().max(99).optional().nullable(),
  target_interests: z.string().optional().nullable(),
  budget_type: z.enum(['daily', 'total']),
  budget_amount: z.coerce.number().positive('Orçamento deve ser positivo'),
  duration_days: z.coerce.number().int().min(1, 'Mínimo 1 dia'),
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
