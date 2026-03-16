// @ts-nocheck
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/permissions'
import { assignCourseSchema } from '@/lib/validations/training'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requirePermission('training')
    if (!auth.authorized) return auth.response

    const { id } = await params
    const supabase = await createClient()

    const body = await request.json()
    const validation = assignCourseSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: validation.error.flatten() },
        { status: 400 }
      )
    }

    const { user_ids, deadline } = validation.data

    // Check course exists
    const { data: course, error: courseError } = await supabase
      .from('temp_training_courses')
      .select('id, title')
      .eq('id', id)
      .single()

    if (courseError || !course) {
      return NextResponse.json(
        { error: 'Curso não encontrado' },
        { status: 404 }
      )
    }

    // Check which users are already enrolled
    const { data: existingEnrollments } = await supabase
      .from('temp_training_enrollments')
      .select('user_id')
      .eq('course_id', id)
      .in('user_id', user_ids)

    const alreadyEnrolled = new Set(
      (existingEnrollments || []).map((e: any) => e.user_id)
    )
    const newUserIds = user_ids.filter(
      (uid: string) => !alreadyEnrolled.has(uid)
    )

    if (newUserIds.length === 0) {
      return NextResponse.json(
        { error: 'Todos os utilizadores seleccionados já estão inscritos' },
        { status: 409 }
      )
    }

    // Create enrollments
    const enrollments = newUserIds.map((uid: string) => ({
      course_id: id,
      user_id: uid,
      status: 'enrolled' as const,
      assigned_by: auth.user.id,
      deadline: deadline || null,
    }))

    const { data: createdEnrollments, error: enrollError } = await supabase
      .from('temp_training_enrollments')
      .insert(enrollments)
      .select()

    if (enrollError) {
      return NextResponse.json({ error: enrollError.message }, { status: 500 })
    }

    // Create notifications for each assigned user
    const notifications = newUserIds.map((uid: string) => ({
      user_id: uid,
      type: 'course_assigned',
      title: 'Curso atribuído',
      message: `O curso "${course.title}" foi-lhe atribuído.`,
      metadata: { course_id: id, assigned_by: auth.user.id },
    }))

    await supabase
      .from('temp_training_notifications')
      .insert(notifications)

    return NextResponse.json(
      {
        data: createdEnrollments,
        assigned_count: newUserIds.length,
        already_enrolled_count: alreadyEnrolled.size,
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('Erro ao atribuir curso:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
