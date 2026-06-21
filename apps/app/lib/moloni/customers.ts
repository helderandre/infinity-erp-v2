// ─── Moloni customers ────────────────────────────────────────────────────────
// Idempotent client sync: find by NIF (VAT) first, otherwise create with the
// pile of "zero" fields Moloni silently requires. Optional nif.pt enrichment.

import { moloniPost } from './client'
import type { MoloniCustomer } from './types'

const CONSUMIDOR_FINAL_NIF = '999999990'

export async function getCustomerByVat(vat: string): Promise<MoloniCustomer[]> {
  return moloniPost<MoloniCustomer[]>('customers/getByVat', { vat })
}

interface InsertCustomerInput {
  name: string
  vat: string
  email?: string
  address?: string
  city?: string
  zip_code?: string
  phone?: string
}

export async function insertCustomer(data: InsertCustomerInput): Promise<number> {
  // Moloni needs a sequential customer number.
  const { number } = await moloniPost<{ number: string }>('customers/getNextNumber')

  const created = await moloniPost<{ customer_id: number }>('customers/insert', {
    ...data,
    number,
    language_id: 1, // Portuguese
    country_id: 1, // Portugal
    // ── Required but ignored — must be present (the #1 gotcha) ──
    maturity_date_id: 0,
    payment_method_id: 0,
    delivery_method_id: 0,
    document_type_id: 0,
    salesman_id: 0,
    payment_day: 0,
    discount: 0,
    credit_limit: 0,
  })
  return created.customer_id
}

/** Portuguese NIF registry lookup (optional, requires NIF_PT_API_KEY). */
async function lookupNif(nif: string): Promise<{
  name?: string
  address?: string
  city?: string
  zip_code?: string
} | null> {
  const apiKey = process.env.NIF_PT_API_KEY
  if (!apiKey) return null
  try {
    const res = await fetch(`https://www.nif.pt/?json=1&q=${encodeURIComponent(nif)}&key=${apiKey}`)
    if (!res.ok) return null
    const data = await res.json()
    const record = data?.records?.[nif]
    if (!record) return null
    return {
      name: record.title,
      address: record.address,
      city: record.city,
      zip_code: record.pc4 && record.pc3 ? `${record.pc4}-${record.pc3}` : undefined,
    }
  } catch {
    return null
  }
}

export interface SyncCustomerInput {
  name: string
  nif?: string | null
  email?: string | null
  address?: string | null
  city?: string | null
  zip_code?: string | null
  phone?: string | null
}

/**
 * Resolve a Moloni customer_id for a recipient, creating it if needed.
 * Idempotent on NIF (Moloni-side via getByVat). Falls back to "Consumidor
 * Final" (999999990) when no NIF is provided.
 */
export async function syncCustomer(client: SyncCustomerInput): Promise<number> {
  const vat = client.nif?.trim() || CONSUMIDOR_FINAL_NIF

  // 1. Already in Moloni? Reuse it (only meaningful for real NIFs).
  if (vat !== CONSUMIDOR_FINAL_NIF) {
    const existing = await getCustomerByVat(vat)
    if (existing.length > 0) return existing[0].customer_id
  }

  // 2. Enrich from the public NIF registry when possible.
  const enriched = vat !== CONSUMIDOR_FINAL_NIF ? await lookupNif(vat) : null

  // 3. Create. Prefer the app's own data over enriched. Self-heal a concurrent
  //    create (TOCTOU) or a Moloni duplicate-VAT rejection by re-looking-up on
  //    failure — so we never strand two customers for the same NIF.
  try {
    return await insertCustomer({
      name: client.name || enriched?.name || 'Cliente',
      vat,
      email: client.email ?? undefined,
      address: client.address || enriched?.address || undefined,
      city: client.city || enriched?.city || undefined,
      zip_code: client.zip_code || enriched?.zip_code || undefined,
      phone: client.phone ?? undefined,
    })
  } catch (err) {
    if (vat !== CONSUMIDOR_FINAL_NIF) {
      const existing = await getCustomerByVat(vat)
      if (existing.length > 0) return existing[0].customer_id
    }
    throw err
  }
}
