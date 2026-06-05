import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  try {
    const supabase = await createClient() as any
    const { searchParams } = new URL(request.url)

    const stock_id = searchParams.get('stock_id')
    const movement_type = searchParams.get('movement_type')
    const date_from = searchParams.get('date_from')
    const date_to = searchParams.get('date_to')

    let query = supabase
      .from('temp_stock_movements')
      .select('*, performer:dev_users!temp_stock_movements_performed_by_fkey(id, commercial_name)')
      .order('created_at', { ascending: false })
      .limit(100)

    if (stock_id) query = query.eq('stock_id', stock_id)
    if (movement_type) query = query.eq('movement_type', movement_type)
    if (date_from) query = query.gte('created_at', date_from)
    if (date_to) query = query.lte('created_at', date_to)

    const { data, error } = await query

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data || [])
  } catch (error) {
    console.error('Erro ao listar movimentos de stock:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
