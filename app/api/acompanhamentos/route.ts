import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { createAcompanhamentoSchema } from '@/lib/validations/acompanhamento'

const ACOMP_SELECT = `
  *,
  lead:leads!lead_id(id, nome, full_name, email, telemovel),
  consultant:dev_users!consultant_id(id, commercial_name),
  negocio:negocios!negocio_id(
    id, tipo, estado, orcamento, orcamento_max, localizacao,
    quartos_min, tipo_imovel, classe_imovel, estado_imovel,
    motivacao_compra, prazo_compra,
    tem_garagem, tem_elevador, tem_exterior, tem_piscina,
    credito_pre_aprovado, capital_proprio, valor_credito,
    financiamento_necessario, casas_banho, observacoes
  )
`

export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const consultant_id = searchParams.get('consultant_id')
    const lead_id = searchParams.get('lead_id')
    const search = searchParams.get('search')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')

    const admin = createAdminClient() as any
    let query = admin.from('temp_acompanhamentos').select(ACOMP_SELECT, { count: 'exact' })

    if (status) query = query.eq('status', status)
    if (consultant_id) query = query.eq('consultant_id', consultant_id)
    if (lead_id) query = query.eq('lead_id', lead_id)
    if (search) query = query.or(`notes.ilike.%${search}%`)

    query = query.order('created_at', { ascending: false })

    const offset = (page - 1) * limit
    query = query.range(offset, offset + limit - 1)

    const { data, error, count } = await query

    if (error) {
      console.error('[acompanhamentos GET]', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      data: data || [],
      total: count || 0,
      page,
      limit,
      totalPages: Math.ceil((count || 0) / limit),
    })
  } catch (err) {
    console.error('[acompanhamentos GET]', err)
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
    }

    const body = await request.json()
    const parsed = createAcompanhamentoSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Dados inválidos.', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const admin = createAdminClient() as any

    // Check if an acompanhamento already exists for this negócio
    if (parsed.data.negocio_id) {
      const { data: existing } = await admin
        .from('temp_acompanhamentos')
        .select('id')
        .eq('negocio_id', parsed.data.negocio_id)
        .limit(1)
        .single()

      if (existing) {
        return NextResponse.json(
          { error: 'Já existe um acompanhamento para este negócio.', existing_id: existing.id },
          { status: 409 }
        )
      }
    }

    const { data, error } = await admin
      .from('temp_acompanhamentos')
      .insert({ ...parsed.data, created_by: user.id })
      .select(ACOMP_SELECT)
      .single()

    if (error) {
      console.error('[acompanhamentos POST]', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data }, { status: 201 })
  } catch (err) {
    console.error('[acompanhamentos POST]', err)
    return NextResponse.json({ error: 'Erro interno ao criar acompanhamento.' }, { status: 500 })
  }
}
