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

    if (!['pending', 'approved'].includes(requisition.status)) {
      return NextResponse.json({ error: 'Apenas requisições pendentes ou aprovadas podem ser canceladas' }, { status: 400 })
    }

    // If approved, release reserved stock
    if (requisition.status === 'approved') {
      for (const item of requisition.items) {
        if (item.status === 'reserved') {
          const stockFilter: any = { product_id: item.product_id }
          if (item.variant_id) stockFilter.variant_id = item.variant_id

          const { data: stock } = await supabase
            .from('temp_stock')
            .select('id, quantity_reserved')
            .match(stockFilter)
            .single()

          if (stock) {
            await supabase
              .from('temp_stock')
              .update({
                quantity_reserved: Math.max(0, stock.quantity_reserved - item.quantity),
              })
              .eq('id', stock.id)
          }
        }
      }
    }

    // Update requisition status
    const { data, error } = await supabase
      .from('temp_requisitions')
      .update({ status: 'cancelled' })
      .eq('id', id)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  } catch (error) {
    console.error('Erro ao cancelar requisição:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
