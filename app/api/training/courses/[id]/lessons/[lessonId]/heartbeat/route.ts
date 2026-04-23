// @ts-nocheck
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/permissions'
import { heartbeatSchema } from '@/lib/validations/training'

const MAX_DELTA_SECONDS = 15
const DUPLICATE_WINDOW_MS = 3000
const WATCH_GATE_PERCENT = 90

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; lessonId: string }> }
) {
  try {
    const auth = await requireAuth()
    if (!auth.authorized) return auth.response

    const { id: courseId, lessonId } = await params
    const userId = auth.user.id
    const supabase = await createClient()

    const body = await request.json().catch(() => null)
    const parsed = heartbeatSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: parsed.error.flatten() },
        { status: 400 }
      )
    }
    const input = parsed.data
    const clampedDelta = Math.min(input.delta_seconds, MAX_DELTA_SECONDS)
    const clamped = clampedDelta < input.delta_seconds

    // Enrollment check — must exist and belong to caller
    const { data: enrollment } = await supabase
      .from('forma_training_enrollments')
      .select('id, status')
      .eq('user_id', userId)
      .eq('course_id', courseId)
      .maybeSingle()

    if (!enrollment) {
      return NextResponse.json(
        { error: 'Inscrição não encontrada para este curso' },
        { status: 404 }
      )
    }

    // Load existing progress row for duplicate window + MAX comparisons
    const { data: existing } = await supabase
      .from('forma_training_lesson_progress')
      .select('id, status, time_spent_seconds, video_watched_seconds, video_watch_percent, last_accessed_at')
      .eq('user_id', userId)
      .eq('lesson_id', lessonId)
      .maybeSingle()

    // Duplicate suppression: if last_accessed_at within 3s, skip silently (202)
    if (existing?.last_accessed_at) {
      const lastMs = new Date(existing.last_accessed_at).getTime()
      if (Date.now() - lastMs < DUPLICATE_WINDOW_MS) {
        return NextResponse.json(
          { skipped: true, reason: 'rate_limited' },
          { status: 202 }
        )
      }
    }

    const now = new Date().toISOString()
    const prevSpent = existing?.time_spent_seconds ?? 0
    const prevPercent = existing?.video_watch_percent ?? 0
    const prevWatched = existing?.video_watched_seconds ?? 0

    const nextSpent = prevSpent + clampedDelta
    const nextPercent = Math.max(prevPercent, input.percent)
    const nextWatched = Math.max(prevWatched, Math.floor(input.position_seconds))

    // Auto-complete transition?
    const shouldAutoComplete = nextPercent >= WATCH_GATE_PERCENT && existing?.status !== 'completed'

    const upsertData: Record<string, unknown> = {
      user_id: userId,
      lesson_id: lessonId,
      enrollment_id: enrollment.id,
      time_spent_seconds: nextSpent,
      video_watch_percent: nextPercent,
      video_watched_seconds: nextWatched,
      last_video_position_seconds: Math.floor(input.position_seconds),
      last_accessed_at: now,
      updated_at: now,
    }

    if (shouldAutoComplete) {
      upsertData.status = 'completed'
      upsertData.completed_at = now
      upsertData.completion_source = 'auto_watch'
    } else if (!existing) {
      upsertData.status = 'in_progress'
      upsertData.started_at = now
    }

    let progressRecord
    if (existing) {
      // Don't re-complete an already-completed row
      if (existing.status === 'completed') {
        delete upsertData.status
        delete upsertData.completed_at
        delete upsertData.completion_source
      }
      const { data, error } = await supabase
        .from('forma_training_lesson_progress')
        .update(upsertData)
        .eq('id', existing.id)
        .select('id, status, time_spent_seconds, video_watch_percent, last_video_position_seconds')
        .single()
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      progressRecord = data
    } else {
      const { data, error } = await supabase
        .from('forma_training_lesson_progress')
        .insert(upsertData)
        .select('id, status, time_spent_seconds, video_watch_percent, last_video_position_seconds')
        .single()
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      progressRecord = data
    }

    // If we just auto-completed, bump enrollment progress too
    if (shouldAutoComplete) {
      const { data: modules } = await supabase
        .from('forma_training_modules')
        .select('id')
        .eq('course_id', courseId)
      const moduleIds = (modules || []).map((m: { id: string }) => m.id)

      if (moduleIds.length > 0) {
        const { count: totalCount } = await supabase
          .from('forma_training_lessons')
          .select('id', { count: 'exact', head: true })
          .in('module_id', moduleIds)
          .eq('is_active', true)
        const { count: completedCount } = await supabase
          .from('forma_training_lesson_progress')
          .select('id', { count: 'exact', head: true })
          .eq('enrollment_id', enrollment.id)
          .eq('status', 'completed')
        const total = totalCount || 0
        const completed = completedCount || 0
        const progressPercent = total > 0 ? Math.round((completed / total) * 100) : 0
        await supabase
          .from('forma_training_enrollments')
          .update({ progress_percent: progressPercent, updated_at: now })
          .eq('id', enrollment.id)
      }
    }

    return NextResponse.json({
      time_spent_seconds: progressRecord.time_spent_seconds,
      video_watch_percent: progressRecord.video_watch_percent,
      last_video_position_seconds: progressRecord.last_video_position_seconds,
      status: progressRecord.status,
      applied_delta: clampedDelta,
      clamped,
    })
  } catch (error) {
    console.error('Erro heartbeat:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
