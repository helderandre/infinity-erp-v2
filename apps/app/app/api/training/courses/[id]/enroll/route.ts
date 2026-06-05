// @ts-nocheck
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/permissions'

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requirePermission('training')
    if (!auth.authorized) return auth.response

    const { id } = await params
    const supabase = await createClient()

    // Check if already enrolled
    const { data: existing } = await supabase
      .from('forma_training_enrollments')
      .select('id')
      .eq('course_id', id)
      .eq('user_id', auth.user.id)
      .maybeSingle()

    if (existing) {
      return NextResponse.json(
        { error: 'Já está inscrito neste curso' },
        { status: 409 }
      )
    }

    // Fetch course to check prerequisites
    const { data: course, error: courseError } = await supabase
      .from('forma_training_courses')
      .select('id, prerequisite_course_ids')
      .eq('id', id)
      .single()

    if (courseError || !course) {
      return NextResponse.json(
        { error: 'Curso não encontrado' },
        { status: 404 }
      )
    }

    // Check prerequisites
    const prerequisites = (course.prerequisite_course_ids as string[]) || []
    if (prerequisites.length > 0) {
      const { data: completedEnrollments } = await supabase
        .from('forma_training_enrollments')
        .select('course_id')
        .eq('user_id', auth.user.id)
        .eq('status', 'completed')
        .in('course_id', prerequisites)

      const completedIds = (completedEnrollments || []).map(
        (e: any) => e.course_id
      )
      const missing = prerequisites.filter(
        (pid: string) => !completedIds.includes(pid)
      )

      if (missing.length > 0) {
        return NextResponse.json(
          {
            error: 'Deve completar os cursos pré-requisitos antes de se inscrever',
            missing_prerequisites: missing,
          },
          { status: 400 }
        )
      }
    }

    // Create enrollment
    const { data, error } = await supabase
      .from('forma_training_enrollments')
      .insert({
        course_id: id,
        user_id: auth.user.id,
        status: 'enrolled',
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data, { status: 201 })
  } catch (error) {
    console.error('Erro ao inscrever no curso:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
