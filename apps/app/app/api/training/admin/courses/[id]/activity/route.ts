// @ts-nocheck
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requirePermission } from '@/lib/auth/permissions'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requirePermission('training')
    if (!auth.authorized) return auth.response

    const { id: courseId } = await params
    const supabase = createAdminClient()

    // 1. Course exists?
    const { data: course } = await supabase
      .from('forma_training_courses')
      .select('id, title')
      .eq('id', courseId)
      .maybeSingle()

    if (!course) {
      return NextResponse.json(
        { error: 'Formação não encontrada' },
        { status: 404 }
      )
    }

    // 2. Modules + lessons (build structure)
    const { data: modules } = await supabase
      .from('forma_training_modules')
      .select('id, title, order_index')
      .eq('course_id', courseId)
      .order('order_index', { ascending: true })

    const moduleIds = (modules || []).map((m: { id: string }) => m.id)

    const { data: lessons } = moduleIds.length
      ? await supabase
          .from('forma_training_lessons')
          .select('id, title, module_id, order_index, content_type')
          .in('module_id', moduleIds)
          .eq('is_active', true)
          .order('order_index', { ascending: true })
      : { data: [] as any[] }

    const lessonIds = (lessons || []).map((l: { id: string }) => l.id)

    // 3. Enrollments for this course — count + aggregates
    const { data: enrollments } = await supabase
      .from('forma_training_enrollments')
      .select('id, status, progress_percent, certificate_issued, started_at')
      .eq('course_id', courseId)

    const totalEnrolled = enrollments?.length ?? 0
    const inProgress = enrollments?.filter((e: any) => e.status === 'in_progress').length ?? 0
    const completed = enrollments?.filter((e: any) => e.status === 'completed').length ?? 0
    const certificatesIssued = enrollments?.filter((e: any) => e.certificate_issued).length ?? 0
    const avgProgressPercent = totalEnrolled > 0
      ? Math.round(enrollments!.reduce((s: number, e: any) => s + (e.progress_percent ?? 0), 0) / totalEnrolled)
      : 0

    const enrollmentIds = (enrollments || []).map((e: any) => e.id)

    // 4. Lesson-progress aggregates per lesson
    let lessonAggregates: Record<string, {
      total_viewed: number
      avg_watch_percent_sum: number
      avg_time_sum: number
      completed_count: number
      by_source: { auto_watch: number; manual: number; admin_override: number; quiz_pass: number; unknown: number }
      total_time_spent_sum: number
    }> = {}

    let totalTimeSpentSum = 0

    if (lessonIds.length > 0 && enrollmentIds.length > 0) {
      const { data: progressRows } = await supabase
        .from('forma_training_lesson_progress')
        .select('lesson_id, status, video_watch_percent, time_spent_seconds, completion_source')
        .in('lesson_id', lessonIds)
        .in('enrollment_id', enrollmentIds)

      for (const row of (progressRows || [])) {
        const agg = lessonAggregates[row.lesson_id] ??= {
          total_viewed: 0,
          avg_watch_percent_sum: 0,
          avg_time_sum: 0,
          completed_count: 0,
          by_source: { auto_watch: 0, manual: 0, admin_override: 0, quiz_pass: 0, unknown: 0 },
          total_time_spent_sum: 0,
        }
        agg.total_viewed += 1
        agg.avg_watch_percent_sum += row.video_watch_percent ?? 0
        agg.avg_time_sum += row.time_spent_seconds ?? 0
        agg.total_time_spent_sum += row.time_spent_seconds ?? 0
        totalTimeSpentSum += row.time_spent_seconds ?? 0
        if (row.status === 'completed') {
          agg.completed_count += 1
          const src = (row.completion_source as string | null)
          if (src === 'auto_watch' || src === 'manual' || src === 'admin_override' || src === 'quiz_pass') {
            agg.by_source[src] += 1
          } else {
            agg.by_source.unknown += 1
          }
        }
      }
    }

    // 5. Reports count per lesson
    let reportsByLesson: Record<string, number> = {}
    let openReportsCount = 0
    if (lessonIds.length > 0) {
      const { data: reports } = await supabase
        .from('forma_training_lesson_reports')
        .select('lesson_id, status')
        .in('lesson_id', lessonIds)
      for (const r of (reports || [])) {
        reportsByLesson[r.lesson_id] = (reportsByLesson[r.lesson_id] || 0) + 1
        if (r.status === 'open') openReportsCount += 1
      }
    }

    // 6. Build lessons array in order
    const moduleMap = new Map((modules || []).map((m: any) => [m.id, m]))
    const lessonsPayload = (lessons || []).map((l: any) => {
      const agg = lessonAggregates[l.id]
      const viewed = agg?.total_viewed ?? 0
      const avgWatchPercent = viewed > 0 ? Math.round(agg!.avg_watch_percent_sum / viewed) : 0
      const avgTime = viewed > 0 ? Math.round(agg!.avg_time_sum / viewed) : 0
      const mod = moduleMap.get(l.module_id) as any
      return {
        lesson_id: l.id,
        title: l.title,
        module_id: l.module_id,
        module_title: mod?.title ?? '',
        order_index: l.order_index,
        content_type: l.content_type,
        total_viewed: viewed,
        avg_watch_percent: avgWatchPercent,
        avg_time_spent_seconds: avgTime,
        completed_count: agg?.completed_count ?? 0,
        completion_by_source: agg?.by_source ?? { auto_watch: 0, manual: 0, admin_override: 0, quiz_pass: 0, unknown: 0 },
        reports_count: reportsByLesson[l.id] ?? 0,
      }
    })

    const avgTimeSpentSeconds = totalEnrolled > 0 ? Math.round(totalTimeSpentSum / totalEnrolled) : 0

    // 7. Quiz stats
    const { data: quizzes } = await supabase
      .from('forma_training_quizzes')
      .select('id, title, lesson_id, module_id, passing_score, course_id')
      .or(`course_id.eq.${courseId},module_id.in.(${moduleIds.length ? moduleIds.join(',') : '00000000-0000-0000-0000-000000000000'})`)
      .eq('is_active', true)

    const quizzesPayload: Array<Record<string, unknown>> = []
    for (const q of (quizzes || [])) {
      const { data: attempts } = await supabase
        .from('forma_training_quiz_attempts')
        .select('user_id, passed, score')
        .eq('quiz_id', q.id)

      const attemptsCount = attempts?.length ?? 0
      const unique = new Set((attempts || []).map((a: any) => a.user_id))
      const uniqueAttempters = unique.size
      const passed = attempts?.filter((a: any) => a.passed).length ?? 0
      const passRate = attemptsCount > 0 ? Math.round((passed / attemptsCount) * 100) : 0
      const avgScore = attemptsCount > 0
        ? Math.round(attempts!.reduce((s: number, a: any) => s + (a.score ?? 0), 0) / attemptsCount)
        : 0

      quizzesPayload.push({
        quiz_id: q.id,
        title: q.title,
        lesson_id: q.lesson_id ?? null,
        module_id: q.module_id ?? null,
        attempts_count: attemptsCount,
        unique_attempters: uniqueAttempters,
        pass_rate: passRate,
        avg_score: avgScore,
      })
    }

    const payload = {
      course: {
        id: course.id,
        title: course.title,
        total_modules: (modules || []).length,
        total_lessons: (lessons || []).length,
        total_quizzes: quizzesPayload.length,
      },
      summary: {
        total_enrolled: totalEnrolled,
        in_progress: inProgress,
        completed: completed,
        avg_progress_percent: avgProgressPercent,
        avg_time_spent_seconds: avgTimeSpentSeconds,
        certificates_issued: certificatesIssued,
        open_reports: openReportsCount,
      },
      lessons: lessonsPayload,
      quizzes: quizzesPayload,
    }

    return NextResponse.json(payload, {
      headers: { 'Cache-Control': 'private, max-age=60' },
    })
  } catch (error) {
    console.error('Erro activity endpoint:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
