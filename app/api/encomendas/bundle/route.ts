// @ts-nocheck
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

/**
 * POST /api/encomendas/bundle
 * Creates a supplier order by bundling selected requisition items.
 *
 * Rules:
 * - All items must be from the same supplier (product.supplier_id)
 * - If payment_method is 'fatura', all items must be from the same consultant
 * - If payment_method is 'conta_corrente', can bundle multiple consultants
 * - Items must be from approved requisitions (status = 'approved' or 'processing')
 * - Items must not already be linked to a supplier order
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const body = await request.json()
    const { item_ids, supplier_id, expected_delivery_date, notes } = body as {
      item_ids: string[]
      supplier_id: string
      expected_delivery_date?: string
      notes?: string
    }

    if (!item_ids || item_ids.length === 0) {
      return NextResponse.json({ error: 'Seleccione pelo menos um item' }, { status: 400 })
    }

    // Fetch items with product and requisition info
    const { data: items, error: itemsError } = await supabase
      .from('temp_requisition_items')
      .select(`
        id, product_id, variant_id, quantity, unit_price, subtotal, status, notes,
        supplier_order_id,
        product:temp_products!product_id(id, name, supplier_id),
        requisition:temp_requisitions!requisition_id(id, status, agent_id, payment_method)
      `)
      .in('id', item_ids)

    if (itemsError) {
      return NextResponse.json({ error: itemsError.message }, { status: 500 })
    }

    if (!items || items.length === 0) {
      return NextResponse.json({ error: 'Nenhum item encontrado' }, { status: 404 })
    }

    // Validate: no items already linked to a supplier order
    const alreadyLinked = items.filter(i => i.supplier_order_id)
    if (alreadyLinked.length > 0) {
      return NextResponse.json({ error: `${alreadyLinked.length} item(ns) já estão numa encomenda` }, { status: 400 })
    }

    // Validate: all items from approved requisitions
    const unapproved = items.filter(i => {
      const req = i.requisition as any
      return !['approved', 'processing', 'accepted'].includes(req?.status)
    })
    if (unapproved.length > 0) {
      return NextResponse.json({ error: `${unapproved.length} item(ns) de requisições não aprovadas` }, { status: 400 })
    }

    // Validate supplier_id provided
    if (!supplier_id) {
      return NextResponse.json({ error: 'Seleccione um fornecedor' }, { status: 400 })
    }
    const supplierId = supplier_id

    // Validate: fatura = same consultant
    const paymentMethods = new Set(items.map(i => (i.requisition as any)?.payment_method).filter(Boolean))
    const hasFatura = paymentMethods.has('fatura')
    if (hasFatura) {
      const agentIds = new Set(items.map(i => (i.requisition as any)?.agent_id).filter(Boolean))
      if (agentIds.size > 1) {
        return NextResponse.json({ error: 'Com pagamento por fatura, todos os items devem ser do mesmo consultor' }, { status: 400 })
      }
    }

    // Generate reference: ENC-XXXX
    const { data: lastOrder } = await supabase
      .from('temp_supplier_orders')
      .select('reference')
      .like('reference', 'ENC-%')
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    let nextNum = 1
    if (lastOrder?.reference) {
      const match = lastOrder.reference.match(/ENC-(\d+)/)
      if (match) nextNum = parseInt(match[1], 10) + 1
    }
    const reference = `ENC-${String(nextNum).padStart(4, '0')}`

    // Calculate total
    const totalCost = items.reduce((sum, i) => sum + (Number(i.subtotal) || 0), 0)

    // Get current user for ordered_by
    const { data: { user } } = await supabase.auth.getUser()

    // Get agent_id (first one, for billing purposes)
    const agentId = (items[0].requisition as any)?.agent_id || null

    // Create supplier order
    const { data: order, error: orderError } = await supabase
      .from('temp_supplier_orders')
      .insert({
        reference,
        supplier_id: supplierId,
        status: 'draft',
        total_cost: totalCost,
        expected_delivery_date: expected_delivery_date || null,
        notes: notes || null,
        ordered_by: user?.id || null,
        agent_id: agentId,
        requisition_item_ids: item_ids,
      })
      .select()
      .single()

    if (orderError) {
      return NextResponse.json({ error: orderError.message }, { status: 500 })
    }

    // Create supplier order items (aggregate by product+variant)
    const aggregated = new Map<string, { product_id: string; variant_id: string | null; quantity: number; unit_cost: number }>()
    for (const item of items) {
      const key = `${item.product_id}|${item.variant_id || ''}`
      const existing = aggregated.get(key)
      if (existing) {
        existing.quantity += item.quantity
      } else {
        aggregated.set(key, {
          product_id: item.product_id,
          variant_id: item.variant_id,
          quantity: item.quantity,
          unit_cost: Number(item.unit_price) || 0,
        })
      }
    }

    const orderItems = [...aggregated.values()].map(a => ({
      supplier_order_id: order.id,
      product_id: a.product_id,
      variant_id: a.variant_id,
      quantity_ordered: a.quantity,
      quantity_received: 0,
      unit_cost: a.unit_cost,
      subtotal: a.quantity * a.unit_cost,
    }))

    await supabase.from('temp_supplier_order_items').insert(orderItems)

    // Link requisition items to the supplier order
    await supabase
      .from('temp_requisition_items')
      .update({ supplier_order_id: order.id, supplier_order_ref: reference })
      .in('id', item_ids)

    return NextResponse.json({ order, reference })
  } catch (err) {
    console.error('[bundle] Error:', err)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
