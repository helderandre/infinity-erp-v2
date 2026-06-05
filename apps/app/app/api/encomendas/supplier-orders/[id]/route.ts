import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = createAdminClient() as any
    const { id } = await params

    const { data, error } = await supabase
      .from('temp_supplier_orders')
      .select(`
        *,
        supplier:temp_suppliers(id, name),
        items:temp_supplier_order_items(
          *,
          product:temp_products(id, name, sku),
          variant:temp_product_variants(id, name)
        ),
        ordered_by_user:dev_users!ordered_by(id, commercial_name)
      `)
      .eq('id', id)
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!data) return NextResponse.json({ error: 'Encomenda não encontrada' }, { status: 404 })
    return NextResponse.json(data)
  } catch (error) {
    console.error('Erro ao obter encomenda a fornecedor:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

export async function PUT(
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
    const { status } = body

    if (!status) {
      return NextResponse.json({ error: 'Status obrigatório' }, { status: 400 })
    }

    // Set timestamps based on status transitions
    const updates: Record<string, any> = { status }
    if (status === 'ordered') updates.ordered_at = new Date().toISOString()
    if (status === 'at_store') updates.at_store_at = new Date().toISOString()
    if (status === 'delivered' || status === 'picked_up') updates.delivered_at = new Date().toISOString()

    const admin = createAdminClient() as any
    const { data, error } = await admin
      .from('temp_supplier_orders')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!data) return NextResponse.json({ error: 'Encomenda não encontrada' }, { status: 404 })
    return NextResponse.json(data)
  } catch (error) {
    console.error('Erro ao actualizar encomenda a fornecedor:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
