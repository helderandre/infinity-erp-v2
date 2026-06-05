import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { processAiJob, AI_JOB_HANDLERS } from '@/lib/ai-jobs/process'

/**
 * Cron endpoint — runs every ~30s via Coolify Scheduled Task.
 *
 * Picks up to N pending `ai_jobs` rows, marks them `running` (with a lock to
 * avoid concurrent crons picking the same row), dispatches each to a
 * type-specific handler, and updates progress/result.
 *
 * Auth: GET /api/cron/process-ai-jobs?key=<CRON_SECRET>
 *
 * Coolify command:
 *   wget -qO- "https://app.infinitygroup.pt/api/cron/process-ai-jobs?key=$CRON_SECRET"
 */
export const maxDuration = 90 // Some jobs (planta_3d) take 30-60s.

const BATCH_SIZE = 3 // jobs por tick
const LOCK_TTL_MIN = 5 // se um job ficou >5min em locked sem terminar, libertar (worker crashed)

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const key = searchParams.get('key')
    const cronSecret = process.env.CRON_SECRET
    if (cronSecret && key !== cronSecret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const admin = createAdminClient() as any
    const lockToken = `worker-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const cutoff = new Date(Date.now() - LOCK_TTL_MIN * 60_000).toISOString()

    // Libertar locks antigos (worker que crashou).
    await admin
      .from('ai_jobs')
      .update({ status: 'pending', locked_at: null, locked_by: null })
      .eq('status', 'running')
      .lt('locked_at', cutoff)

    // Picar BATCH_SIZE pendentes (ordem FIFO). Compare-and-set não é
    // atómico em PostgREST sem RPC, mas a janela de race é pequena e o
    // worker é idempotente (verifica status antes de processar).
    const { data: pending, error: pickErr } = await admin
      .from('ai_jobs')
      .select('id, type, payload, user_id, property_id')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(BATCH_SIZE)

    if (pickErr) {
      console.error('[process-ai-jobs] pick error:', pickErr)
      return NextResponse.json({ error: 'Pick error' }, { status: 500 })
    }
    if (!pending || pending.length === 0) {
      return NextResponse.json({ ok: true, picked: 0 })
    }

    const ids = pending.map((j: any) => j.id)
    const { error: lockErr } = await admin
      .from('ai_jobs')
      .update({
        status: 'running',
        started_at: new Date().toISOString(),
        locked_at: new Date().toISOString(),
        locked_by: lockToken,
      })
      .in('id', ids)
      .eq('status', 'pending') // só pega os que ainda estão pending (anti-race)
    if (lockErr) {
      console.error('[process-ai-jobs] lock error:', lockErr)
      return NextResponse.json({ error: 'Lock error' }, { status: 500 })
    }

    // Processar em paralelo (cada handler é responsável por actualizar
    // progress_done e marcar status final).
    const results = await Promise.allSettled(
      pending.map((job: any) => processAiJob(job, admin)),
    )

    const succeeded = results.filter((r) => r.status === 'fulfilled').length
    const failed = results.length - succeeded

    return NextResponse.json({
      ok: true,
      picked: pending.length,
      succeeded,
      failed,
      handlers: Object.keys(AI_JOB_HANDLERS),
    })
  } catch (err) {
    console.error('[process-ai-jobs] erro:', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
