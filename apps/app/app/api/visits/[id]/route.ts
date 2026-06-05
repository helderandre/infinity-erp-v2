import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { updateVisitSchema } from '@/lib/validations/visit'

const VISIT_SELECT = `
  *,
  property:dev_properties!property_id(
    id, title, external_ref, city, zone, address_street, slug, listing_price, property_type,
    dev_property_media(url, is_cover, order_index)
  ),
  consultant:dev_users!consultant_id(id, commercial_name),
  lead:leads!lead_id(id, full_name, telemovel, email)
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
      .from('visits')
      .select(VISIT_SELECT)
      .eq('id', id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Visita não encontrada.' }, { status: 404 })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data })
  } catch (err) {
    console.error('[visits/[id] GET]', err)
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
    const parsed = updateVisitSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Dados inválidos.', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const admin = createAdminClient() as any

    // If confirming, set confirmed_at
    const updateData: any = { ...parsed.data }
    if (parsed.data.status === 'confirmed' && !updateData.confirmed_at) {
      updateData.confirmed_at = new Date().toISOString()
    }

    const { data, error } = await admin
      .from('visits')
      .update(updateData)
      .eq('id', id)
      .select(VISIT_SELECT)
      .single()

    if (error) {
      console.error('[visits/[id] PUT]', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Note: o calendário projecta a partir de `visits` em runtime, não há nada a sincronizar.
    return NextResponse.json({ data })
  } catch (err) {
    console.error('[visits/[id] PUT]', err)
    return NextResponse.json({ error: 'Erro interno ao actualizar visita.' }, { status: 500 })
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

    // Limpa entradas auto-geradas no `temp_goal_activity_log` que ficaram
    // ligadas a esta visita (criadas quando a visita foi marcada como
    // completed). Apaga ANTES da visita para evitar orfãos caso a delete da
    // visita falhe a meio. Só apaga linhas com `origin_type='system'` —
    // declarações manuais (origin_type='declared') nunca tocam neste fluxo.
    await admin
      .from('temp_goal_activity_log')
      .delete()
      .eq('reference_id', id)
      .eq('reference_type', 'visit')
      .eq('origin_type', 'system')

    // Note: o calendário projecta a partir de `visits` em runtime, não há nada a limpar.
    const { error } = await admin
      .from('visits')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('[visits/[id] DELETE]', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[visits/[id] DELETE]', err)
    return NextResponse.json({ error: 'Erro interno ao eliminar visita.' }, { status: 500 })
  }
}
