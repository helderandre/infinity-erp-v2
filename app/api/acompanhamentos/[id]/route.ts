import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { updateAcompanhamentoSchema } from '@/lib/validations/acompanhamento'

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

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
    }

    const admin = createAdminClient() as any
    const { data, error } = await admin
      .from('temp_acompanhamentos')
      .select(ACOMP_SELECT)
      .eq('id', id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Acompanhamento não encontrado.' }, { status: 404 })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Fetch suggested properties
    const { data: properties } = await admin
      .from('temp_acompanhamento_properties')
      .select(`
        *,
        property:dev_properties!property_id(
          id, title, external_ref, city, zone, listing_price, slug, property_type,
          dev_property_specifications(bedrooms, area_util),
          dev_property_media(url, is_cover)
        )
      `)
      .eq('acompanhamento_id', id)
      .order('created_at', { ascending: false })

    return NextResponse.json({
      data: { ...data, properties: properties || [] },
    })
  } catch (err) {
    console.error('[acompanhamentos/[id] GET]', err)
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
    }

    const body = await request.json()
    const parsed = updateAcompanhamentoSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Dados inválidos.', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const admin = createAdminClient() as any
    const { data, error } = await admin
      .from('temp_acompanhamentos')
      .update(parsed.data)
      .eq('id', id)
      .select(ACOMP_SELECT)
      .single()

    if (error) {
      console.error('[acompanhamentos/[id] PUT]', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data })
  } catch (err) {
    console.error('[acompanhamentos/[id] PUT]', err)
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
    }

    const admin = createAdminClient() as any
    const { error } = await admin
      .from('temp_acompanhamentos')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('[acompanhamentos/[id] DELETE]', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[acompanhamentos/[id] DELETE]', err)
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}
