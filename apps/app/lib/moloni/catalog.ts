// ─── Moloni catalogs: document sets, taxes, products ─────────────────────────
// Invoice lines are strongly typed to product records, so even a one-off
// service must reference a product_id. We auto-create one product per unique
// service name and reuse it thereafter.

import { moloniPost } from './client'
import {
  MoloniError,
  type MoloniDocumentSet,
  type MoloniMeasurementUnit,
  type MoloniProductCategory,
  type MoloniTax,
} from './types'

const SERVICE_CATEGORY_NAME = 'Serviços'

export async function getDocumentSets(): Promise<MoloniDocumentSet[]> {
  return moloniPost<MoloniDocumentSet[]>('documentSets/getAll')
}

export async function getTaxes(): Promise<MoloniTax[]> {
  return moloniPost<MoloniTax[]>('taxes/getAll')
}

export interface MoloniPaymentMethod {
  payment_method_id: number
  name: string
}

export async function getPaymentMethods(): Promise<MoloniPaymentMethod[]> {
  return moloniPost<MoloniPaymentMethod[]>('paymentMethods/getAll')
}

/** Resolve a payment method id, preferring "Transferência" / "Transferência Bancária". */
export async function pickPaymentMethodId(): Promise<number> {
  const methods = await getPaymentMethods()
  if (!methods.length) {
    throw new MoloniError([{ code: 404, description: 'Nenhum método de pagamento configurado no Moloni' }])
  }
  const transfer = methods.find((m) => /transfer/i.test(m.name))
  return (transfer ?? methods[0]).payment_method_id
}

/** Find the IVA (VAT) tax for a given rate (e.g. 23). */
export async function getVatTax(rate: number): Promise<MoloniTax> {
  const taxes = await getTaxes()
  const iva = taxes.find((t) => t.type === 1 && Number(t.value) === Number(rate))
  if (!iva) {
    throw new MoloniError([{ code: 404, description: `IVA ${rate}% não está configurado no Moloni` }])
  }
  return iva
}

async function ensureServiceCategory(): Promise<number> {
  const categories = await moloniPost<MoloniProductCategory[]>('productCategories/getAll')
  const found = categories.find((c) => c.name === SERVICE_CATEGORY_NAME)
  if (found) return found.category_id
  const created = await moloniPost<{ category_id: number }>('productCategories/insert', {
    parent_id: 0,
    name: SERVICE_CATEGORY_NAME,
    description: 'Serviços prestados',
  })
  return created.category_id
}

async function getUnitId(): Promise<number> {
  const units = await moloniPost<MoloniMeasurementUnit[]>('measurementUnits/getAll')
  return units.find((u) => u.name === 'Unidade')?.unit_id ?? units[0]?.unit_id ?? 1
}

/**
 * Ensure a service product exists for `name`, returning its product_id.
 * Stable reference derived from the name so repeats reuse the same product.
 */
export async function ensureServiceProduct(
  name: string,
  price: number,
  taxId: number,
  taxValue: number,
): Promise<number> {
  const reference = `SRV-${name.replace(/[^a-zA-Z0-9]/g, '-').toUpperCase().slice(0, 20)}`

  const existing = await moloniPost<Array<{ product_id: number }>>('products/getByReference', {
    reference,
  })
  if (existing.length > 0) return existing[0].product_id

  const [categoryId, unitId] = await Promise.all([ensureServiceCategory(), getUnitId()])

  const product = await moloniPost<{ product_id: number }>('products/insert', {
    name,
    reference,
    price,
    category_id: categoryId,
    unit_id: unitId,
    type: 2, // 1 = Product, 2 = Service
    has_stock: 0,
    stock: 0,
    taxes: [{ tax_id: taxId, value: taxValue, order: 1, cumulative: 0 }],
  })
  return product.product_id
}
