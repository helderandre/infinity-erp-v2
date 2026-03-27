import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { createSupplierOrderSchema } from '@/lib/validations/encomenda'

export async function GET(request: Request) {
  try {
    const supabase = createAdminClient() as any
    const { searchParams } = new URL(request.url)

    const status = searchParams.get('status')
    const supplier_id = searchParams.get('supplier_id')

    const agent_id = searchParams.get('agent_id')

    let query = supabase
      .from('temp_supplier_orders')
      .select(`
        *,
        supplier:temp_partners(id, name),
        items:temp_supplier_order_items(
          *,
          product:temp_products(id, name, sku),
          variant:temp_product_variants(id, name)
        ),
        ordered_by_user:dev_users!temp_supplier_orders_ordered_by_fkey(id, commercial_name),
        agent:dev_users!temp_supplier_orders_agent_id_fkey(id, commercial_name)
      `)
      .order('created_at', { ascending: false })

    if (status) query = query.eq('status', status)
    if (supplier_id) query = query.eq('supplier_id', supplier_id)
    if (agent_id) query = query.eq('agent_id', agent_id)

    const { data, error } = await query

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data || [])
  } catch (error) {
    console.error('Erro ao listar encomendas a fornecedores:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient() as any

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const body = await request.json()
    const parsed = createSupplierOrderSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Dados inválidos', details: parsed.error.flatten() }, { status: 400 })
    }

    const { items, billing_entity, billing_name, billing_nif, billing_address, billing_email, ...orderData } = parsed.data

    // Calculate subtotals and total
    const itemsWithSubtotals = items.map((item) => ({
      ...item,
      subtotal: item.unit_cost * item.quantity_ordered,
    }))

    const totalCost = itemsWithSubtotals.reduce((sum, item) => sum + item.subtotal, 0)

    // Insert order
    const { data: order, error: orderError } = await supabase
      .from('temp_supplier_orders')
      .insert({
        ...orderData,
        total_cost: totalCost,
        ordered_by: user.id,
        status: 'draft',
        ...(billing_entity ? { billing_entity } : {}),
        ...(billing_name ? { billing_name } : {}),
        ...(billing_nif ? { billing_nif } : {}),
        ...(billing_address ? { billing_address } : {}),
        ...(billing_email ? { billing_email } : {}),
      })
      .select()
      .single()

    if (orderError) return NextResponse.json({ error: orderError.message }, { status: 500 })

    // Insert items
    const itemsToInsert = itemsWithSubtotals.map((item) => ({
      ...item,
      supplier_order_id: order.id,
    }))

    const { error: itemsError } = await supabase
      .from('temp_supplier_order_items')
      .insert(itemsToInsert)

    if (itemsError) return NextResponse.json({ error: itemsError.message }, { status: 500 })

    // Update stock quantity_on_order for each item
    for (const item of items) {
      const stockFilter: any = { product_id: item.product_id }
      if (item.variant_id) stockFilter.variant_id = item.variant_id

      const { data: stock } = await supabase
        .from('temp_stock')
        .select('id, quantity_on_order')
        .match(stockFilter)
        .single()

      if (stock) {
        await supabase
          .from('temp_stock')
          .update({
            quantity_on_order: (stock.quantity_on_order || 0) + item.quantity_ordered,
          })
          .eq('id', stock.id)
      }
    }

    // Return full order
    const { data: fullOrder, error: fetchError } = await supabase
      .from('temp_supplier_orders')
      .select(`
        *,
        supplier:temp_partners(id, name),
        items:temp_supplier_order_items(
          *,
          product:temp_products(id, name, sku),
          variant:temp_product_variants(id, name)
        ),
        ordered_by_user:dev_users!ordered_by(id, commercial_name)
      `)
      .eq('id', order.id)
      .single()

    if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 500 })
    return NextResponse.json(fullOrder, { status: 201 })
  } catch (error) {
    console.error('Erro ao criar encomenda a fornecedor:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
