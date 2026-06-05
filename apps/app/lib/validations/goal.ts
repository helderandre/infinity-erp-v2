import { z } from 'zod'

const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Per-stage conversion rates (0-1) keyed by stage_key.
// Each value represents the conversion FROM this stage TO the next one.
const conversionMapSchema = z
  .record(z.string(), z.number().min(0).max(1))
  .optional()
  .nullable()

// Base schema (used by react-hook-form + zodResolver)
export const goalBaseSchema = z.object({
  consultant_id: z.string().regex(uuidRegex, 'ID de consultor inválido'),
  year: z.number().int().min(2024).max(2050),
  annual_revenue_target: z.number().positive('O objetivo anual deve ser positivo'),
  pct_sellers: z.number().min(0).max(100),
  pct_buyers: z.number().min(0).max(100),
  working_weeks_year: z.number().int().min(1).max(52),
  working_days_week: z.number().int().min(1).max(7),
  // Seller funnel — deal economics
  sellers_avg_sale_value: z.number().positive().nullable().optional(),
  sellers_avg_commission_pct: z.number().min(0).max(100).nullable().optional(),
  // Legacy seller fields (kept for backwards compat — not used by new funnel)
  sellers_pct_listings_sold: z.number().min(0).max(100).nullable().optional(),
  sellers_pct_visit_to_listing: z.number().min(0).max(100).nullable().optional(),
  sellers_pct_lead_to_visit: z.number().min(0).max(100).nullable().optional(),
  sellers_avg_calls_per_lead: z.number().min(0).nullable().optional(),
  // Buyer funnel — deal economics
  buyers_avg_purchase_value: z.number().positive().nullable().optional(),
  buyers_avg_commission_pct: z.number().min(0).max(100).nullable().optional(),
  // Legacy buyer fields
  buyers_close_rate: z.number().min(0).max(100).nullable().optional(),
  buyers_pct_lead_to_qualified: z.number().min(0).max(100).nullable().optional(),
  buyers_avg_calls_per_lead: z.number().min(0).nullable().optional(),
  // New per-stage conversion rates aligned with the funnel structure
  funnel_conversion_rates: z
    .object({
      buyer: conversionMapSchema,
      seller: conversionMapSchema,
    })
    .optional()
    .nullable(),
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

// ─── Weekly Reports ──────────────────────────────────────

export const submitWeeklyReportSchema = z.object({
  notes_wins: z.string().max(2000).nullable().optional(),
  notes_challenges: z.string().max(2000).nullable().optional(),
  notes_next_week: z.string().max(2000).nullable().optional(),
})

export const managerFeedbackSchema = z.object({
  manager_feedback: z.string().min(1, 'O feedback não pode estar vazio').max(2000),
})

export type SubmitWeeklyReportInput = z.infer<typeof submitWeeklyReportSchema>
export type ManagerFeedbackInput = z.infer<typeof managerFeedbackSchema>
