import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { receiveSupplierOrderSchema } from '@/lib/validations/encomenda'
import { notifyOrderArrival } from '@/lib/encomendas/notify-arrival'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient() as any
    const { id } = await params

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const body = await request.json()
    const parsed = receiveSupplierOrderSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Dados inválidos', details: parsed.error.flatten() }, { status: 400 })
    }

    // Get order with items
    const { data: order, error: orderError } = await supabase
      .from('temp_supplier_orders')
      .select('*, items:temp_supplier_order_items(*)')
      .eq('id', id)
      .single()

    if (orderError || !order) {
      return NextResponse.json({ error: 'Encomenda não encontrada' }, { status: 404 })
    }

    let allFullyReceived = true

    for (const receivedItem of parsed.data.items) {
      // Find the order item
      const orderItem = order.items.find((i: any) => i.id === receivedItem.item_id)
      if (!orderItem) continue

      const newReceived = (orderItem.quantity_received || 0) + receivedItem.quantity_received

      // Update item quantity_received
      await supabase
        .from('temp_supplier_order_items')
        .update({ quantity_received: newReceived })
        .eq('id', receivedItem.item_id)

      // Check if fully received
      if (newReceived < orderItem.quantity_ordered) {
        allFullyReceived = false
      }

      if (receivedItem.quantity_received > 0) {
        // Update stock
        const stockFilter: any = { product_id: orderItem.product_id }
        if (orderItem.variant_id) stockFilter.variant_id = orderItem.variant_id

        const { data: stock } = await supabase
          .from('temp_stock')
          .select('id, quantity_available, quantity_on_order')
          .match(stockFilter)
          .single()

        if (stock) {
          await supabase
            .from('temp_stock')
            .update({
              quantity_available: stock.quantity_available + receivedItem.quantity_received,
              quantity_on_order: Math.max(0, (stock.quantity_on_order || 0) - receivedItem.quantity_received),
            })
            .eq('id', stock.id)

          // Create stock movement
          await supabase
            .from('temp_stock_movements')
            .insert({
              stock_id: stock.id,
              movement_type: 'in_purchase',
              quantity: receivedItem.quantity_received,
              reference_id: order.id,
              reference_type: 'supplier_order',
              performed_by: user.id,
              notes: `Recepção encomenda fornecedor #${order.id}`,
            })
        }
      }
    }

    // Update order status — recepção completa significa que a encomenda
    // chegou à agência ('at_store'), o estado que a página "Minhas
    // encomendas" do consultor usa para mostrar o passo de levantamento.
    const newStatus = allFullyReceived ? 'at_store' : 'partially_received'
    const today = new Date().toISOString().split('T')[0]

    const updates: Record<string, any> = {
      status: newStatus,
      actual_delivery_date: today,
      received_by: user.id,
    }
    if (allFullyReceived) updates.at_store_at = new Date().toISOString()

    const { data: updatedOrder, error: updateError } = await supabase
      .from('temp_supplier_orders')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })

    // Chegada à agência → tarefa de levantamento + notificação + push ao
    // consultor comprador (best-effort, não bloqueia a resposta).
    if (allFullyReceived && order.status !== 'at_store' && updatedOrder?.agent_id) {
      await notifyOrderArrival(createAdminClient(), {
        orderId: id,
        agentId: updatedOrder.agent_id,
        reference: updatedOrder.reference,
        actorId: user.id,
      })
    }

    return NextResponse.json(updatedOrder)
  } catch (error) {
    console.error('Erro ao receber encomenda de fornecedor:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
