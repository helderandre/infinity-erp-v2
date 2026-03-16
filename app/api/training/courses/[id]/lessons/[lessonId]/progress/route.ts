// @ts-nocheck
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/permissions'
import { updateLessonProgressSchema } from '@/lib/validations/training'

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

    // Auto-complete if video watched >= 90%
    if (input.video_watch_percent && input.video_watch_percent >= 90) {
      input.status = 'completed'
    }

    // Find enrollment for this user + course
    const { data: enrollment, error: enrollError } = await supabase
      .from('temp_training_enrollments')
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

    // Set started_at on enrollment if not yet set
    if (!enrollment.started_at) {
      await supabase
        .from('temp_training_enrollments')
        .update({ started_at: new Date().toISOString(), status: 'in_progress' })
        .eq('id', enrollmentId)
    }

    // Upsert lesson progress
    const now = new Date().toISOString()
    const upsertData: Record<string, unknown> = {
      user_id: userId,
      lesson_id: lessonId,
      enrollment_id: enrollmentId,
      last_accessed_at: now,
      updated_at: now,
    }

    if (input.status) upsertData.status = input.status
    if (input.video_watched_seconds !== undefined) upsertData.video_watched_seconds = input.video_watched_seconds
    if (input.video_watch_percent !== undefined) upsertData.video_watch_percent = input.video_watch_percent
    if (input.time_spent_seconds !== undefined) upsertData.time_spent_seconds = input.time_spent_seconds

    if (input.status === 'in_progress') {
      upsertData.started_at = now
    }
    if (input.status === 'completed') {
      upsertData.completed_at = now
    }

    // Check if record exists
    const { data: existing } = await supabase
      .from('temp_training_lesson_progress')
      .select('id, status')
      .eq('user_id', userId)
      .eq('lesson_id', lessonId)
      .single()

    let progressRecord
    if (existing) {
      // Don't overwrite started_at or completed_at if already set
      if (existing.status === 'completed') {
        delete upsertData.status
        delete upsertData.completed_at
      }

      const { data, error } = await supabase
        .from('temp_training_lesson_progress')
        .update(upsertData)
        .eq('id', existing.id)
        .select()
        .single()

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }
      progressRecord = data
    } else {
      upsertData.status = upsertData.status || 'in_progress'
      upsertData.started_at = now

      const { data, error } = await supabase
        .from('temp_training_lesson_progress')
        .insert(upsertData)
        .select()
        .single()

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }
      progressRecord = data
    }

    // Recalculate enrollment progress
    // Get total lessons for this course (across all modules)
    const { data: modules } = await supabase
      .from('temp_training_modules')
      .select('id')
      .eq('course_id', courseId)

    const moduleIds = (modules || []).map((m: { id: string }) => m.id)

    let totalLessons = 0
    let completedLessons = 0

    if (moduleIds.length > 0) {
      const { count: totalCount } = await supabase
        .from('temp_training_lessons')
        .select('id', { count: 'exact', head: true })
        .in('module_id', moduleIds)
        .eq('is_active', true)

      totalLessons = totalCount || 0

      const { count: completedCount } = await supabase
        .from('temp_training_lesson_progress')
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
      .from('temp_training_quizzes')
      .select('id')
      .eq('course_id', courseId)
      .eq('is_active', true)

    let allQuizzesPassed = true
    if (quizzes && quizzes.length > 0) {
      for (const quiz of quizzes) {
        const { data: bestAttempt } = await supabase
          .from('temp_training_quiz_attempts')
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
      .from('temp_training_enrollments')
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
