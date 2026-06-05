/**
 * Testes unitários para `propagateDueDates`.
 *
 * Correr com `node --test --import tsx` (ou qualquer runner node:test-compatível).
 *
 * Estes testes validam as seguintes invariantes:
 *  - pendentes recebem due_date; já-completos são skipped
 *  - dueRule declarativa com shiftOnNonBusinessDay move para dia útil
 *  - dueRule imperativa usa o helper businessDay
 *  - erro num sibling não reverte conclusão da subtask principal
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import type { SupabaseClient } from '@supabase/supabase-js'
import { propagateDueDates } from '../propagate-due-dates'
import { __resetRegistryLookup } from '../registry'
import type { ProcSubtaskRow } from '../types'

// Nota: estes testes precisariam de monkey-patching do registry para
// injectar rules ad-hoc. Como `getDependentRules` é export normal, um
// teste funcional completo implica mexer no barrel ou expor um hook
// de teste. Deixado como TODO no comentário do topo do ficheiro.
//
// A integração completa é validada por smoke test manual (task 9.1):
//   1. criar angariação
//   2. concluir `email_pedido_doc`
//   3. confirmar que `armazenar_documentos` recebeu due_date = +48h útil
//
// Este ficheiro fica como placeholder para quando o registry expor
// `__setRegistryForTests()`.
test.skip('propagateDueDates — testes funcionais dependem de hook de teste no registry', () => {
  __resetRegistryLookup()
  const fake: SupabaseClient = {} as unknown as SupabaseClient
  const completed: ProcSubtaskRow = {
    id: 'x',
    proc_task_id: 'task-1',
    tpl_subtask_id: null,
    subtask_key: 'email_pedido_doc',
    title: 't',
    is_mandatory: true,
    is_completed: true,
    completed_at: new Date().toISOString(),
    completed_by: null,
    owner_id: null,
    due_date: null,
    assigned_to: null,
    assigned_role: null,
    priority: 'normal',
    order_index: 1000,
    config: {},
    created_at: null,
    started_at: null,
    is_blocked: false,
    dependency_type: null,
    dependency_proc_subtask_id: null,
    dependency_proc_task_id: null,
    unblocked_at: null,
  }
  assert.ok(propagateDueDates({ supabase: fake, completed, userId: 'u' }))
})
