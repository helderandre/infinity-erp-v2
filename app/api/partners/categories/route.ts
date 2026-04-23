import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { isPartnersStaff } from '@/lib/auth/partners-staff'
import { z } from 'zod'

const createCategorySchema = z.object({
  slug: z.string().min(1).max(64).regex(/^[a-z0-9_-]+$/, 'Slug inválido (use só letras minúsculas, números, - ou _).'),
  label: z.string().min(1).max(120),
  icon: z.string().min(1).max(64).default('Briefcase'),
  color: z.string().min(1).max(32).default('slate'),
  sort_order: z.number().int().optional(),
})

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
    }

    const admin = createAdminClient() as any
    const { data, error } = await admin
      .from('partner_categories')
      .select('*')
      .eq('is_active', true)
      .order('sort_order', { ascending: true })
      .order('label', { ascending: true })

    if (error) {
      console.error('[partners/categories GET]', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data: data || [] })
  } catch (err) {
    console.error('[partners/categories GET]', err)
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

    const isStaff = await isPartnersStaff(user.id)
    if (!isStaff) {
      return NextResponse.json({ error: 'Sem permissão.' }, { status: 403 })
    }

    const body = await request.json()
    const parsed = createCategorySchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Dados inválidos.', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const admin = createAdminClient() as any

    // Auto-assign sort_order as max+10 if not provided
    let sortOrder = parsed.data.sort_order
    if (sortOrder === undefined) {
      const { data: max } = await admin
        .from('partner_categories')
        .select('sort_order')
        .order('sort_order', { ascending: false })
        .limit(1)
        .single()
      sortOrder = ((max?.sort_order as number | undefined) ?? 0) + 10
    }

    const { data, error } = await admin
      .from('partner_categories')
      .insert({
        slug: parsed.data.slug,
        label: parsed.data.label,
        icon: parsed.data.icon,
        color: parsed.data.color,
        sort_order: sortOrder,
        is_system: false,
      })
      .select()
      .single()

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'Já existe uma categoria com este slug.' }, { status: 409 })
      }
      console.error('[partners/categories POST]', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data }, { status: 201 })
  } catch (err) {
    console.error('[partners/categories POST]', err)
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}
