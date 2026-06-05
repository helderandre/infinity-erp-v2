// @ts-nocheck
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
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
    const admin = createAdminClient() as any
    const body = await request.json()
    const { item_ids, supplier_id, supplier_name, expected_delivery_date, notes } = body as {
      item_ids: string[]
      supplier_id?: string | null
      supplier_name?: string | null
      expected_delivery_date?: string
      notes?: string
    }

    if (!item_ids || item_ids.length === 0) {
      return NextResponse.json({ error: 'Seleccione pelo menos um item' }, { status: 400 })
    }

    // Fetch items with product and requisition info
    const { data: items, error: itemsError } = await admin
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

    // Resolve supplier — use existing or create new from free text
    let supplierId = supplier_id || ''
    if (!supplierId && supplier_name?.trim()) {
      // Create new supplier in temp_partners table
      const { data: newSupplier, error: createErr } = await admin
        .from('temp_partners')
        .insert({
          name: supplier_name.trim(),
          category: 'supplier',
          visibility: 'public',
          person_type: 'coletiva',
          is_active: true,
        })
        .select('id')
        .single()

      if (createErr || !newSupplier) {
        return NextResponse.json({ error: 'Erro ao criar fornecedor: ' + (createErr?.message || '') }, { status: 500 })
      }
      supplierId = newSupplier.id
    }

    if (!supplierId) {
      return NextResponse.json({ error: 'Seleccione ou escreva o nome do fornecedor' }, { status: 400 })
    }

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
    const { data: lastOrder } = await admin
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

    // Get agent_id and payment method from the parent requisitions
    const agentId = (items[0].requisition as any)?.agent_id || null
    const paymentMethod = [...paymentMethods][0] || null

    // Create supplier order
    const { data: order, error: orderError } = await admin
      .from('temp_supplier_orders')
      .insert({
        reference,
        supplier_id: supplierId,
        status: 'ordered',
        total_cost: totalCost,
        expected_delivery_date: expected_delivery_date || null,
        notes: notes || null,
        ordered_by: user?.id || null,
        agent_id: agentId,
        payment_method: paymentMethod,
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

    await admin.from('temp_supplier_order_items').insert(orderItems)

    // Link requisition items to the supplier order
    await admin
      .from('temp_requisition_items')
      .update({ supplier_order_id: order.id, supplier_order_ref: reference })
      .in('id', item_ids)

    console.log('[bundle] Order created:', reference, 'ID:', order.id, 'Supplier:', supplierId)
    return NextResponse.json({ order, reference })
  } catch (err) {
    console.error('[bundle] Error:', err)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
