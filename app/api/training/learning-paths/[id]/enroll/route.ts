// @ts-nocheck
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/permissions'

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth()
    if (!auth.authorized) return auth.response

    const { id: pathId } = await params
    const userId = auth.user.id
    const supabase = await createClient()

    // Verify learning path exists
    const { data: path, error: pathError } = await supabase
      .from('temp_training_learning_paths')
      .select('id, title, status')
      .eq('id', pathId)
      .single()

    if (pathError || !path) {
      return NextResponse.json(
        { error: 'Percurso de aprendizagem não encontrado' },
        { status: 404 }
      )
    }

    if (path.status !== 'published') {
      return NextResponse.json(
        { error: 'Este percurso de aprendizagem não está disponível' },
        { status: 400 }
      )
    }

    // Check if already enrolled
    const { data: existingEnrollment } = await supabase
      .from('temp_training_path_enrollments')
      .select('id')
      .eq('user_id', userId)
      .eq('learning_path_id', pathId)
      .single()

    if (existingEnrollment) {
      return NextResponse.json(
        { error: 'Já está inscrito neste percurso de aprendizagem' },
        { status: 400 }
      )
    }

    // Create path enrollment
    const { data: pathEnrollment, error: enrollError } = await supabase
      .from('temp_training_path_enrollments')
      .insert({
        user_id: userId,
        learning_path_id: pathId,
      })
      .select()
      .single()

    if (enrollError) {
      return NextResponse.json({ error: enrollError.message }, { status: 500 })
    }

    // Get all courses in this path
    const { data: pathCourses } = await supabase
      .from('temp_training_learning_path_courses')
      .select('course_id, is_required')
      .eq('learning_path_id', pathId)
      .order('order_index', { ascending: true })

    // Auto-enroll in all required courses
    const courseEnrollments: Array<{
      user_id: string
      course_id: string
    }> = []

    if (pathCourses && pathCourses.length > 0) {
      // Get existing enrollments
      const courseIds = pathCourses.map((pc) => pc.course_id)
      const { data: existingCourseEnrollments } = await supabase
        .from('temp_training_enrollments')
        .select('course_id')
        .eq('user_id', userId)
        .in('course_id', courseIds)

      const alreadyEnrolledCourseIds = new Set(
        (existingCourseEnrollments || []).map((e) => e.course_id)
      )

      for (const pc of pathCourses) {
        if (pc.is_required && !alreadyEnrolledCourseIds.has(pc.course_id)) {
          courseEnrollments.push({
            user_id: userId,
            course_id: pc.course_id,
          })
        }
      }

      if (courseEnrollments.length > 0) {
        const { error: courseEnrollError } = await supabase
          .from('temp_training_enrollments')
          .insert(courseEnrollments)

        if (courseEnrollError) {
          console.error('Erro ao inscrever nos cursos do percurso:', courseEnrollError)
        }
      }
    }

    return NextResponse.json(
      {
        data: pathEnrollment,
        courses_enrolled: courseEnrollments.length,
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('Erro ao inscrever no percurso de aprendizagem:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
