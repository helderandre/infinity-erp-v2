import { z } from 'zod'

const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Base schema (used by react-hook-form + zodResolver)
export const goalBaseSchema = z.object({
  consultant_id: z.string().regex(uuidRegex, 'ID de consultor inválido'),
  year: z.number().int().min(2024).max(2050),
  annual_revenue_target: z.number().positive('O objetivo anual deve ser positivo'),
  pct_sellers: z.number().min(0).max(100),
  pct_buyers: z.number().min(0).max(100),
  working_weeks_year: z.number().int().min(1).max(52),
  working_days_week: z.number().int().min(1).max(7),
  // Seller funnel
  sellers_avg_sale_value: z.number().positive().nullable().optional(),
  sellers_avg_commission_pct: z.number().min(0).max(100).nullable().optional(),
  sellers_pct_listings_sold: z.number().min(0).max(100).nullable().optional(),
  sellers_pct_visit_to_listing: z.number().min(0).max(100).nullable().optional(),
  sellers_pct_lead_to_visit: z.number().min(0).max(100).nullable().optional(),
  sellers_avg_calls_per_lead: z.number().min(0).nullable().optional(),
  // Buyer funnel
  buyers_avg_purchase_value: z.number().positive().nullable().optional(),
  buyers_avg_commission_pct: z.number().min(0).max(100).nullable().optional(),
  buyers_close_rate: z.number().min(0).max(100).nullable().optional(),
  buyers_pct_lead_to_qualified: z.number().min(0).max(100).nullable().optional(),
  buyers_avg_calls_per_lead: z.number().min(0).nullable().optional(),
})

// With refinement (used by API route validation)
export const createGoalSchema = goalBaseSchema.refine(
  (data) => Math.abs((data.pct_sellers + data.pct_buyers) - 100) < 0.01,
  { message: 'A soma vendedores + compradores deve ser 100%', path: ['pct_sellers'] }
)

export const updateGoalSchema = goalBaseSchema.partial().omit({ consultant_id: true })

export const createGoalActivitySchema = z.object({
  activity_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida (YYYY-MM-DD)'),
  activity_type: z.enum([
    'call', 'visit', 'listing', 'sale_close', 'buyer_close',
    'lead_contact', 'buyer_qualify', 'follow_up',
  ]),
  origin: z.enum(['sellers', 'buyers']),
  revenue_amount: z.number().nullable().optional(),
  reference_id: z.string().regex(uuidRegex).nullable().optional(),
  reference_type: z.enum(['lead', 'property', 'negocio']).nullable().optional(),
  notes: z.string().max(1000).nullable().optional(),
})

export type CreateGoalInput = z.infer<typeof goalBaseSchema>
export type UpdateGoalInput = z.infer<typeof updateGoalSchema>
export type CreateGoalActivityInput = z.infer<typeof createGoalActivitySchema>
