import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { createOrderSchema } from '@/lib/validations/marketing'

export async function GET(request: Request) {
  try {
    const supabase = await createClient() as any
    const { searchParams } = new URL(request.url)

    const status = searchParams.get('status')
    const agent_id = searchParams.get('agent_id')
    const limit = Math.min(Number(searchParams.get('limit')) || 20, 100)
    const offset = Number(searchParams.get('offset')) || 0

    let query = supabase
      .from('marketing_orders')
      .select(`
        *,
        agent:dev_users!marketing_orders_agent_id_fkey(id, commercial_name),
        property:dev_properties(id, title, slug),
        marketing_order_items(id, catalog_item_id, pack_id, name, price)
      `, { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (status) query = query.eq('status', status)
    if (agent_id) query = query.eq('agent_id', agent_id)

    const { data, error, count } = await query

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const orders = (data || []).map((order: any) => ({
      ...order,
      items: order.marketing_order_items || [],
      marketing_order_items: undefined,
    }))

    return NextResponse.json({ data: orders, total: count || 0 })
  } catch (error) {
    console.error('Erro ao listar encomendas:', error)
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
    const parsed = createOrderSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Dados inválidos', details: parsed.error.flatten() }, { status: 400 })
    }

    const { items } = parsed.data
    const total_amount = items.reduce((sum, item) => sum + item.price, 0)

    // Create order
    const { data: order, error: orderError } = await supabase
      .from('marketing_orders')
      .insert({
        agent_id: user.id,
        total_amount,
        status: 'pending',
      })
      .select()
      .single()

    if (orderError || !order) {
      return NextResponse.json({ error: orderError?.message || 'Erro ao criar encomenda' }, { status: 500 })
    }

    // Create order items
    const orderItems = items.map(item => ({
      order_id: order.id,
      catalog_item_id: item.catalog_item_id || null,
      pack_id: item.pack_id || null,
      name: item.name,
      price: item.price,
    }))

    const { error: itemsError } = await supabase
      .from('marketing_order_items')
      .insert(orderItems)

    if (itemsError) {
      await supabase.from('marketing_orders').delete().eq('id', order.id)
      return NextResponse.json({ error: itemsError.message }, { status: 500 })
    }

    // Debit conta corrente
    // Get current balance
    const { data: lastTx } = await supabase
      .from('conta_corrente_transactions')
      .select('balance_after')
      .eq('agent_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    const currentBalance = lastTx?.balance_after ?? 0
    const newBalance = currentBalance - total_amount

    await supabase.from('conta_corrente_transactions').insert({
      agent_id: user.id,
      type: 'DEBIT',
      category: 'marketing_purchase',
      amount: total_amount,
      description: `Encomenda Marketing — ${items.map(i => i.name).join(', ')}`,
      reference_id: order.id,
      reference_type: 'marketing_order',
      balance_after: newBalance,
      created_by: user.id,
    })

    return NextResponse.json(order, { status: 201 })
  } catch (error) {
    console.error('Erro ao criar encomenda:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
