import { z } from 'zod'

// ─── Company Transaction ────────────────────────────────────────────────────

export const companyTransactionSchema = z.object({
  date: z.string().min(1, 'Data obrigatória'),
  type: z.enum(['income', 'expense']),
  category: z.string().min(1, 'Categoria obrigatória'),
  subcategory: z.string().optional(),
  entity_name: z.string().optional(),
  entity_nif: z.string().optional(),
  description: z.string().min(1, 'Descrição obrigatória'),
  amount_net: z.number().positive('Valor deve ser positivo'),
  amount_gross: z.number().optional(),
  vat_amount: z.number().optional(),
  vat_pct: z.number().min(0).max(100).optional(),
  invoice_number: z.string().optional(),
  invoice_date: z.string().optional(),
  payment_date: z.string().optional(),
  payment_method: z.string().optional(),
  due_date: z.string().optional(),
  is_recurring: z.boolean().optional(),
  recurring_template_id: z.string().optional(),
  receipt_url: z.string().optional(),
  receipt_file_name: z.string().optional(),
  ai_extracted: z.boolean().optional(),
  ai_confidence: z.number().min(0).max(1).optional(),
  reference_type: z.string().optional(),
  reference_id: z.string().optional(),
  status: z.enum(['draft', 'confirmed', 'paid', 'cancelled']).optional(),
  notes: z.string().optional(),
})

export type CompanyTransactionInput = z.infer<typeof companyTransactionSchema>

// ─── Company Recurring Template ─────────────────────────────────────────────

export const recurringTemplateSchema = z.object({
  name: z.string().min(1, 'Nome obrigatório'),
  category: z.string().min(1, 'Categoria obrigatória'),
  subcategory: z.string().optional(),
  entity_name: z.string().optional(),
  entity_nif: z.string().optional(),
  description: z.string().optional(),
  amount_net: z.number().positive('Valor deve ser positivo'),
  vat_pct: z.number().min(0).max(100).optional(),
  frequency: z.enum(['monthly', 'quarterly', 'annual']),
  day_of_month: z.number().int().min(1).max(28).optional(),
  is_active: z.boolean().optional(),
})

export type RecurringTemplateInput = z.infer<typeof recurringTemplateSchema>

// ─── Company Category ───────────────────────────────────────────────────────

export const companyCategorySchema = z.object({
  name: z.string().min(1, 'Nome obrigatório'),
  type: z.enum(['income', 'expense', 'both']),
  icon: z.string().optional(),
  color: z.string().optional(),
})

export type CompanyCategoryInput = z.infer<typeof companyCategorySchema>

// ─── Mapa de Gestão Filters ─────────────────────────────────────────────────

export const mapaGestaoFiltersSchema = z.object({
  month: z.coerce.number().int().min(1).max(12),
  year: z.coerce.number().int().min(2020).max(2099),
  consultant_id: z.string().optional(),
  status: z.enum(['all', 'pending', 'in_progress', 'completed']).optional(),
  deal_type: z.string().optional(),
  business_type: z.string().optional(),
})

// ─── Receipt Scan ───────────────────────────────────────────────────────────

export const receiptScanSchema = z.object({
  image: z.string().min(1, 'Imagem obrigatória'),
})
