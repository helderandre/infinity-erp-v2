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

    // Get return record
    const { data: returnRecord, error: returnError } = await supabase
      .from('temp_returns')
      .select('*')
      .eq('id', id)
      .single()

    if (returnError || !returnRecord) {
      return NextResponse.json({ error: 'Devolução não encontrada' }, { status: 404 })
    }

    if (returnRecord.processed_at) {
      return NextResponse.json({ error: 'Devolução já foi processada' }, { status: 400 })
    }

    const now = new Date().toISOString()
    const updateData: any = {
      processed_by: user.id,
      processed_at: now,
    }

    // If condition is good, return items to stock
    if (returnRecord.condition === 'good') {
      const stockFilter: any = { product_id: returnRecord.product_id }
      if (returnRecord.variant_id) stockFilter.variant_id = returnRecord.variant_id

      const { data: stock } = await supabase
        .from('temp_stock')
        .select('id, quantity_available')
        .match(stockFilter)
        .single()

      if (stock) {
        await supabase
          .from('temp_stock')
          .update({
            quantity_available: stock.quantity_available + returnRecord.quantity,
          })
          .eq('id', stock.id)

        // Create stock movement
        await supabase
          .from('temp_stock_movements')
          .insert({
            stock_id: stock.id,
            movement_type: 'in_return',
            quantity: returnRecord.quantity,
            reference_id: returnRecord.id,
            reference_type: 'return',
            performed_by: user.id,
            notes: `Devolução processada - condição: bom estado`,
          })
      }
    }

    // If refund amount > 0, create conta corrente credit
    if (returnRecord.refund_amount > 0) {
      const { data: lastTx } = await supabase
        .from('conta_corrente_transactions')
        .select('balance_after')
        .eq('agent_id', returnRecord.agent_id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      const previousBalance = lastTx?.balance_after || 0
      const balanceAfter = previousBalance + returnRecord.refund_amount

      const { data: ccTx } = await supabase
        .from('conta_corrente_transactions')
        .insert({
          agent_id: returnRecord.agent_id,
          type: 'CREDIT',
          category: 'refund',
          amount: returnRecord.refund_amount,
          balance_after: balanceAfter,
          reference_id: returnRecord.id,
          reference_type: 'return',
          description: `Reembolso devolução`,
          date: new Date().toISOString(),
          created_by: user.id,
        })
        .select()
        .single()

      if (ccTx) {
        updateData.conta_corrente_tx_id = ccTx.id
      }
    }

    // Update return record
    const { data, error } = await supabase
      .from('temp_returns')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  } catch (error) {
    console.error('Erro ao processar devolução:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
