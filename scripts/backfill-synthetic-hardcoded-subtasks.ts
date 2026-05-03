/**
 * scripts/backfill-synthetic-hardcoded-subtasks.ts
 *
 * One-shot: finds the synthetic angariações created by the 2026-06-03
 * backfill (`is_synthetic=true` + `process_type='angariacao'`), runs the
 * hardcoded subtask registry (`populateSubtasks`) against each, and marks
 * the freshly-inserted subtasks as completed so the synthetic rows look
 * fully closed-out (matching what `autoActivateProcess({markCompleted:true})`
 * does for new direct-create properties).
 *
 * Why a separate script instead of reusing `backfill-angariacao-subtasks.ts`:
 *   - That script intentionally skips `current_status='completed'` rows
 *     (decisão do stakeholder na altura — não tocar em processos fechados).
 *   - Synthetics ARE all completed; we want to populate them anyway and
 *     immediately mark the new rows complete.
 *
 * Idempotent: `populateSubtasks` is guarded by the unique index
 * `proc_subtasks_dedup`, so re-running picks up only what's missing. The
 * UPDATE marking subtasks completed is also no-op on already-completed rows.
 *
 * Critically: NO row is unflagged from `is_synthetic=true`, so
 * "tempo médio de processo" analytics that filter `is_synthetic=false`
 * remain unaffected.
 *
 * RUN-BOOK
 *   pnpm dlx tsx scripts/backfill-synthetic-hardcoded-subtasks.ts
 *   (or `npx tsx ...`)
 */

import { config as loadEnv } from 'dotenv'
import { createClient } from '@supabase/supabase-js'
import { populateSubtasks } from '../lib/processes/subtasks/populate'

// Load .env.local first (Next.js convention), fall back to .env.
loadEnv({ path: '.env.local' })
loadEnv()

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error(
    '[backfill-synthetic] Variáveis em falta: NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY',
  )
  process.exit(1)
}

const admin = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

interface ProcInstanceRow {
  id: string
  external_ref: string | null
}

async function main() {
  console.log('[backfill-synthetic] A carregar processos sintéticos de angariação...')

  const { data, error } = await admin
    .from('proc_instances')
    .select('id, external_ref')
    .eq('is_synthetic', true)
    .eq('process_type', 'angariacao')
    .not('tpl_process_id', 'is', null)
    .is('deleted_at', null)
    .order('external_ref')

  if (error) {
    console.error('[backfill-synthetic] Erro a listar:', error.message)
    process.exit(1)
  }

  const processes = (data ?? []) as ProcInstanceRow[]
  console.log(`[backfill-synthetic] ${processes.length} sintéticos encontrados.`)

  let totalInserted = 0
  let totalSkipped = 0
  let totalFailed = 0
  let totalMarked = 0
  const failedProcessIds: string[] = []

  const nowIso = new Date().toISOString()

  for (const [index, proc] of processes.entries()) {
    const label = proc.external_ref || proc.id
    const prefix = `[${index + 1}/${processes.length}]`
    process.stdout.write(`${prefix} ${label}... `)

    try {
      // 1. Populate hardcoded subtasks (idempotent, dedup by unique index).
      const result = await populateSubtasks(admin, proc.id, 'angariacao')
      totalInserted += result.inserted
      totalSkipped += result.skipped
      totalFailed += result.failed
      if (result.failed > 0) failedProcessIds.push(proc.id)

      // 2. Mark every subtask under this instance completed (no-op on
      //    already-completed rows).
      const { data: tasksRows, error: taskErr } = await admin
        .from('proc_tasks')
        .select('id')
        .eq('proc_instance_id', proc.id)

      if (taskErr) throw new Error(`fetch tasks: ${taskErr.message}`)

      const taskIds = (tasksRows ?? []).map((t) => t.id)
      if (taskIds.length > 0) {
        const { error: updErr, count } = await admin
          .from('proc_subtasks')
          .update(
            { is_completed: true, completed_at: nowIso },
            { count: 'exact' },
          )
          .in('proc_task_id', taskIds)
          .eq('is_completed', false)

        if (updErr) throw new Error(`mark subtasks: ${updErr.message}`)
        totalMarked += count ?? 0
      }

      // Also re-mark any tasks back to completed in case populate touched
      // their status (defensive — populate shouldn't, but cheap to ensure).
      await admin
        .from('proc_tasks')
        .update({ status: 'completed', completed_at: nowIso })
        .eq('proc_instance_id', proc.id)
        .neq('status', 'completed')

      // Force final invariant on the instance.
      await admin
        .from('proc_instances')
        .update({
          percent_complete: 100,
          current_status: 'completed',
          completed_at: nowIso,
        })
        .eq('id', proc.id)

      process.stdout.write(
        `inserted=${result.inserted} skipped=${result.skipped} failed=${result.failed}\n`,
      )
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      process.stdout.write(`ERRO: ${msg}\n`)
      failedProcessIds.push(proc.id)
    }
  }

  console.log('\n══════════════════════════════════════')
  console.log('SUMMARY')
  console.log('══════════════════════════════════════')
  console.log(`Sintéticos processados:  ${processes.length}`)
  console.log(`Subtarefas inseridas:    ${totalInserted}`)
  console.log(`Subtarefas skipped:      ${totalSkipped}`)
  console.log(`Subtarefas falhadas:     ${totalFailed}`)
  console.log(`Subtarefas marcadas:     ${totalMarked}`)
  console.log(`Processos com falhas:    ${failedProcessIds.length}`)
  if (failedProcessIds.length > 0) {
    console.log('\nProcessos a investigar:')
    for (const id of failedProcessIds) console.log(`  - ${id}`)
  }
  console.log('══════════════════════════════════════')
}

main().catch((err) => {
  console.error('[backfill-synthetic] ERRO FATAL:', err)
  process.exit(1)
})
