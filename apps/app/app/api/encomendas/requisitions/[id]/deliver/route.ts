import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

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

    // Get requisition with items
    const { data: requisition, error: reqError } = await supabase
      .from('temp_requisitions')
      .select('*, items:temp_requisition_items(*)')
      .eq('id', id)
      .single()

    if (reqError || !requisition) {
      return NextResponse.json({ error: 'Requisição não encontrada' }, { status: 404 })
    }

    if (!['approved', 'ready'].includes(requisition.status)) {
      return NextResponse.json({ error: 'Apenas requisições aprovadas ou prontas podem ser entregues' }, { status: 400 })
    }

    const now = new Date().toISOString()
    const today = new Date().toISOString().split('T')[0]

    // Process each item: update stock and create movements
    for (const item of requisition.items) {
      const stockFilter: any = { product_id: item.product_id }
      if (item.variant_id) stockFilter.variant_id = item.variant_id

      const { data: stock } = await supabase
        .from('temp_stock')
        .select('id, quantity_available, quantity_reserved')
        .match(stockFilter)
        .single()

      if (stock) {
        const wasReserved = item.status === 'reserved'
        await supabase
          .from('temp_stock')
          .update({
            quantity_available: stock.quantity_available - item.quantity,
            ...(wasReserved ? { quantity_reserved: Math.max(0, stock.quantity_reserved - item.quantity) } : {}),
          })
          .eq('id', stock.id)

        // Create stock movement
        await supabase
          .from('temp_stock_movements')
          .insert({
            stock_id: stock.id,
            movement_type: 'out_requisition',
            quantity: item.quantity,
            reference_id: requisition.id,
            reference_type: 'requisition',
            performed_by: user.id,
            notes: `Entrega requisição #${requisition.id}`,
          })
      }

      // Update item status
      await supabase
        .from('temp_requisition_items')
        .update({ status: 'delivered' })
        .eq('id', item.id)
    }

    // Create conta corrente transaction
    // Get last transaction to calculate balance
    const { data: lastTx } = await supabase
      .from('conta_corrente_transactions')
      .select('balance_after')
      .eq('agent_id', requisition.agent_id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    const previousBalance = lastTx?.balance_after || 0
    const balanceAfter = previousBalance - requisition.total_amount

    const { data: ccTx, error: ccError } = await supabase
      .from('conta_corrente_transactions')
      .insert({
        agent_id: requisition.agent_id,
        type: 'DEBIT',
        category: 'marketing_purchase',
        settlement_status: 'confirmed',
        amount: requisition.total_amount,
        balance_after: balanceAfter,
        reference_id: requisition.id,
        reference_type: 'requisition',
        description: `Entrega de materiais - Requisição`,
        date: new Date().toISOString(),
        created_by: user.id,
      })
      .select()
      .single()

    // Update requisition
    const updateData: any = {
      status: 'delivered',
      actual_delivery_date: today,
      delivered_by: user.id,
    }

    if (ccTx && !ccError) {
      updateData.conta_corrente_tx_id = ccTx.id
    }

    const { data: updatedRequisition, error: updateError } = await supabase
      .from('temp_requisitions')
      .update(updateData)
      .eq('id', id)
      .select(`
        *,
        agent:dev_users!temp_requisitions_agent_id_fkey(id, commercial_name),
        items:temp_requisition_items(
          *,
          product:temp_products(id, name, sku, thumbnail_url),
          variant:temp_product_variants(id, name)
        )
      `)
      .single()

    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })
    return NextResponse.json(updatedRequisition)
  } catch (error) {
    console.error('Erro ao entregar requisição:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
