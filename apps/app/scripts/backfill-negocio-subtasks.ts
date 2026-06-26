/**
 * scripts/backfill-negocio-subtasks.ts
 *
 * Back-fill do registry hardcoded de PROC-NEG (fecho de negócio) para os
 * processos de negócio **em curso** que tenham sido criados antes da change
 * `rebuild-fecho-process`. Espelha `backfill-angariacao-subtasks.ts`.
 *
 * Processos `current_status='completed'` NÃO são tocados. Idempotente — usa
 * `populateSubtasks(admin, id, 'negocio')`, que:
 *   1) apaga as subtarefas legacy seedadas pela RPC (`tpl_subtask_id != null`),
 *   2) insere as hardcoded via o índice `proc_subtasks_dedup`.
 * Correr várias vezes é seguro.
 *
 * ⚠️ Pré-requisito de matching: as 4 tasks de título duplicado têm de estar
 * renomeadas ("(CPCV)"/"(Escritura)") — feito pela migration
 * 20260623_neg_template_hardcoded_handoff.sql no template, e copiado para os
 * proc_tasks no momento da criação da instância. Para instâncias criadas
 * ANTES do rename, este script renomeia também os proc_tasks correspondentes
 * (ver `fixDuplicateTaskTitles`), senão as rules `ai_caption`/`pagamento` não
 * casariam.
 *
 * ══════════════════════════════════════════════════════════════════
 * RUN-BOOK
 * ══════════════════════════════════════════════════════════════════
 * 1. `.env.local` com SUPABASE_SERVICE_ROLE_KEY + NEXT_PUBLIC_SUPABASE_URL.
 * 2. A partir de apps/app:  npx tsx scripts/backfill-negocio-subtasks.ts
 * 3. Imprime progresso por processo + summary. Idempotente, retomável.
 * 4. Verificar:  SELECT count(*) FROM proc_subtasks ps
 *      JOIN proc_tasks pt ON pt.id=ps.proc_task_id
 *      JOIN proc_instances pi ON pi.id=pt.proc_instance_id
 *      WHERE (ps.config->>'process_type')='negocio';
 */

import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'
import { populateSubtasks } from '../lib/processes/subtasks/populate'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

const NEG_TEMPLATE_ID = 'ca943474-2514-4781-b91f-83e76a8b7831'

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error(
    '[backfill-neg] Variáveis em falta: NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY'
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
}

/**
 * Renomeia os proc_tasks de título duplicado de uma instância para os títulos
 * disambiguados que as rules esperam. No-op se já estiverem renomeados (ou se
 * a instância foi criada após o rename do template).
 */
async function fixDuplicateTaskTitles(procInstanceId: string): Promise<void> {
  const renames: Array<{ from: string; to: string; stageOrder: number }> = [
    { from: 'Foto e descrição IA do momento', to: 'Foto e descrição IA do momento (CPCV)', stageOrder: 2 },
    { from: 'Foto e descrição IA do momento', to: 'Foto e descrição IA do momento (Escritura)', stageOrder: 4 },
    { from: 'Pagamento aos consultores e parceiros', to: 'Pagamento aos consultores e parceiros (CPCV)', stageOrder: 2 },
    { from: 'Pagamento aos consultores e parceiros', to: 'Pagamento aos consultores e parceiros (Escritura)', stageOrder: 4 },
  ]
  for (const r of renames) {
    await admin
      .from('proc_tasks')
      .update({ title: r.to })
      .eq('proc_instance_id', procInstanceId)
      .eq('title', r.from)
      .eq('stage_order_index', r.stageOrder)
  }
}

async function main() {
  console.log('[backfill-neg] A carregar processos de negócio em curso...')

  const { data, error } = await admin
    .from('proc_instances')
    .select('id, external_ref, current_status, tpl_process_id, process_type')
    .neq('current_status', 'completed')
    .is('deleted_at', null)
    .or(`tpl_process_id.eq.${NEG_TEMPLATE_ID},process_type.eq.negocio`)

  if (error) {
    console.error('[backfill-neg] Erro a listar processos:', error.message)
    process.exit(1)
  }

  const processes = (data ?? []) as ProcInstanceRow[]
  console.log(`[backfill-neg] ${processes.length} processos candidatos.`)

  if (processes.length === 0) {
    console.log(
      '[backfill-neg] Nenhum processo de negócio em curso. ' +
        'Os processos de fecho são criados no submit do deal — submeta um deal ' +
        'para gerar uma instância e depois corra este script (ou o submit já popula).'
    )
    return
  }

  let totalInserted = 0
  let totalSkipped = 0
  let totalFailed = 0
  const failedProcessIds: string[] = []

  for (const [index, proc] of processes.entries()) {
    const label = proc.external_ref || proc.id
    const prefix = `[${index + 1}/${processes.length}]`
    process.stdout.write(`${prefix} ${label}... `)

    try {
      await fixDuplicateTaskTitles(proc.id)
      const result = await populateSubtasks(admin, proc.id, 'negocio')
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
  console.error('[backfill-neg] ERRO FATAL:', err)
  process.exit(1)
})
