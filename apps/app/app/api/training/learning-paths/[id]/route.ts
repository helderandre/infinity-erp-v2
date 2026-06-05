// @ts-nocheck
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { requireAuth, requirePermission } from '@/lib/auth/permissions'
import { updateLearningPathSchema } from '@/lib/validations/training'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth()
    if (!auth.authorized) return auth.response

    const { id: pathId } = await params
    const userId = auth.user.id
    const supabase = await createClient()

    // Get learning path detail
    const { data: path, error: pathError } = await supabase
      .from('forma_training_learning_paths')
      .select('*')
      .eq('id', pathId)
      .single()

    if (pathError || !path) {
      return NextResponse.json(
        { error: 'Percurso de aprendizagem não encontrado' },
        { status: 404 }
      )
    }

    // Get courses in this path (ordered)
    const { data: pathCourses, error: coursesError } = await supabase
      .from('forma_training_learning_path_courses')
      .select(`
        *,
        course:forma_training_courses(
          id,
          title,
          slug,
          cover_image_url,
          difficulty_level,
          estimated_duration_minutes,
          has_certificate,
          category:forma_training_categories(name, color)
        )
      `)
      .eq('learning_path_id', pathId)
      .order('order_index', { ascending: true })

    if (coursesError) {
      return NextResponse.json({ error: coursesError.message }, { status: 500 })
    }

    // Get user's enrollments for the courses in this path
    const courseIds = (pathCourses || [])
      .map((pc: any) => pc.course_id)
      .filter(Boolean)

    let enrollmentMap: Record<string, any> = {}
    if (courseIds.length > 0) {
      const { data: enrollments } = await supabase
        .from('forma_training_enrollments')
        .select('course_id, status, progress_percent, completed_at')
        .eq('user_id', userId)
        .in('course_id', courseIds)

      if (enrollments) {
        for (const e of enrollments) {
          enrollmentMap[e.course_id] = e
        }
      }
    }

    // Get user's path enrollment
    const { data: pathEnrollment } = await supabase
      .from('forma_training_path_enrollments')
      .select('*')
      .eq('user_id', userId)
      .eq('learning_path_id', pathId)
      .single()

    // Merge enrollment data into courses
    const coursesWithProgress = (pathCourses || []).map((pc: any) => ({
      ...pc,
      enrollment: enrollmentMap[pc.course_id] || null,
    }))

    return NextResponse.json({
      data: {
        ...path,
        courses: coursesWithProgress,
        user_enrollment: pathEnrollment || null,
      },
    })
  } catch (error) {
    console.error('Erro ao carregar percurso de aprendizagem:', error)
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

    const { id: pathId } = await params
    const supabase = await createClient()

    const body = await request.json()
    const validation = updateLearningPathSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: validation.error.flatten() },
        { status: 400 }
      )
    }

    const { course_ids, ...updateData } = validation.data

    const { data, error } = await supabase
      .from('forma_training_learning_paths')
      .update({ ...updateData, updated_at: new Date().toISOString() })
      .eq('id', pathId)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!data) {
      return NextResponse.json(
        { error: 'Percurso de aprendizagem não encontrado' },
        { status: 404 }
      )
    }

    // Update course associations if provided
    if (course_ids !== undefined) {
      // Remove old associations
      await supabase
        .from('forma_training_learning_path_courses')
        .delete()
        .eq('learning_path_id', pathId)

      // Insert new ones
      if (course_ids && course_ids.length > 0) {
        const courseAssociations = course_ids.map((courseId: string, index: number) => ({
          learning_path_id: pathId,
          course_id: courseId,
          order_index: index,
          is_required: true,
        }))

        await supabase
          .from('forma_training_learning_path_courses')
          .insert(courseAssociations)
      }
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('Erro ao actualizar percurso de aprendizagem:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
