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

    const { id: courseId } = await params
    const supabase = createAdminClient()

    const { searchParams } = new URL(request.url)
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const limitRaw = parseInt(searchParams.get('limit') || '20')
    const limit = Math.min(Math.max(1, limitRaw), 100)
    const statusFilter = searchParams.get('status') || ''
    const search = searchParams.get('search') || ''

    // ─── Course existence ─────────────────────────────────
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

    // ─── Course structure (lessons + modules) ─────────────
    const { data: modules } = await supabase
      .from('forma_training_modules')
      .select('id, title, order_index')
      .eq('course_id', courseId)
      .order('order_index', { ascending: true })
    const moduleIds = (modules || []).map((m: any) => m.id)
    const moduleMap = new Map((modules || []).map((m: any) => [m.id, m]))

    const { data: lessons } = moduleIds.length
      ? await supabase
          .from('forma_training_lessons')
          .select('id, title, module_id, order_index, content_type')
          .in('module_id', moduleIds)
          .eq('is_active', true)
          .order('order_index', { ascending: true })
      : { data: [] as any[] }
    const lessonsList = (lessons || []) as any[]

    // Quizzes for this course
    const { data: quizzes } = await supabase
      .from('forma_training_quizzes')
      .select('id, title, course_id, module_id')
      .or(`course_id.eq.${courseId},module_id.in.(${moduleIds.length ? moduleIds.join(',') : '00000000-0000-0000-0000-000000000000'})`)
      .eq('is_active', true)
    const quizIds = (quizzes || []).map((q: any) => q.id)
    const quizMap = new Map((quizzes || []).map((q: any) => [q.id, q]))

    // ─── Enrollments: filter by course + optional status ──
    let baseQuery = supabase
      .from('forma_training_enrollments')
      .select(`
        id, user_id, status, progress_percent, enrolled_at, completed_at, updated_at,
        user:dev_users!user_id(id, commercial_name, professional_email)
      `, { count: 'exact' })
      .eq('course_id', courseId)

    if (statusFilter === 'not_started') {
      baseQuery = baseQuery.is('started_at', null)
    } else if (statusFilter === 'in_progress' || statusFilter === 'completed') {
      baseQuery = baseQuery.eq('status', statusFilter)
    }

    const from = (page - 1) * limit
    const to = from + limit - 1

    // Server-side ILIKE on joined commercial_name — use RPC-less approach via two queries if needed.
    // Simpler: fetch page-sized rows sorted by updated_at desc and filter in memory if `search` set.
    const { data: enrollRows, error: enrollError, count: enrollCount } = await baseQuery
      .order('updated_at', { ascending: false, nullsFirst: false })
      .range(from, to)

    if (enrollError) {
      return NextResponse.json({ error: enrollError.message }, { status: 500 })
    }

    let filteredRows = enrollRows || []
    if (search) {
      const q = search.toLowerCase()
      filteredRows = filteredRows.filter((r: any) =>
        (r.user?.commercial_name || '').toLowerCase().includes(q)
      )
    }

    const enrollmentIds = filteredRows.map((r: any) => r.id)

    // ─── Lesson progress for these enrollments ────────────
    let progressByEnrollmentLesson: Record<string, any> = {}
    let timeByEnrollment: Record<string, number> = {}
    let completedByEnrollment: Record<string, number> = {}

    if (enrollmentIds.length > 0 && lessonsList.length > 0) {
      const lessonIdSet = new Set(lessonsList.map((l) => l.id))
      const { data: progressRows } = await supabase
        .from('forma_training_lesson_progress')
        .select(`
          id, enrollment_id, lesson_id, status, completion_source,
          time_spent_seconds, video_watch_percent,
          last_video_position_seconds, completed_at, last_accessed_at
        `)
        .in('enrollment_id', enrollmentIds)

      for (const row of (progressRows || [])) {
        if (!lessonIdSet.has(row.lesson_id)) continue
        progressByEnrollmentLesson[`${row.enrollment_id}::${row.lesson_id}`] = row
        timeByEnrollment[row.enrollment_id] = (timeByEnrollment[row.enrollment_id] ?? 0) + (row.time_spent_seconds ?? 0)
        if (row.status === 'completed') {
          completedByEnrollment[row.enrollment_id] = (completedByEnrollment[row.enrollment_id] ?? 0) + 1
        }
      }
    }

    // ─── Quiz attempts per enrollment ─────────────────────
    let attemptsByEnrollment: Record<string, any[]> = {}
    if (enrollmentIds.length > 0 && quizIds.length > 0) {
      const { data: attempts } = await supabase
        .from('forma_training_quiz_attempts')
        .select('id, enrollment_id, quiz_id, score, passed, attempt_number, completed_at')
        .in('enrollment_id', enrollmentIds)
        .in('quiz_id', quizIds)
        .order('attempt_number', { ascending: false })

      for (const a of (attempts || [])) {
        (attemptsByEnrollment[a.enrollment_id] ??= []).push(a)
      }
    }

    // ─── Build response rows ──────────────────────────────
    const data = filteredRows.map((r: any) => {
      const lessonsDetail = lessonsList.map((l: any) => {
        const p = progressByEnrollmentLesson[`${r.id}::${l.id}`]
        return {
          lesson_id: l.id,
          title: l.title,
          module_id: l.module_id,
          module_title: (moduleMap.get(l.module_id) as any)?.title ?? '',
          order_index: l.order_index,
          content_type: l.content_type,
          status: p?.status ?? 'not_started',
          completion_source: p?.completion_source ?? null,
          time_spent_seconds: p?.time_spent_seconds ?? 0,
          video_watch_percent: p?.video_watch_percent ?? 0,
          last_video_position_seconds: p?.last_video_position_seconds ?? 0,
          completed_at: p?.completed_at ?? null,
          last_accessed_at: p?.last_accessed_at ?? null,
        }
      })

      const quizDetail = (attemptsByEnrollment[r.id] || []).map((a: any) => ({
        quiz_id: a.quiz_id,
        quiz_title: (quizMap.get(a.quiz_id) as any)?.title ?? '',
        attempt_id: a.id,
        score: a.score,
        passed: a.passed,
        attempt_number: a.attempt_number,
        completed_at: a.completed_at,
      }))

      return {
        id: r.id,
        user_id: r.user_id,
        user_name: r.user?.commercial_name ?? null,
        user_email: r.user?.professional_email ?? null,
        profile_photo_url: null,
        enrolled_at: r.enrolled_at,
        status: r.status,
        progress_percent: r.progress_percent,
        completed_at: r.completed_at,
        last_activity_at: r.updated_at,
        total_time_spent_seconds: timeByEnrollment[r.id] ?? 0,
        lessons_total: lessonsList.length,
        lessons_completed: completedByEnrollment[r.id] ?? 0,
        lessons: lessonsDetail,
        quiz_attempts: quizDetail,
      }
    })

    const total = search ? data.length : (enrollCount ?? 0)
    const totalPages = limit > 0 ? Math.max(1, Math.ceil(total / limit)) : 1

    return NextResponse.json({
      data,
      total,
      page,
      limit,
      total_pages: totalPages,
    })
  } catch (error) {
    console.error('Erro enrollments endpoint:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
