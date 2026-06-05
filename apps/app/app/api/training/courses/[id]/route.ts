// @ts-nocheck
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/permissions'
import { updateCourseSchema } from '@/lib/validations/training'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requirePermission('training')
    if (!auth.authorized) return auth.response

    const { id } = await params
    const supabase = await createClient()

    // Fetch course with category + instructor
    const { data: course, error } = await supabase
      .from('forma_training_courses')
      .select(`
        *,
        category:forma_training_categories!forma_training_courses_category_id_fkey(id, name, slug, color),
        instructor:dev_users!forma_training_courses_instructor_id_fkey(id, commercial_name)
      `)
      .eq('id', id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Curso não encontrado' },
          { status: 404 }
        )
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Fetch modules
    const { data: modules } = await supabase
      .from('forma_training_modules')
      .select('*')
      .eq('course_id', id)
      .order('order_index', { ascending: true })

    // Fetch lessons for all modules
    const moduleIds = (modules || []).map((m: any) => m.id)
    let lessons: any[] = []
    if (moduleIds.length > 0) {
      const { data: lessonData } = await supabase
        .from('forma_training_lessons')
        .select('*')
        .in('module_id', moduleIds)
        .order('order_index', { ascending: true })
      lessons = lessonData || []
    }

    // Fetch material counts per lesson
    const lessonIds = lessons.map((l: any) => l.id)
    let materialCounts: Record<string, number> = {}
    if (lessonIds.length > 0) {
      const { data: materialData } = await supabase
        .from('forma_training_lesson_materials')
        .select('lesson_id')
        .in('lesson_id', lessonIds)
      if (materialData) {
        materialData.forEach((m: any) => {
          materialCounts[m.lesson_id] = (materialCounts[m.lesson_id] || 0) + 1
        })
      }
    }

    // Fetch current user's enrollment
    const { data: enrollment } = await supabase
      .from('forma_training_enrollments')
      .select('*')
      .eq('course_id', id)
      .eq('user_id', auth.user.id)
      .maybeSingle()

    // Fetch lesson progress if enrolled
    let progressMap: Record<string, any> = {}
    if (enrollment) {
      const { data: progressData } = await supabase
        .from('forma_training_lesson_progress')
        .select('*')
        .eq('enrollment_id', enrollment.id)
        .eq('user_id', auth.user.id)
      if (progressData) {
        progressData.forEach((p: any) => { progressMap[p.lesson_id] = p })
      }
    }

    // Assemble modules with nested lessons + progress
    const modulesWithLessons = (modules || []).map((mod: any) => {
      const modLessons = lessons
        .filter((l: any) => l.module_id === mod.id)
        .map((l: any) => ({
          ...l,
          progress: progressMap[l.id] || null,
          material_count: materialCounts[l.id] || 0,
        }))
      const completedCount = modLessons.filter((l: any) => l.progress?.status === 'completed').length
      return {
        ...mod,
        lessons: modLessons,
        lesson_count: modLessons.length,
        completed_lesson_count: completedCount,
      }
    })

    return NextResponse.json({
      ...course,
      modules: modulesWithLessons,
      enrollment: enrollment || null,
    })
  } catch (error) {
    console.error('Erro ao obter curso:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requirePermission('training')
    if (!auth.authorized) return auth.response

    const { id } = await params
    const supabase = await createClient()

    const body = await request.json()
    const validation = updateCourseSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: validation.error.flatten() },
        { status: 400 }
      )
    }

    const { data, error } = await supabase
      .from('forma_training_courses')
      .update({ ...validation.data, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!data) {
      return NextResponse.json(
        { error: 'Curso não encontrado' },
        { status: 404 }
      )
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('Erro ao actualizar curso:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requirePermission('training')
    if (!auth.authorized) return auth.response

    const { id } = await params
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('forma_training_courses')
      .update({ status: 'archived', updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!data) {
      return NextResponse.json(
        { error: 'Curso não encontrado' },
        { status: 404 }
      )
    }

    return NextResponse.json({ message: 'Curso arquivado com sucesso' })
  } catch (error) {
    console.error('Erro ao arquivar curso:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
