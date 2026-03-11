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

// --- Orders ---

export const createOrderSchema = z.object({
  property_id: z.string().uuid().optional().nullable(),
  items: z.array(z.object({
    catalog_item_id: z.string().uuid().optional().nullable(),
    pack_id: z.string().uuid().optional().nullable(),
    name: z.string().min(1),
    price: z.coerce.number().min(0),
  })).min(1, 'Seleccione pelo menos um item'),
  // Form data
  address: z.string().optional().nullable(),
  postal_code: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  parish: z.string().optional().nullable(),
  floor_door: z.string().optional().nullable(),
  access_instructions: z.string().optional().nullable(),
  preferred_date: z.string().optional().nullable(),
  preferred_time: z.enum(['morning', 'afternoon', 'all_day']).optional().nullable(),
  alternative_date: z.string().optional().nullable(),
  alternative_time: z.enum(['morning', 'afternoon', 'all_day']).optional().nullable(),
  property_type: z.string().optional().nullable(),
  typology: z.string().optional().nullable(),
  area_m2: z.coerce.number().positive().optional().nullable(),
  has_exteriors: z.boolean().default(false),
  has_facades: z.boolean().default(false),
  is_occupied: z.boolean().default(false),
  is_staged: z.boolean().default(false),
  number_of_divisions: z.coerce.number().int().positive().optional().nullable(),
  parking_available: z.boolean().default(false),
  contact_is_agent: z.boolean().default(true),
  contact_name: z.string().optional().nullable(),
  contact_phone: z.string().optional().nullable(),
  contact_relationship: z.string().optional().nullable(),
  contact_observations: z.string().optional().nullable(),
})

// --- Conta Corrente ---

export const manualTransactionSchema = z.object({
  agent_id: z.string().uuid('ID do consultor inválido'),
  type: z.enum(['DEBIT', 'CREDIT']),
  category: z.literal('manual_adjustment'),
  amount: z.coerce.number().positive('Valor deve ser positivo'),
  description: z.string().min(1, 'Descrição é obrigatória').trim(),
})
