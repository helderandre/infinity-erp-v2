import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { createReturnSchema } from '@/lib/validations/encomenda'

export async function GET() {
  try {
    const supabase = await createClient() as any

    const { data, error } = await supabase
      .from('temp_returns')
      .select(`
        *,
        agent:dev_users!temp_returns_agent_id_fkey(id, commercial_name),
        product:temp_products(id, name, sku),
        variant:temp_product_variants(id, name)
      `)
      .order('created_at', { ascending: false })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data || [])
  } catch (error) {
    console.error('Erro ao listar devoluções:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient() as any

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const body = await request.json()
    const parsed = createReturnSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Dados inválidos', details: parsed.error.flatten() }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('temp_returns')
      .insert(parsed.data)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data, { status: 201 })
  } catch (error) {
    console.error('Erro ao criar devolução:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
