import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient() as any

    const { data, error } = await supabase
      .from('property_propostas')
      .select(`
        *,
        lead:leads(id, name, nome, email),
        consultant:dev_users!property_propostas_consultant_id_fkey(id, commercial_name)
      `)
      .eq('property_id', id)
      .order('created_at', { ascending: false })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data || [])
  } catch (error) {
    console.error('Erro ao listar propostas:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient() as any

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const body = await request.json()

    const { data, error } = await supabase
      .from('property_propostas')
      .insert({
        property_id: id,
        consultant_id: user.id,
        lead_id: body.lead_id || null,
        proponente_nome: body.proponente_nome || null,
        natureza: body.natureza || 'propriedade_plena',
        preco: body.preco,
        valor_contrato: body.valor_contrato || 0,
        valor_conclusao: body.valor_conclusao || 0,
        tem_financiamento: body.tem_financiamento || false,
        valor_financiamento: body.valor_financiamento || null,
        valor_reforco_1: body.valor_reforco_1 || null,
        data_reforco_1: body.data_reforco_1 || null,
        valor_reforco_2: body.valor_reforco_2 || null,
        data_reforco_2: body.data_reforco_2 || null,
        condicoes_complementares: body.condicoes_complementares || null,
        status: body.status || 'rascunho',
        pdf_url: body.pdf_url || null,
        notes: body.notes || null,
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  } catch (error) {
    console.error('Erro ao criar proposta:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
