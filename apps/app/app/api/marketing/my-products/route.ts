import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// GET: list current user's purchased items (available to use)
export async function GET() {
  try {
    const supabase = await createClient() as any

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    // Get all order items for this user's orders
    const { data, error } = await supabase
      .from('marketing_order_items')
      .select(`
        *,
        order:marketing_orders!inner(id, agent_id, status, created_at),
        catalog_item:marketing_catalog(id, name, description, category, price, thumbnail, requires_scheduling, requires_property, estimated_delivery_days),
        pack:marketing_packs(id, name, description, price, thumbnail)
      `)
      .eq('order.agent_id', user.id)
      .order('order(created_at)', { ascending: false })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data || [])
  } catch (error) {
    console.error('Erro ao listar produtos:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
