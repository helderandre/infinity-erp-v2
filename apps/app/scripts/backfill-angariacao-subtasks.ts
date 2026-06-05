/**
 * scripts/backfill-angariacao-subtasks.ts
 *
 * Back-fill script para aplicar o registry hardcoded a todos os processos
 * de angariação **em curso** que foram criados antes da change
 * `add-hardcoded-process-subtasks`. Processos `current_status='completed'`
 * NÃO são tocados (decisão do stakeholder).
 *
 * Idempotente — usa `populate-angariacao` via `populateSubtasks()`
 * directamente (server-side), que delega no INSERT com
 * `proc_subtasks_dedup` unique index. Correr várias vezes é safe.
 *
 * ══════════════════════════════════════════════════════════════════
 * RUN-BOOK
 * ══════════════════════════════════════════════════════════════════
 *
 * 1. Garantir que `.env.local` tem SUPABASE_SERVICE_ROLE_KEY e
 *    NEXT_PUBLIC_SUPABASE_URL apontando para a instância correcta
 *    (normalmente produção, já que o local partilha o mesmo project).
 *
 * 2. Correr a partir da raiz do repo:
 *
 *      pnpm dlx tsx scripts/backfill-angariacao-subtasks.ts
 *
 *    (ou `npx tsx ...` se não usa pnpm)
 *
 * 3. O script imprime progress por processo e um summary no final. Pode
 *    abortar com Ctrl+C — os processos já actualizados não são revertidos
 *    e retomar é idempotente.
 *
 * 4. Para verificar o output:
 *
 *      SELECT count(*) FROM proc_subtasks
 *      WHERE subtask_key NOT LIKE 'legacy_%';
 *
 *    Esta contagem deve ser positiva e aproximadamente igual a
 *    `processos_em_curso × rules_angariacao × owners_médios`.
 *
 * 5. Se algum processo falhar, o erro é logado e o script continua. No
 *    fim, o summary lista `failed_process_ids` para investigação manual.
 *
 * ══════════════════════════════════════════════════════════════════
 * REQUISITOS
 * ══════════════════════════════════════════════════════════════════
 * - `tsx` instalado (já é dependência indirecta via Next.js build).
 * - Supabase client admin com SUPABASE_SERVICE_ROLE_KEY.
 * - Migration `20260501_proc_subtasks_hardcoded.sql` já aplicada.
 */

import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'
import { populateSubtasks } from '../lib/processes/subtasks/populate'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error(
    '[backfill] Variáveis de ambiente em falta: NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY'
  )
  process.exit(1)
}

const admin = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

interface ProcInstanceRow {
  id: string
  external_ref: string | null
  current_status: string | null
  process_type: string | null
}

async function main() {
  console.log('[backfill] A carregar processos de angariação em curso...')

  // Selecciona PROC-ANG em curso que já tenham template (i.e. aprovados).
  // Processos 'draft' ou 'pending_approval' não têm proc_tasks, logo o
  // populate seria no-op — podem ser ignorados com segurança.
  const { data, error } = await admin
    .from('proc_instances')
    .select('id, external_ref, current_status, process_type')
    .not('tpl_process_id', 'is', null)
    .neq('current_status', 'completed')
    .like('external_ref', 'PROC-ANG-%')
    .is('deleted_at', null)

  if (error) {
    console.error('[backfill] Erro a listar processos:', error.message)
    process.exit(1)
  }

  const processes = (data ?? []) as ProcInstanceRow[]
  console.log(`[backfill] ${processes.length} processos candidatos.`)

  let totalInserted = 0
  let totalSkipped = 0
  let totalFailed = 0
  const failedProcessIds: string[] = []

  for (const [index, proc] of processes.entries()) {
    const label = proc.external_ref || proc.id
    const prefix = `[${index + 1}/${processes.length}]`
    process.stdout.write(`${prefix} ${label}... `)

    try {
      const result = await populateSubtasks(admin, proc.id, 'angariacao')
      totalInserted += result.inserted
      totalSkipped += result.skipped
      totalFailed += result.failed

      if (result.failed > 0) failedProcessIds.push(proc.id)

      process.stdout.write(
        `inserted=${result.inserted} skipped=${result.skipped} failed=${result.failed}\n`
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
  console.log(`Processos candidatos:   ${processes.length}`)
  console.log(`Subtarefas inseridas:   ${totalInserted}`)
  console.log(`Subtarefas skipped:     ${totalSkipped}`)
  console.log(`Subtarefas falhadas:    ${totalFailed}`)
  console.log(`Processos com falhas:   ${failedProcessIds.length}`)
  if (failedProcessIds.length > 0) {
    console.log('\nProcessos a investigar:')
    for (const id of failedProcessIds) console.log(`  - ${id}`)
  }
  console.log('══════════════════════════════════════')
}

main().catch((err) => {
  console.error('[backfill] ERRO FATAL:', err)
  process.exit(1)
})
