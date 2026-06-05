// @ts-nocheck
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/permissions'
import { createCategorySchema } from '@/lib/validations/training'

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

export async function GET() {
  try {
    const auth = await requirePermission('training')
    if (!auth.authorized) return auth.response

    const supabase = await createClient()

    const { data, error } = await supabase
      .from('forma_training_categories')
      .select(`
        *,
        courses:forma_training_courses(count)
      `)
      .eq('is_active', true)
      .eq('forma_training_courses.status', 'published')
      .order('order_index', { ascending: true })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const categories = (data || []).map((cat: any) => ({
      ...cat,
      course_count: cat.courses?.[0]?.count ?? 0,
      courses: undefined,
    }))

    return NextResponse.json({ data: categories })
  } catch (error) {
    console.error('Erro ao listar categorias:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requirePermission('training')
    if (!auth.authorized) return auth.response

    const supabase = await createClient()

    const body = await request.json()
    const validation = createCategorySchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: validation.error.flatten() },
        { status: 400 }
      )
    }

    const slug = generateSlug(validation.data.name)

    const { data, error } = await supabase
      .from('forma_training_categories')
      .insert({ ...validation.data, slug })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data, { status: 201 })
  } catch (error) {
    console.error('Erro ao criar categoria:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
