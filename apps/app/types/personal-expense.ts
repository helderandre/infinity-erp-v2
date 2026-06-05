export interface PersonalExpense {
  id: string
  agent_id: string
  expense_date: string
  category: string
  description: string | null
  vendor_name: string | null
  vendor_nif: string | null
  amount_gross: number
  amount_net: number | null
  vat_amount: number | null
  vat_pct: number | null
  invoice_number: string | null
  receipt_url: string | null
  receipt_mimetype: string | null
  receipt_size_bytes: number | null
  ocr_confidence: number | null
  ocr_field_confidences: Record<string, number> | null
  notes: string | null
  recurrence_id: string | null
  created_at: string
  updated_at: string
}

export interface PersonalExpenseRecurrence {
  id: string
  agent_id: string
  category: string
  description: string | null
  vendor_name: string | null
  vendor_nif: string | null
  amount_gross: number
  amount_net: number | null
  vat_amount: number | null
  vat_pct: number | null
  invoice_number: string | null
  notes: string | null
  frequency: 'monthly'
  day_of_month: number
  start_date: string
  end_date: string | null
  is_active: boolean
  last_generated_at: string | null
  created_at: string
  updated_at: string
}

export interface PersonalExpensesSummary {
  total_amount: number
  count: number
  by_category: Array<{ category: string; amount: number; count: number }>
}

/**
 * Resultado do OCR de recibo (alinhado com /api/financial/scan-receipt).
 * Os campos são todos opcionais; a IA pode falhar a extracção de qualquer um.
 */
export interface ReceiptScanResult {
  entity_name?: string | null
  entity_nif?: string | null
  amount_net?: number | null
  amount_gross?: number | null
  vat_amount?: number | null
  vat_pct?: number | null
  invoice_number?: string | null
  invoice_date?: string | null
  description?: string | null
  category?: string | null
  confidence?: number | null
  field_confidences?: Record<string, number> | null
}
