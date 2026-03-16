import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const supabase = await createClient() as any

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

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
      .eq('agent_id', user.id)
      .order('created_at', { ascending: false })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data || [])
  } catch (error) {
    console.error('Erro ao listar as minhas requisições:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
