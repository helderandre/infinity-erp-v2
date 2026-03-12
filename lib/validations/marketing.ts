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
})

// --- Conta Corrente ---

export const manualTransactionSchema = z.object({
  agent_id: z.string().uuid('ID do consultor inválido'),
  type: z.enum(['DEBIT', 'CREDIT']),
  category: z.literal('manual_adjustment'),
  amount: z.coerce.number().positive('Valor deve ser positivo'),
  description: z.string().min(1, 'Descrição é obrigatória').trim(),
})
