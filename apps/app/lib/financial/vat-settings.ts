// ─── Agency-invoice IVA (financial definitions) ──────────────────────────────
// Single source of truth for the IVA rate applied to the client fatura (fatura
// de comissão da agência). The rate lives in the financial definitions
// (`temp_agency_settings.vat_rate_services`, stored as a percentage e.g. 23) and
// is SNAPSHOTTED onto each `deal_payments.agency_invoice_vat_pct` at issue time,
// so changing it later applies only to future invoices.
//
// Pure helpers (no server-only imports) → safe to import from client components.

export const DEFAULT_VAT_PCT = 23
export const AGENCY_INVOICE_VAT_SETTING_KEY = 'vat_rate_services'

/**
 * Normalize a stored setting value to a percentage. Tolerates the historical
 * inconsistency where some IVA settings were stored as a fraction ("0.23") and
 * others as a percentage ("23"). Returns null for empty/invalid values.
 */
export function normalizeVatPct(raw: unknown): number | null {
  if (raw == null || raw === '') return null
  const n = Number(raw)
  if (!Number.isFinite(n) || n <= 0) return null
  // Values ≤ 1 are treated as a fraction (0.23 → 23).
  return n <= 1 ? Math.round(n * 100 * 100) / 100 : n
}

/** Extract the agency-invoice IVA (%) from a list of agency settings. */
export function vatPctFromSettings(
  settings: Array<{ key: string; value: string }> | null | undefined,
): number {
  const raw = settings?.find((s) => s.key === AGENCY_INVOICE_VAT_SETTING_KEY)?.value
  return normalizeVatPct(raw) ?? DEFAULT_VAT_PCT
}

/**
 * Reads the configured agency-invoice IVA (%) from the financial definitions.
 * `admin` is any Supabase-like client with `.from()`. Falls back to 23 on any
 * error so issuance is never blocked by a missing/garbled setting.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getAgencyInvoiceVatPct(admin: any): Promise<number> {
  try {
    const { data } = await admin
      .from('temp_agency_settings')
      .select('value')
      .eq('key', AGENCY_INVOICE_VAT_SETTING_KEY)
      .maybeSingle()
    return normalizeVatPct(data?.value) ?? DEFAULT_VAT_PCT
  } catch {
    return DEFAULT_VAT_PCT
  }
}
