import { z } from 'zod'

const ratingField = z.number().int().min(1).max(5).optional().nullable()

export const createFichaSchema = z.object({
  property_id: z.string().min(1),
  visit_id: z.string().optional().nullable(),
  source: z.enum(['digital', 'scan', 'manual']).default('manual'),
  client_name: z.string().max(200).optional().nullable(),
  client_phone: z.string().max(30).optional().nullable(),
  client_email: z.string().email().optional().nullable().or(z.literal('')),
  client_id_number: z.string().max(50).optional().nullable(),
  visit_date: z.string().optional().nullable(),
  visit_time: z.string().optional().nullable(),
  rating_floorplan: ratingField,
  rating_construction: ratingField,
  rating_finishes: ratingField,
  rating_sun_exposition: ratingField,
  rating_location: ratingField,
  rating_value: ratingField,
  rating_overall: ratingField,
  rating_agent_service: ratingField,
  liked_most: z.string().max(2000).optional().nullable(),
  liked_least: z.string().max(2000).optional().nullable(),
  would_buy: z.boolean().optional().nullable(),
  would_buy_reason: z.string().max(1000).optional().nullable(),
  perceived_value: z.number().optional().nullable(),
  has_property_to_sell: z.boolean().optional().nullable(),
  discovery_source: z.enum(['internet', 'magazine', 'sign', 'storefront', 'flyers', 'agent', 'other']).optional().nullable(),
  signature_url: z.string().optional().nullable(),
  consent_share_with_owner: z.boolean().default(false),
  scan_image_url: z.string().optional().nullable(),
})

export const digitalFichaSchema = z.object({
  client_name: z.string().min(1, 'Nome é obrigatório').max(200),
  client_phone: z.string().max(30).optional().nullable(),
  client_email: z.string().email('Email inválido').optional().nullable().or(z.literal('')),
  client_id_number: z.string().max(50).optional().nullable(),
  visit_date: z.string().min(1, 'Data é obrigatória'),
  visit_time: z.string().optional().nullable(),
  rating_floorplan: ratingField,
  rating_construction: ratingField,
  rating_finishes: ratingField,
  rating_sun_exposition: ratingField,
  rating_location: ratingField,
  rating_value: ratingField,
  rating_overall: ratingField,
  rating_agent_service: ratingField,
  liked_most: z.string().max(2000).optional().nullable(),
  liked_least: z.string().max(2000).optional().nullable(),
  would_buy: z.boolean().optional().nullable(),
  would_buy_reason: z.string().max(1000).optional().nullable(),
  perceived_value: z.number().optional().nullable(),
  has_property_to_sell: z.boolean().optional().nullable(),
  discovery_source: z.enum(['internet', 'magazine', 'sign', 'storefront', 'flyers', 'agent', 'other']).optional().nullable(),
  consent_share_with_owner: z.boolean().default(false),
})

export type CreateFichaInput = z.infer<typeof createFichaSchema>
export type DigitalFichaInput = z.infer<typeof digitalFichaSchema>
