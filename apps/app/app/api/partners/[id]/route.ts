import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { updatePartnerSchema } from '@/lib/validations/partner'
import { isPartnersStaff } from '@/lib/auth/partners-staff'

async function getRole(userId: string) {
  return { isStaff: await isPartnersStaff(userId) }
}

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

    const { isStaff } = await getRole(user.id)

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

    // Visibility gate: non-staff can only see approved public OR their own (any status)
    const isSubmitter = data.submitted_by === user.id
    if (!isStaff) {
      if (!isSubmitter) {
        if (data.status !== 'approved' || data.visibility !== 'public') {
          return NextResponse.json({ error: 'Parceiro não encontrado.' }, { status: 404 })
        }
      }
    }

    // Fetch ratings (only for approved partners)
    let ratings: any[] = []
    if (data.status === 'approved') {
      const { data: rows } = await admin
        .from('temp_partner_ratings')
        .select('*, user:dev_users!user_id(id, commercial_name)')
        .eq('partner_id', id)
        .order('created_at', { ascending: false })
      ratings = rows || []
    }

    const canEdit = isStaff || (isSubmitter && data.status === 'pending')

    // Strip sensitive fields for non-staff
    const payload = isStaff
      ? { ...data, ratings }
      : (() => {
          const { internal_notes, commercial_conditions, ...rest } = data
          return { ...rest, ratings }
        })()

    return NextResponse.json({ data: payload, isStaff, canEdit })
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

    const { isStaff } = await getRole(user.id)
    const admin = createAdminClient() as any

    // If category changed, validate the new slug
    if (parsed.data.category) {
      const { data: catRow } = await admin
        .from('partner_categories')
        .select('slug, is_active')
        .eq('slug', parsed.data.category)
        .single()
      if (!catRow) {
        return NextResponse.json({ error: 'Categoria inválida.' }, { status: 400 })
      }
      if (!catRow.is_active) {
        return NextResponse.json({ error: 'Categoria inactiva.' }, { status: 400 })
      }
    }

    const { data: existing, error: fetchError } = await admin
      .from('temp_partners')
      .select('id, status, submitted_by')
      .eq('id', id)
      .single()

    if (fetchError || !existing) {
      return NextResponse.json({ error: 'Parceiro não encontrado.' }, { status: 404 })
    }

    // Consultor can only edit their own pending proposal
    if (!isStaff) {
      if (existing.submitted_by !== user.id) {
        return NextResponse.json({ error: 'Sem permissão para editar este parceiro.' }, { status: 403 })
      }
      if (existing.status !== 'pending') {
        return NextResponse.json({ error: 'Só podes editar propostas pendentes.' }, { status: 403 })
      }
    }

    const updateData: Record<string, any> = { ...parsed.data }
    if (updateData.nif === '') updateData.nif = null
    if (updateData.email === '') updateData.email = null

    // Non-staff cannot mutate internal-only fields
    if (!isStaff) {
      delete updateData.internal_notes
      delete updateData.commercial_conditions
      delete updateData.is_recommended
      delete updateData.visibility
    }

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

    const { isStaff } = await getRole(user.id)
    const admin = createAdminClient() as any

    const { data: existing, error: fetchError } = await admin
      .from('temp_partners')
      .select('id, status, submitted_by')
      .eq('id', id)
      .single()

    if (fetchError || !existing) {
      return NextResponse.json({ error: 'Parceiro não encontrado.' }, { status: 404 })
    }

    // Consultor can only withdraw their own pending proposal
    if (!isStaff) {
      if (existing.submitted_by !== user.id) {
        return NextResponse.json({ error: 'Sem permissão para eliminar este parceiro.' }, { status: 403 })
      }
      if (existing.status !== 'pending') {
        return NextResponse.json({ error: 'Só podes retirar propostas pendentes.' }, { status: 403 })
      }
    }

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
