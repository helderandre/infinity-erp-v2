import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient() as any

    const { data, error } = await supabase
      .from('marketing_orders')
      .select(`
        *,
        agent:dev_users!marketing_orders_agent_id_fkey(id, commercial_name),
        property:dev_properties(id, title, slug),
        marketing_order_items(id, catalog_item_id, pack_id, name, price),
        marketing_order_deliverables(id, file_url, file_name, file_type, file_size, created_at)
      `)
      .eq('id', id)
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 404 })

    return NextResponse.json({
      ...data,
      items: data.marketing_order_items || [],
      deliverables: data.marketing_order_deliverables || [],
      marketing_order_items: undefined,
      marketing_order_deliverables: undefined,
    })
  } catch (error) {
    console.error('Erro ao obter encomenda:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

// PUT — Update order status (accept, reject, schedule, etc.)
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient() as any

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const body = await request.json()
    const { action, ...extra } = body

    // Get current order
    const { data: order, error: orderError } = await supabase
      .from('marketing_orders')
      .select('*')
      .eq('id', id)
      .single()

    if (orderError || !order) {
      return NextResponse.json({ error: 'Encomenda não encontrada' }, { status: 404 })
    }

    let updateData: Record<string, unknown> = {}

    switch (action) {
      case 'accept':
        if (order.status !== 'pending') {
          return NextResponse.json({ error: 'Encomenda não está pendente' }, { status: 400 })
        }
        updateData = { status: 'accepted', assigned_to: extra.assigned_to || null }
        break

      case 'reject':
        if (order.status !== 'pending') {
          return NextResponse.json({ error: 'Encomenda não está pendente' }, { status: 400 })
        }
        updateData = { status: 'rejected', rejection_reason: extra.reason || '' }
        // Refund debit
        await refundOrder(supabase, order, user.id)
        break

      case 'schedule':
        if (order.status !== 'accepted') {
          return NextResponse.json({ error: 'Encomenda não está aceite' }, { status: 400 })
        }
        updateData = {
          status: 'scheduled',
          confirmed_date: extra.confirmed_date,
          confirmed_time: extra.confirmed_time,
        }
        break

      case 'start_production':
        if (order.status !== 'scheduled') {
          return NextResponse.json({ error: 'Encomenda não está agendada' }, { status: 400 })
        }
        updateData = { status: 'in_production' }
        break

      case 'deliver':
        if (order.status !== 'in_production') {
          return NextResponse.json({ error: 'Encomenda não está em produção' }, { status: 400 })
        }
        updateData = { status: 'delivered' }
        break

      case 'complete':
        if (order.status !== 'delivered') {
          return NextResponse.json({ error: 'Encomenda não está entregue' }, { status: 400 })
        }
        updateData = { status: 'completed' }
        break

      case 'cancel':
        if (['in_production', 'delivered', 'completed', 'rejected', 'cancelled'].includes(order.status)) {
          return NextResponse.json({ error: 'Não é possível cancelar esta encomenda' }, { status: 400 })
        }
        updateData = { status: 'cancelled', cancellation_reason: extra.reason || '' }
        // Refund debit
        await refundOrder(supabase, order, user.id)
        break

      case 'update_notes':
        updateData = { internal_notes: extra.internal_notes || '' }
        break

      case 'edit':
        // Admin can edit any field
        if (extra.total_amount !== undefined) updateData.total_amount = extra.total_amount
        if (extra.status !== undefined) updateData.status = extra.status
        if (extra.internal_notes !== undefined) updateData.internal_notes = extra.internal_notes
        if (extra.confirmed_date !== undefined) updateData.confirmed_date = extra.confirmed_date
        if (extra.confirmed_time !== undefined) updateData.confirmed_time = extra.confirmed_time
        if (extra.assigned_to !== undefined) updateData.assigned_to = extra.assigned_to
        break

      default:
        return NextResponse.json({ error: 'Acção inválida' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('marketing_orders')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  } catch (error) {
    console.error('Erro ao actualizar encomenda:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

// DELETE — Admin delete order
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient() as any

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    // Get order for potential refund
    const { data: order } = await supabase
      .from('marketing_orders')
      .select('*')
      .eq('id', id)
      .single()

    if (!order) {
      return NextResponse.json({ error: 'Encomenda não encontrada' }, { status: 404 })
    }

    // Refund if not already rejected/cancelled/completed
    if (!['rejected', 'cancelled', 'completed'].includes(order.status)) {
      await refundOrder(supabase, order, user.id)
    }

    // Delete items first (FK constraint)
    await supabase.from('marketing_order_items').delete().eq('order_id', id)
    await supabase.from('marketing_order_deliverables').delete().eq('order_id', id)

    // Delete the order
    const { error } = await supabase.from('marketing_orders').delete().eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Erro ao eliminar encomenda:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

async function refundOrder(supabase: any, order: any, userId: string) {
  const { data: lastTx } = await supabase
    .from('conta_corrente_transactions')
    .select('balance_after')
    .eq('agent_id', order.agent_id)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  const currentBalance = lastTx?.balance_after ?? 0
  const newBalance = currentBalance + order.total_amount

  await supabase.from('conta_corrente_transactions').insert({
    agent_id: order.agent_id,
    type: 'CREDIT',
    category: 'refund',
    amount: order.total_amount,
    description: `Reembolso — Encomenda cancelada/rejeitada`,
    reference_id: order.id,
    reference_type: 'marketing_order',
    balance_after: newBalance,
    created_by: userId,
  })
}
