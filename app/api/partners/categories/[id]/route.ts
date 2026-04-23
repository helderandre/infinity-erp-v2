import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { isPartnersStaff } from '@/lib/auth/partners-staff'
import { z } from 'zod'

const updateCategorySchema = z.object({
  label: z.string().min(1).max(120).optional(),
  icon: z.string().min(1).max(64).optional(),
  color: z.string().min(1).max(32).optional(),
  sort_order: z.number().int().optional(),
  is_active: z.boolean().optional(),
})

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

    const isStaff = await isPartnersStaff(user.id)
    if (!isStaff) {
      return NextResponse.json({ error: 'Sem permissão.' }, { status: 403 })
    }

    const body = await request.json()
    const parsed = updateCategorySchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Dados inválidos.', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const admin = createAdminClient() as any
    const { data: existing } = await admin
      .from('partner_categories')
      .select('is_system')
      .eq('id', id)
      .single()

    if (!existing) {
      return NextResponse.json({ error: 'Categoria não encontrada.' }, { status: 404 })
    }

    // System categories cannot be deactivated
    if (existing.is_system && parsed.data.is_active === false) {
      return NextResponse.json({ error: 'Categorias de sistema não podem ser desactivadas.' }, { status: 403 })
    }

    const updateData: Record<string, any> = { ...parsed.data, updated_at: new Date().toISOString() }

    const { data, error } = await admin
      .from('partner_categories')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('[partners/categories/[id] PUT]', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data })
  } catch (err) {
    console.error('[partners/categories/[id] PUT]', err)
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

    const isStaff = await isPartnersStaff(user.id)
    if (!isStaff) {
      return NextResponse.json({ error: 'Sem permissão.' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const reassignToSlug = searchParams.get('reassign_to')

    const admin = createAdminClient() as any
    const { data: existing } = await admin
      .from('partner_categories')
      .select('id, slug, is_system')
      .eq('id', id)
      .single()

    if (!existing) {
      return NextResponse.json({ error: 'Categoria não encontrada.' }, { status: 404 })
    }

    if (existing.is_system) {
      return NextResponse.json({ error: 'Categorias de sistema não podem ser eliminadas.' }, { status: 403 })
    }

    // Count partners currently assigned to this category
    const { count } = await admin
      .from('temp_partners')
      .select('id', { count: 'exact', head: true })
      .eq('category', existing.slug)

    const partnerCount = count || 0

    if (partnerCount > 0 && !reassignToSlug) {
      return NextResponse.json(
        { error: 'Categoria em uso.', partner_count: partnerCount },
        { status: 409 }
      )
    }

    if (partnerCount > 0 && reassignToSlug) {
      const { data: target } = await admin
        .from('partner_categories')
        .select('slug')
        .eq('slug', reassignToSlug)
        .eq('is_active', true)
        .single()

      if (!target) {
        return NextResponse.json({ error: 'Categoria de destino inválida.' }, { status: 400 })
      }

      const { error: reassignError } = await admin
        .from('temp_partners')
        .update({ category: reassignToSlug })
        .eq('category', existing.slug)

      if (reassignError) {
        console.error('[partners/categories/[id] DELETE reassign]', reassignError)
        return NextResponse.json({ error: reassignError.message }, { status: 500 })
      }
    }

    const { error } = await admin
      .from('partner_categories')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('[partners/categories/[id] DELETE]', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[partners/categories/[id] DELETE]', err)
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}
