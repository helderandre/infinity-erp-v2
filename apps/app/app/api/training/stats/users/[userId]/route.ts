// @ts-nocheck
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/permissions'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const auth = await requirePermission('training')
    if (!auth.authorized) return auth.response

    const { userId } = await params
    if (!userId) {
      return NextResponse.json(
        { error: 'ID do utilizador é obrigatório' },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    // Get all enrollments for this user
    const { data: enrollments, error: enrollError } = await supabase
      .from('forma_training_enrollments')
      .select(`
        id,
        course_id,
        status,
        progress_percent,
        enrolled_at,
        completed_at,
        deadline,
        course:forma_training_courses(id, title, estimated_duration_minutes)
      `)
      .eq('user_id', userId)
      .order('enrolled_at', { ascending: false })

    if (enrollError) {
      return NextResponse.json({ error: enrollError.message }, { status: 500 })
    }

    // Count by status
    const statusCounts: Record<string, number> = {}
    for (const e of enrollments || []) {
      statusCounts[e.status] = (statusCounts[e.status] || 0) + 1
    }

    // Get certificates
    const { data: certificates, error: certError } = await supabase
      .from('forma_training_certificates')
      .select('id, course_id, issued_at, expires_at, is_external, external_title, external_provider, certificate_url')
      .eq('user_id', userId)
      .order('issued_at', { ascending: false })

    if (certError) {
      return NextResponse.json({ error: certError.message }, { status: 500 })
    }

    // Calculate total time spent from lesson progress
    const { data: progressData } = await supabase
      .from('forma_training_lesson_progress')
      .select('time_spent_seconds')
      .eq('user_id', userId)

    const total_time_spent_seconds = (progressData || []).reduce(
      (sum: number, p: any) => sum + (p.time_spent_seconds || 0),
      0
    )

    // Build courses with progress and overdue flag
    const now = new Date()
    const courses = (enrollments || []).map((e: any) => ({
      enrollment_id: e.id,
      course_id: e.course_id,
      course_title: e.course?.title ?? null,
      estimated_duration_minutes: e.course?.estimated_duration_minutes ?? null,
      status: e.status,
      progress_percent: e.progress_percent,
      enrolled_at: e.enrolled_at,
      completed_at: e.completed_at,
      deadline: e.deadline,
      is_overdue:
        e.deadline && e.status !== 'completed'
          ? new Date(e.deadline) < now
          : false,
    }))

    return NextResponse.json({
      data: {
        user_id: userId,
        total_enrollments: (enrollments || []).length,
        status_counts: statusCounts,
        total_completions: statusCounts['completed'] ?? 0,
        total_time_spent_seconds,
        total_time_spent_hours: Math.round((total_time_spent_seconds / 3600) * 100) / 100,
        certificates: certificates || [],
        courses,
      },
    })
  } catch (error) {
    console.error('Erro ao obter estatísticas do utilizador:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
