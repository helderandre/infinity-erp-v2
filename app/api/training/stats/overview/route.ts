// @ts-nocheck
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/permissions'

export async function GET() {
  try {
    const auth = await requirePermission('training')
    if (!auth.authorized) return auth.response

    const supabase = await createClient()

    // Total courses
    const { count: total_courses } = await supabase
      .from('temp_training_courses')
      .select('*', { count: 'exact', head: true })

    // Published courses
    const { count: total_published_courses } = await supabase
      .from('temp_training_courses')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'published')

    // Total enrollments
    const { count: total_enrollments } = await supabase
      .from('temp_training_enrollments')
      .select('*', { count: 'exact', head: true })

    // Total completions
    const { count: total_completions } = await supabase
      .from('temp_training_enrollments')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'completed')

    // Total certificates (internal only)
    const { count: total_certificates_issued } = await supabase
      .from('temp_training_certificates')
      .select('*', { count: 'exact', head: true })
      .eq('is_external', false)

    // Average completion rate
    const enrollments = total_enrollments ?? 0
    const completions = total_completions ?? 0
    const average_completion_rate =
      enrollments > 0
        ? Math.round((completions / enrollments) * 10000) / 100
        : 0

    // Top 5 courses by enrollment count
    const { data: enrollmentsByCoursRaw } = await supabase
      .from('temp_training_enrollments')
      .select('course_id')

    const courseCountMap: Record<string, number> = {}
    for (const e of enrollmentsByCoursRaw || []) {
      courseCountMap[e.course_id] = (courseCountMap[e.course_id] || 0) + 1
    }

    const topCourseIds = Object.entries(courseCountMap)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([id]) => id)

    let top_courses: { id: string; title: string; enrollment_count: number }[] = []
    if (topCourseIds.length > 0) {
      const { data: topCoursesData } = await supabase
        .from('temp_training_courses')
        .select('id, title')
        .in('id', topCourseIds)

      top_courses = topCourseIds
        .map((id) => {
          const course = (topCoursesData || []).find((c: any) => c.id === id)
          return course
            ? { id, title: course.title, enrollment_count: courseCountMap[id] }
            : null
        })
        .filter(Boolean) as typeof top_courses
    }

    // Recent 10 completions
    const { data: recentCompletionsRaw } = await supabase
      .from('temp_training_enrollments')
      .select('user_id, course_id, completed_at')
      .eq('status', 'completed')
      .not('completed_at', 'is', null)
      .order('completed_at', { ascending: false })
      .limit(10)

    let recent_completions: {
      user_id: string
      commercial_name: string | null
      course_id: string
      course_title: string | null
      completed_at: string
    }[] = []

    if (recentCompletionsRaw && recentCompletionsRaw.length > 0) {
      const userIds = [...new Set(recentCompletionsRaw.map((r: any) => r.user_id))]
      const courseIds = [...new Set(recentCompletionsRaw.map((r: any) => r.course_id))]

      const [{ data: users }, { data: courses }] = await Promise.all([
        supabase.from('dev_users').select('id, commercial_name').in('id', userIds),
        supabase.from('temp_training_courses').select('id, title').in('id', courseIds),
      ])

      const userMap = new Map((users || []).map((u: any) => [u.id, u.commercial_name]))
      const courseMap = new Map((courses || []).map((c: any) => [c.id, c.title]))

      recent_completions = recentCompletionsRaw.map((r: any) => ({
        user_id: r.user_id,
        commercial_name: userMap.get(r.user_id) ?? null,
        course_id: r.course_id,
        course_title: courseMap.get(r.course_id) ?? null,
        completed_at: r.completed_at,
      }))
    }

    return NextResponse.json({
      data: {
        total_courses: total_courses ?? 0,
        total_published_courses: total_published_courses ?? 0,
        total_enrollments: enrollments,
        total_completions: completions,
        average_completion_rate,
        total_certificates_issued: total_certificates_issued ?? 0,
        top_courses,
        recent_completions,
      },
    })
  } catch (error) {
    console.error('Erro ao obter estatísticas de formação:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
