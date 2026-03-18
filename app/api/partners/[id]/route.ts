import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { updatePartnerSchema } from '@/lib/validations/partner'

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
      .from('temp_partners')
      .select('*')
      .eq('id', id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Parceiro não encontrado.' }, { status: 404 })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Fetch ratings
    const { data: ratings } = await admin
      .from('temp_partner_ratings')
      .select('*, user:dev_users!user_id(id, commercial_name)')
      .eq('partner_id', id)
      .order('created_at', { ascending: false })

    return NextResponse.json({ data: { ...data, ratings: ratings || [] } })
  } catch (err) {
    console.error('[partners/[id] GET]', err)
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
    const parsed = updatePartnerSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Dados inválidos.', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const admin = createAdminClient() as any

    const updateData = { ...parsed.data }
    if (updateData.nif === '') updateData.nif = null
    if (updateData.email === '') updateData.email = null

    const { data, error } = await admin
      .from('temp_partners')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      if (error.code === '23505' && error.message.includes('nif')) {
        return NextResponse.json({ error: 'Já existe um parceiro com este NIF.' }, { status: 409 })
      }
      console.error('[partners/[id] PUT]', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data })
  } catch (err) {
    console.error('[partners/[id] PUT]', err)
    return NextResponse.json({ error: 'Erro interno ao actualizar parceiro.' }, { status: 500 })
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
      .from('temp_partners')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('[partners/[id] DELETE]', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[partners/[id] DELETE]', err)
    return NextResponse.json({ error: 'Erro interno ao eliminar parceiro.' }, { status: 500 })
  }
}
