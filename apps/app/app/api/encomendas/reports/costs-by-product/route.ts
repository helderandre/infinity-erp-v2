import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  try {
    const supabase = await createClient() as any
    const { searchParams } = new URL(request.url)

    const date_from = searchParams.get('date_from')
    const date_to = searchParams.get('date_to')

    // Get delivered requisition IDs within date range
    let reqQuery = supabase
      .from('temp_requisitions')
      .select('id')
      .eq('status', 'delivered')

    if (date_from) reqQuery = reqQuery.gte('actual_delivery_date', date_from)
    if (date_to) reqQuery = reqQuery.lte('actual_delivery_date', date_to)

    const { data: requisitions, error: reqError } = await reqQuery

    if (reqError) return NextResponse.json({ error: reqError.message }, { status: 500 })

    if (!requisitions || requisitions.length === 0) {
      return NextResponse.json([])
    }

    const requisitionIds = requisitions.map((r: any) => r.id)

    // Get items for those requisitions
    const { data: items, error: itemsError } = await supabase
      .from('temp_requisition_items')
      .select('product_id, quantity, subtotal, product:temp_products(id, name, sku)')
      .in('requisition_id', requisitionIds)

    if (itemsError) return NextResponse.json({ error: itemsError.message }, { status: 500 })

    // Group by product
    const grouped: Record<string, { product_id: string; name: string; sku: string | null; total_cost: number; total_quantity: number }> = {}

    for (const item of items || []) {
      const productId = item.product_id
      if (!grouped[productId]) {
        grouped[productId] = {
          product_id: productId,
          name: item.product?.name || 'Desconhecido',
          sku: item.product?.sku || null,
          total_cost: 0,
          total_quantity: 0,
        }
      }
      grouped[productId].total_cost += item.subtotal || 0
      grouped[productId].total_quantity += item.quantity || 0
    }

    const result = Object.values(grouped).sort((a, b) => b.total_cost - a.total_cost)

    return NextResponse.json(result)
  } catch (error) {
    console.error('Erro ao obter custos por produto:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
