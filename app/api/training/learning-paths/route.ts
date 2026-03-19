// @ts-nocheck
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/permissions'
import { createLearningPathSchema } from '@/lib/validations/training'

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
    const statusFilter = searchParams.get('status')

    let query = supabase
      .from('forma_training_learning_paths')
      .select(`
        *,
        courses:forma_training_learning_path_courses(count)
      `)

    if (statusFilter) {
      query = query.eq('status', statusFilter)
    }

    query = query.order('created_at', { ascending: false })

    const { data, error } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const paths = (data || []).map((path: any) => ({
      ...path,
      course_count: path.courses?.[0]?.count ?? 0,
      courses: undefined,
    }))

    return NextResponse.json({ data: paths })
  } catch (error) {
    console.error('Erro ao listar percursos de aprendizagem:', error)
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
    const validation = createLearningPathSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: validation.error.flatten() },
        { status: 400 }
      )
    }

    const { course_ids, ...pathData } = validation.data
    const slug = generateSlug(pathData.title)

    // Create learning path
    const { data: path, error: pathError } = await supabase
      .from('forma_training_learning_paths')
      .insert({
        ...pathData,
        slug,
        created_by: auth.user.id,
      })
      .select()
      .single()

    if (pathError) {
      return NextResponse.json({ error: pathError.message }, { status: 500 })
    }

    // Insert course associations
    if (course_ids && course_ids.length > 0) {
      const courseAssociations = course_ids.map((courseId: string, index: number) => ({
        learning_path_id: path.id,
        course_id: courseId,
        order_index: index,
        is_required: true,
      }))

      const { error: assocError } = await supabase
        .from('forma_training_learning_path_courses')
        .insert(courseAssociations)

      if (assocError) {
        console.error('Erro ao associar cursos ao percurso:', assocError)
      }
    }

    return NextResponse.json(path, { status: 201 })
  } catch (error) {
    console.error('Erro ao criar percurso de aprendizagem:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
