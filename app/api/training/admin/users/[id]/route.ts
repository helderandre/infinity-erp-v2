// @ts-nocheck
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requirePermission } from '@/lib/auth/permissions'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requirePermission('training')
    if (!auth.authorized) return auth.response

    const { id: userId } = await params
    const supabase = createAdminClient()

    // Enrollments do user
    const { data: enrollments } = await supabase
      .from('forma_training_enrollments')
      .select(`
        id,
        course_id,
        status,
        progress_percent,
        enrolled_at,
        completed_at,
        course:forma_training_courses!course_id(title)
      `)
      .eq('user_id', userId)
      .order('enrolled_at', { ascending: false })

    // Lesson progress do user
    const { data: lessonProgress } = await supabase
      .from('forma_training_lesson_progress')
      .select(`
        lesson_id,
        enrollment_id,
        status,
        completed_at,
        time_spent_seconds,
        lesson:forma_training_lessons!lesson_id(title)
      `)
      .eq('user_id', userId)

    // User info
    const { data: user } = await supabase
      .from('dev_users')
      .select('commercial_name, professional_email')
      .eq('id', userId)
      .single()

    // Merge lesson progress into enrollments
    const result = (enrollments || []).map((e: any) => ({
      enrollment_id: e.id,
      course_id: e.course_id,
      course_title: e.course?.title,
      status: e.status,
      progress_percent: e.progress_percent,
      enrolled_at: e.enrolled_at,
      completed_at: e.completed_at,
      lessons: (lessonProgress || [])
        .filter((lp: any) => lp.enrollment_id === e.id)
        .map((lp: any) => ({
          lesson_id: lp.lesson_id,
          title: lp.lesson?.title,
          status: lp.status,
          completed_at: lp.completed_at,
          time_spent_seconds: lp.time_spent_seconds,
        })),
    }))

    return NextResponse.json({ user, courses: result })
  } catch (error) {
    console.error('Erro ao carregar detalhe user:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
