import { z } from 'zod'

export const propertySchema = z.object({
  // Dados Gerais
  title: z.string().min(5, 'O título deve ter pelo menos 5 caracteres'),
  description: z.string().optional(),
  property_type: z.string().min(1, 'Seleccione o tipo de imóvel'),
  business_type: z.string().min(1, 'Seleccione o tipo de negócio'),
  listing_price: z.number().positive('O preço deve ser positivo').optional(),
  status: z.string().default('pending_approval'),
  property_condition: z.string().optional(),
  business_status: z.string().optional(),
  energy_certificate: z.string().optional(),
  external_ref: z.string().optional(),
  consultant_id: z.string().uuid('ID do consultor inválido').optional(),

  // Localização
  address_street: z.string().optional(),
  address_parish: z.string().optional(),
  postal_code: z.string().optional(),
  city: z.string().optional(),
  zone: z.string().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),

  // Contrato
  contract_regime: z.string().optional(),
})

export const propertySpecsSchema = z.object({
  property_id: z.string().uuid(),
  typology: z.string().optional(),
  bedrooms: z.number().int().nonnegative().optional(),
  bathrooms: z.number().int().nonnegative().optional(),
  area_gross: z.number().positive().optional(),
  area_util: z.number().positive().optional(),
  construction_year: z.number().int().min(1800).max(new Date().getFullYear() + 5).optional(),
  parking_spaces: z.number().int().nonnegative().optional(),
  garage_spaces: z.number().int().nonnegative().optional(),
  has_elevator: z.boolean().optional(),
  fronts_count: z.number().int().nonnegative().optional(),
  features: z.array(z.string()).optional(),
  solar_orientation: z.array(z.string()).optional(),
  views: z.array(z.string()).optional(),
  equipment: z.array(z.string()).optional(),
  storage_area: z.number().nonnegative().optional(),
  balcony_area: z.number().nonnegative().optional(),
  pool_area: z.number().nonnegative().optional(),
  attic_area: z.number().nonnegative().optional(),
  pantry_area: z.number().nonnegative().optional(),
  gym_area: z.number().nonnegative().optional(),
})

export const propertyInternalSchema = z.object({
  property_id: z.string().uuid(),
  exact_address: z.string().optional(),
  postal_code: z.string().optional(),
  internal_notes: z.string().optional(),
  commission_agreed: z.number().nonnegative().optional(),
  commission_type: z.string().default('percentage'),
  contract_regime: z.string().optional(),
  contract_term: z.string().optional(),
  contract_expiry: z.string().optional(),
  imi_value: z.number().nonnegative().optional(),
  condominium_fee: z.number().nonnegative().optional(),
  cpcv_percentage: z.number().min(0).max(100).default(0),
  reference_internal: z.string().optional(),
})

export const propertyMediaSchema = z.object({
  property_id: z.string().uuid(),
  url: z.string().url('URL inválida'),
  media_type: z.string().default('image'),
  order_index: z.number().int().nonnegative().default(0),
  is_cover: z.boolean().default(false),
})

export type PropertyFormData = z.infer<typeof propertySchema>
export type PropertySpecsFormData = z.infer<typeof propertySpecsSchema>
export type PropertyInternalFormData = z.infer<typeof propertyInternalSchema>
export type PropertyMediaFormData = z.infer<typeof propertyMediaSchema>

// Schema para actualização parcial (PUT)
export const updatePropertySchema = propertySchema.partial()

export const updatePropertySpecsSchema = propertySpecsSchema.omit({ property_id: true }).partial()

export const updatePropertyInternalSchema = propertyInternalSchema.omit({ property_id: true }).partial()

// Schema de filtros da listagem
export const propertyFiltersSchema = z.object({
  search: z.string().optional(),
  status: z.string().optional(),
  property_type: z.string().optional(),
  business_type: z.string().optional(),
  city: z.string().optional(),
  consultant_id: z.string().uuid().optional(),
  price_min: z.number().nonnegative().optional(),
  price_max: z.number().nonnegative().optional(),
  page: z.number().int().positive().default(1),
  per_page: z.number().int().min(1).max(100).default(20),
})

export type UpdatePropertyFormData = z.infer<typeof updatePropertySchema>
export type UpdatePropertySpecsFormData = z.infer<typeof updatePropertySpecsSchema>
export type UpdatePropertyInternalFormData = z.infer<typeof updatePropertyInternalSchema>
export type PropertyFilters = z.infer<typeof propertyFiltersSchema>
