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
      .select(`
        *,
        items:temp_requisition_items(
          *,
          product:temp_products(id, is_personalizable)
        )
      `)
      .eq('id', id)
      .single()

    if (reqError || !requisition) {
      return NextResponse.json({ error: 'Requisição não encontrada' }, { status: 404 })
    }

    if (requisition.status !== 'pending') {
      return NextResponse.json({ error: 'Apenas requisições pendentes podem ser aprovadas' }, { status: 400 })
    }

    // Update requisition status
    const { error: updateError } = await supabase
      .from('temp_requisitions')
      .update({
        status: 'approved',
        approved_by: user.id,
        approved_at: new Date().toISOString(),
      })
      .eq('id', id)

    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })

    // Process each item: reserve stock or mark as in_production
    for (const item of requisition.items) {
      const isPersonalizable = item.product?.is_personalizable

      if (isPersonalizable) {
        // Personalizable items go to production
        await supabase
          .from('temp_requisition_items')
          .update({ status: 'in_production' })
          .eq('id', item.id)
      } else {
        // Try to reserve stock
        const stockFilter: any = { product_id: item.product_id }
        if (item.variant_id) stockFilter.variant_id = item.variant_id

        const { data: stock } = await supabase
          .from('temp_stock')
          .select('id, quantity_available, quantity_reserved')
          .match(stockFilter)
          .single()

        if (stock && stock.quantity_available >= item.quantity) {
          await supabase
            .from('temp_stock')
            .update({
              quantity_reserved: stock.quantity_reserved + item.quantity,
            })
            .eq('id', stock.id)

          await supabase
            .from('temp_requisition_items')
            .update({ status: 'reserved' })
            .eq('id', item.id)
        } else {
          // Not enough stock — keep as pending
          await supabase
            .from('temp_requisition_items')
            .update({ status: 'pending' })
            .eq('id', item.id)
        }
      }
    }

    return NextResponse.json({ success: true, message: 'Requisição aprovada com sucesso' })
  } catch (error) {
    console.error('Erro ao aprovar requisição:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
