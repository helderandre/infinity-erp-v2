import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient() as any
    const { id } = await params

    const { data, error } = await supabase
      .from('temp_requisitions')
      .select(`
        *,
        agent:dev_users!temp_requisitions_agent_id_fkey(id, commercial_name),
        property:dev_properties!temp_requisitions_property_id_fkey(id, title, slug),
        items:temp_requisition_items(
          *,
          product:temp_products(id, name, sku, thumbnail_url),
          variant:temp_product_variants(id, name)
        )
      `)
      .eq('id', id)
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!data) return NextResponse.json({ error: 'Requisição não encontrada' }, { status: 404 })
    return NextResponse.json(data)
  } catch (error) {
    console.error('Erro ao obter requisição:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
