// ─── Moloni API types ──────────────────────────────────────────────────────
// Shapes for the Moloni v1 REST API responses we consume. Kept intentionally
// minimal — only the fields we read. See docs/MOLONI-INTEGRATION.md and the
// portable spec (moloni-integration-portable-spec.md) for the full surface.

export interface MoloniTokenRow {
  company_id: number
  access_token: string
  refresh_token: string
  expires_at: string
}

export interface MoloniGrantResponse {
  access_token: string
  refresh_token: string
  expires_in: number
}

export interface MoloniCompany {
  company_id: number
  name: string
  vat?: string
  email?: string
}

export interface MoloniCustomer {
  customer_id: number
  name?: string
  vat?: string
}

export interface MoloniTax {
  tax_id: number
  name: string
  value: number
  type: number // 1 = IVA (VAT), 2 = Retenção, ...
}

export interface MoloniDocumentSet {
  document_set_id: number
  name: string
}

export interface MoloniMeasurementUnit {
  unit_id: number
  name: string
}

export interface MoloniProductCategory {
  category_id: number
  name: string
}

export interface MoloniProduct {
  product_id: number
  reference?: string
  name?: string
}

export interface MoloniInvoiceResult {
  document_id: number
  number?: string
  net_value?: number
  taxes_value?: number
  gross_value?: number
}

/**
 * Moloni returns errors as an HTTP 200 with an array of { code, description }.
 * This wraps that contract so callers can `catch (e) { if (e instanceof MoloniError) ... }`.
 */
export class MoloniError extends Error {
  errors: Array<{ code: number; description: string }>
  constructor(errors: Array<{ code: number; description: string }>) {
    super(
      `Moloni: ${errors
        .map((e) => `[${e.code}] ${e.description}`)
        .join('; ')}`,
    )
    this.name = 'MoloniError'
    this.errors = errors
  }
}
