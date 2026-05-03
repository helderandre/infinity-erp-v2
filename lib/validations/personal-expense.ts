import { z } from 'zod'

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida (esperado YYYY-MM-DD)')

export const personalExpenseCreateSchema = z.object({
  expense_date: isoDate,
  category: z.string().min(1).max(100),
  description: z.string().max(500).optional().nullable(),
  vendor_name: z.string().max(200).optional().nullable(),
  vendor_nif: z.string().max(20).optional().nullable(),
  amount_gross: z.number().nonnegative(),
  amount_net: z.number().nonnegative().optional().nullable(),
  vat_amount: z.number().nonnegative().optional().nullable(),
  vat_pct: z.number().min(0).max(100).optional().nullable(),
  invoice_number: z.string().max(50).optional().nullable(),
  receipt_url: z.string().url().optional().nullable(),
  receipt_mimetype: z.string().max(100).optional().nullable(),
  receipt_size_bytes: z.number().int().nonnegative().optional().nullable(),
  ocr_confidence: z.number().min(0).max(1).optional().nullable(),
  ocr_field_confidences: z.record(z.string(), z.number()).optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
})

export const personalExpenseUpdateSchema = personalExpenseCreateSchema.partial()

export const personalExpenseRecurrenceCreateSchema = z.object({
  category: z.string().min(1).max(100),
  description: z.string().max(500).optional().nullable(),
  vendor_name: z.string().max(200).optional().nullable(),
  vendor_nif: z.string().max(20).optional().nullable(),
  amount_gross: z.number().nonnegative(),
  amount_net: z.number().nonnegative().optional().nullable(),
  vat_amount: z.number().nonnegative().optional().nullable(),
  vat_pct: z.number().min(0).max(100).optional().nullable(),
  invoice_number: z.string().max(50).optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
  frequency: z.literal('monthly').default('monthly'),
  day_of_month: z.number().int().min(1).max(31),
  start_date: isoDate,
  end_date: isoDate.optional().nullable(),
  is_active: z.boolean().optional().default(true),
  // Quando o consultor cria a regra junto com a despesa manual deste mês,
  // a UI passa hoje aqui para o cron não regenerar uma 2ª despesa hoje.
  last_generated_at: isoDate.optional().nullable(),
})

export const personalExpenseRecurrenceUpdateSchema =
  personalExpenseRecurrenceCreateSchema.partial()

export type PersonalExpenseCreate = z.infer<typeof personalExpenseCreateSchema>
export type PersonalExpenseUpdate = z.infer<typeof personalExpenseUpdateSchema>
export type PersonalExpenseRecurrenceCreate =
  z.infer<typeof personalExpenseRecurrenceCreateSchema>
export type PersonalExpenseRecurrenceUpdate =
  z.infer<typeof personalExpenseRecurrenceUpdateSchema>
