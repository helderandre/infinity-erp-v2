// @ts-nocheck
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/permissions'
import { createCourseSchema } from '@/lib/validations/training'

function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

export async function GET(request: Request) {
  try {
    const auth = await requirePermission('training')
    if (!auth.authorized) return auth.response

    const supabase = await createClient()
    const { searchParams } = new URL(request.url)

    const category_id = searchParams.get('category_id')
    const difficulty = searchParams.get('difficulty')
    const status = searchParams.get('status') || 'published'
    const search = searchParams.get('search')
    const instructor_id = searchParams.get('instructor_id')
    const is_mandatory = searchParams.get('is_mandatory')
    const tag = searchParams.get('tag')
    const page = Math.max(1, Number(searchParams.get('page')) || 1)
    const limit = Math.min(Math.max(1, Number(searchParams.get('limit')) || 12), 50)
    const offset = (page - 1) * limit

    let query = supabase
      .from('forma_training_courses')
      .select(`
        *,
        category:forma_training_categories!forma_training_courses_category_id_fkey(id, name, slug, color),
        instructor:dev_users!forma_training_courses_instructor_id_fkey(id, commercial_name)
      `, { count: 'exact' })
      .eq('status', status)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (category_id) {
      const ids = category_id.split(',').filter(Boolean)
      query = ids.length === 1 ? query.eq('category_id', ids[0]) : query.in('category_id', ids)
    }
    if (difficulty) {
      const diffs = difficulty.split(',').filter(Boolean)
      query = diffs.length === 1 ? query.eq('difficulty_level', diffs[0]) : query.in('difficulty_level', diffs)
    }
    if (search) {
      query = query.ilike('title', `%${search}%`)
    }
    if (instructor_id) {
      query = query.eq('instructor_id', instructor_id)
    }
    if (is_mandatory === 'true') {
      query = query.eq('is_mandatory', true)
    } else if (is_mandatory === 'false') {
      query = query.eq('is_mandatory', false)
    }
    if (tag) {
      query = query.contains('tags', [tag])
    }

    const { data, error, count } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data: data || [], total: count || 0 })
  } catch (error) {
    console.error('Erro ao listar cursos:', error)
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
    const validation = createCourseSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: validation.error.flatten() },
        { status: 400 }
      )
    }

    const slug = generateSlug(validation.data.title)

    const { data, error } = await supabase
      .from('forma_training_courses')
      .insert({
        ...validation.data,
        slug,
        created_by: auth.user.id,
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data, { status: 201 })
  } catch (error) {
    console.error('Erro ao criar curso:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
