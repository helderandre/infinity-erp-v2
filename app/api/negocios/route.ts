import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { createNegocioSchema } from '@/lib/validations/lead'

export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)

    const lead_id = searchParams.get('lead_id')
    const tipo = searchParams.get('tipo')
    const estado = searchParams.get('estado')
    const limit = Math.min(Number(searchParams.get('limit')) || 50, 100)
    const offset = Number(searchParams.get('offset')) || 0

    let query = supabase
      .from('negocios')
      .select('*, lead:leads(id, nome, agent_id, agent:dev_users(id, commercial_name))', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (lead_id) {
      query = query.eq('lead_id', lead_id)
    }
    if (tipo) {
      query = query.eq('tipo', tipo)
    }
    if (estado) {
      query = query.eq('estado', estado)
    }

    const { data, error, count } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data: data || [], total: count || 0 })
  } catch (error) {
    console.error('Erro ao listar negócios:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const body = await request.json()
    const validation = createNegocioSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: validation.error.flatten() },
        { status: 400 }
      )
    }

    const { data: negocio, error } = await supabase
      .from('negocios')
      .insert(validation.data)
      .select('id')
      .single()

    if (error) {
      return NextResponse.json(
        { error: 'Erro ao criar negócio', details: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ id: negocio.id }, { status: 201 })
  } catch (error) {
    console.error('Erro ao criar negócio:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
