// @ts-nocheck
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/permissions'
import { updateLessonProgressSchema } from '@/lib/validations/training'

const WATCH_GATE_PERCENT = 90

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string; lessonId: string }> }
) {
  try {
    const auth = await requireAuth()
    if (!auth.authorized) return auth.response

    const { id: courseId, lessonId } = await params
    const userId = auth.user.id
    const supabase = await createClient()

    const body = await request.json()
    const validation = updateLessonProgressSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: validation.error.flatten() },
        { status: 400 }
      )
    }

    const input = validation.data
    const hasTrainingPermission = Boolean(auth.permissions?.training)

    // Load lesson metadata — needed for content_type (determines gate behaviour)
    const { data: lesson, error: lessonError } = await supabase
      .from('forma_training_lessons')
      .select('id, content_type')
      .eq('id', lessonId)
      .single()

    if (lessonError || !lesson) {
      return NextResponse.json({ error: 'Lição não encontrada' }, { status: 404 })
    }

    // Find enrollment for this user + course
    const { data: enrollment, error: enrollError } = await supabase
      .from('forma_training_enrollments')
      .select('id, started_at, status')
      .eq('user_id', userId)
      .eq('course_id', courseId)
      .single()

    if (enrollError || !enrollment) {
      return NextResponse.json(
        { error: 'Inscrição não encontrada para este curso' },
        { status: 404 }
      )
    }

    const enrollmentId = enrollment.id
    const now = new Date().toISOString()

    // Load existing lesson_progress row (needed for gate decision + completion_source)
    const { data: existing } = await supabase
      .from('forma_training_lesson_progress')
      .select('id, status, video_watch_percent, completion_source')
      .eq('user_id', userId)
      .eq('lesson_id', lessonId)
      .maybeSingle()

    // ─── Determine incoming percent: prefer body, fall back to stored ──
    const incomingPercent =
      typeof input.video_watch_percent === 'number'
        ? input.video_watch_percent
        : existing?.video_watch_percent ?? 0

    // ─── Decide final status + completion_source ─────────────────────
    let finalStatus: 'in_progress' | 'completed' | undefined = input.status
    let completionSource: 'auto_watch' | 'manual' | 'admin_override' | 'quiz_pass' | null = null
    let isAdminOverride = false

    // Auto-complete when percent ≥ threshold (video only)
    const isVideo = lesson.content_type === 'video'
    const isQuiz = lesson.content_type === 'quiz'

    if (finalStatus === 'completed') {
      if (isVideo) {
        // Gate applies to video lessons only
        if (incomingPercent < WATCH_GATE_PERCENT) {
          if (!hasTrainingPermission) {
            return NextResponse.json(
              {
                error: `Assista a pelo menos ${WATCH_GATE_PERCENT}% do vídeo para concluir`,
                current_percent: incomingPercent,
                required_percent: WATCH_GATE_PERCENT,
              },
              { status: 403 }
            )
          }
          // Broker override path
          completionSource = 'admin_override'
          isAdminOverride = true
        } else {
          completionSource = 'manual'
        }
      } else if (isQuiz) {
        // Quiz lesson reaching "completed" means it was passed
        completionSource = 'quiz_pass'
      } else {
        // pdf, text, external_link — manual click
        completionSource = 'manual'
      }
    } else if (
      isVideo
      && typeof input.video_watch_percent === 'number'
      && input.video_watch_percent >= WATCH_GATE_PERCENT
      && existing?.status !== 'completed'
    ) {
      // Auto-complete from progress ping (no explicit status in body)
      finalStatus = 'completed'
      completionSource = 'auto_watch'
    }

    // Set started_at on enrollment if not yet set
    if (!enrollment.started_at) {
      await supabase
        .from('forma_training_enrollments')
        .update({ started_at: now, status: 'in_progress' })
        .eq('id', enrollmentId)
    }

    // ─── Build upsert payload ────────────────────────────────────────
    const upsertData: Record<string, unknown> = {
      user_id: userId,
      lesson_id: lessonId,
      enrollment_id: enrollmentId,
      last_accessed_at: now,
      updated_at: now,
    }

    if (finalStatus) upsertData.status = finalStatus
    if (input.video_watched_seconds !== undefined) upsertData.video_watched_seconds = input.video_watched_seconds
    if (input.video_watch_percent !== undefined) upsertData.video_watch_percent = input.video_watch_percent
    if (input.time_spent_seconds !== undefined) upsertData.time_spent_seconds = input.time_spent_seconds

    if (finalStatus === 'in_progress' && !existing) {
      upsertData.started_at = now
    }
    if (finalStatus === 'completed') {
      upsertData.completed_at = now
      if (completionSource) upsertData.completion_source = completionSource
    }

    let progressRecord
    if (existing) {
      // Don't overwrite started_at or completed_at if already set
      if (existing.status === 'completed') {
        delete upsertData.status
        delete upsertData.completed_at
        // Preserve existing completion_source if any
        delete upsertData.completion_source
      }

      const { data, error } = await supabase
        .from('forma_training_lesson_progress')
        .update(upsertData)
        .eq('id', existing.id)
        .select()
        .single()

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }
      progressRecord = data
    } else {
      if (!upsertData.status) upsertData.status = 'in_progress'
      upsertData.started_at = now

      const { data, error } = await supabase
        .from('forma_training_lesson_progress')
        .insert(upsertData)
        .select()
        .single()

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }
      progressRecord = data
    }

    // ─── Admin override audit log ────────────────────────────────────
    if (isAdminOverride && progressRecord) {
      try {
        const admin = createAdminClient()
        await admin.from('log_audit').insert({
          user_id: userId,
          entity_type: 'training_completion_override',
          entity_id: progressRecord.id,
          action: 'force_complete',
          new_data: {
            course_id: courseId,
            lesson_id: lessonId,
            target_user_id: progressRecord.user_id,
            forced_percent: incomingPercent,
            by_user_id: userId,
          },
        })
      } catch (err) {
        console.error('Falha ao registar audit log do override:', err)
      }
    }

    // ─── Recalculate enrollment progress ─────────────────────────────
    const { data: modules } = await supabase
      .from('forma_training_modules')
      .select('id')
      .eq('course_id', courseId)

    const moduleIds = (modules || []).map((m: { id: string }) => m.id)

    let totalLessons = 0
    let completedLessons = 0

    if (moduleIds.length > 0) {
      const { count: totalCount } = await supabase
        .from('forma_training_lessons')
        .select('id', { count: 'exact', head: true })
        .in('module_id', moduleIds)
        .eq('is_active', true)

      totalLessons = totalCount || 0

      const { count: completedCount } = await supabase
        .from('forma_training_lesson_progress')
        .select('id', { count: 'exact', head: true })
        .eq('enrollment_id', enrollmentId)
        .eq('status', 'completed')

      completedLessons = completedCount || 0
    }

    const progressPercent = totalLessons > 0
      ? Math.round((completedLessons / totalLessons) * 100)
      : 0

    // Check if all quizzes passed
    const { data: quizzes } = await supabase
      .from('forma_training_quizzes')
      .select('id')
      .eq('course_id', courseId)
      .eq('is_active', true)

    let allQuizzesPassed = true
    if (quizzes && quizzes.length > 0) {
      for (const quiz of quizzes) {
        const { data: bestAttempt } = await supabase
          .from('forma_training_quiz_attempts')
          .select('passed')
          .eq('quiz_id', quiz.id)
          .eq('user_id', userId)
          .eq('passed', true)
          .limit(1)

        if (!bestAttempt || bestAttempt.length === 0) {
          allQuizzesPassed = false
          break
        }
      }
    }

    const allLessonsCompleted = totalLessons > 0 && completedLessons >= totalLessons
    const enrollmentUpdate: Record<string, unknown> = {
      progress_percent: progressPercent,
      updated_at: now,
    }

    if (allLessonsCompleted && allQuizzesPassed) {
      enrollmentUpdate.status = 'completed'
      enrollmentUpdate.completed_at = now
    } else if (enrollment.status !== 'in_progress') {
      enrollmentUpdate.status = 'in_progress'
    }

    await supabase
      .from('forma_training_enrollments')
      .update(enrollmentUpdate)
      .eq('id', enrollmentId)

    return NextResponse.json({
      data: progressRecord,
      enrollment: {
        progress_percent: progressPercent,
        all_lessons_completed: allLessonsCompleted,
        all_quizzes_passed: allQuizzesPassed,
      },
    })
  } catch (error) {
    console.error('Erro ao actualizar progresso da lição:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
