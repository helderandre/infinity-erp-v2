import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/permissions'

// GET: list marketing requests
//
// Scope: gestão (permissions.users) vê tudo + pode filtrar por agent_id;
// consultor só vê os seus (filtro forçado, ignora ?agent_id de outros).
export async function GET(request: Request) {
  try {
    const auth = await requireAuth()
    if (!auth.authorized) return auth.response

    const supabase = await createClient() as any
    const canSeeAll = auth.permissions.users === true
    const { searchParams } = new URL(request.url)

    const status = searchParams.get('status')
    const agent_id_param = searchParams.get('agent_id')
    const property_id = searchParams.get('property_id')
    const from_date = searchParams.get('from')
    const to_date = searchParams.get('to')

    // Scope: consultor → forçado a self; gestão → respeita ?agent_id se passado
    const effectiveAgentId = canSeeAll ? agent_id_param : auth.user.id

    let query = supabase
      .from('marketing_requests')
      .select(`
        *,
        order_item:marketing_order_items(id, name, price, catalog_item_id, pack_id,
          catalog_item:marketing_catalog(id, name, category, thumbnail, requires_scheduling, requires_property)
        ),
        agent:dev_users!marketing_requests_agent_id_fkey(id, commercial_name),
        property:dev_properties(id, title, slug, address_street, city)
      `)
      .order('created_at', { ascending: false })

    if (status) query = query.eq('status', status)
    if (effectiveAgentId) query = query.eq('agent_id', effectiveAgentId)
    if (property_id) query = query.eq('property_id', property_id)
    if (from_date) query = query.gte('preferred_date', from_date)
    if (to_date) query = query.lte('preferred_date', to_date)

    const { data, error } = await query

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data || [])
  } catch (error) {
    console.error('Erro ao listar pedidos marketing:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

// POST: create a marketing request (agent "uses" a purchased item)
export async function POST(request: Request) {
  try {
    const supabase = await createClient() as any

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const body = await request.json()
    const { order_item_id, ...requestData } = body

    if (!order_item_id) {
      return NextResponse.json({ error: 'order_item_id é obrigatório' }, { status: 400 })
    }

    // Verify the order item belongs to this user and is available
    const { data: orderItem, error: itemError } = await supabase
      .from('marketing_order_items')
      .select('*, order:marketing_orders!inner(agent_id)')
      .eq('id', order_item_id)
      .single()

    if (itemError || !orderItem) {
      return NextResponse.json({ error: 'Produto não encontrado' }, { status: 404 })
    }

    if (orderItem.order.agent_id !== user.id) {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    }

    if (orderItem.status !== 'available' || orderItem.used_count >= orderItem.quantity) {
      return NextResponse.json({ error: 'Este produto já foi utilizado' }, { status: 400 })
    }

    // Create the request
    const { data: req, error: reqError } = await supabase
      .from('marketing_requests')
      .insert({
        order_item_id,
        agent_id: user.id,
        status: 'pending',
        ...requestData,
      })
      .select()
      .single()

    if (reqError) {
      return NextResponse.json({ error: reqError.message }, { status: 500 })
    }

    // Update order item: increment used_count, set status if fully used
    const newUsedCount = orderItem.used_count + 1
    const newStatus = newUsedCount >= orderItem.quantity ? 'used' : 'available'

    await supabase
      .from('marketing_order_items')
      .update({ used_count: newUsedCount, status: newStatus })
      .eq('id', order_item_id)

    return NextResponse.json(req, { status: 201 })
  } catch (error) {
    console.error('Erro ao criar pedido marketing:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
