import type { SupabaseClient } from '@supabase/supabase-js'
import { getDependentRules } from './registry'
import {
  addOffset,
  parseOffset,
  shiftToNextBusinessDay,
} from './business-days'
import { isDeclarativeDueRule, type ProcSubtaskRow, type SubtaskRule } from './types'
import { logTaskActivity } from '@/lib/processes/activity-logger'

/**
 * Propaga `due_date` para os siblings da subtarefa que acabou de ser
 * concluída.
 *
 * Algoritmo:
 *  1. Para cada rule do registry cujo `dueRule.after === completed.subtask_key`,
 *  2. SELECT siblings na mesma `proc_task_id` e `subtask_key === rule.key`
 *     que ainda não estejam completos (`is_completed != true`) e que
 *     ainda não tenham `due_date` calculado.
 *  3. Calcula novo `due_date` via offset + shift, UPDATE e emite
 *     activity `'due_date_set'`.
 *
 * Erros parciais por sibling são apanhados individualmente (try/catch)
 * e NÃO revertem a conclusão da subtarefa principal.
 */
export async function propagateDueDates(params: {
  supabase: SupabaseClient
  completed: ProcSubtaskRow
  userId: string
}): Promise<{ updated: number; skipped: number; failed: number }> {
  const { supabase, completed, userId } = params

  let updated = 0
  let skipped = 0
  let failed = 0

  const completedAtIso = completed.completed_at ?? new Date().toISOString()
  const completedAt = new Date(completedAtIso)

  const dependents: SubtaskRule[] = getDependentRules(completed.subtask_key)
  if (dependents.length === 0) return { updated, skipped, failed }

  for (const rule of dependents) {
    const dueRule = rule.dueRule
    if (!dueRule) continue

    // Procura siblings em aberto no mesmo proc_task
    const { data: siblings, error: fetchErr } = await (
      supabase as unknown as { from: (t: string) => ReturnType<SupabaseClient['from']> }
    )
      .from('proc_subtasks')
      .select('id, proc_task_id, subtask_key, is_completed, owner_id, due_date')
      .eq('proc_task_id', completed.proc_task_id)
      .eq('subtask_key', rule.key)

    if (fetchErr) {
      console.error('[propagateDueDates] fetch siblings:', fetchErr.message)
      failed++
      continue
    }

    for (const sibling of siblings ?? []) {
      const row = sibling as unknown as Pick<
        ProcSubtaskRow,
        'id' | 'proc_task_id' | 'subtask_key' | 'is_completed' | 'owner_id' | 'due_date'
      >

      if (row.is_completed === true) {
        skipped++
        continue
      }

      try {
        let newDueDate: Date
        let shiftedFromNonBusinessDay = false

        if (isDeclarativeDueRule(dueRule)) {
          const parsed = parseOffset(dueRule.offset)
          if (!parsed) {
            console.error(
              `[propagateDueDates] offset inválido em rule "${rule.key}": "${dueRule.offset}"`
            )
            failed++
            continue
          }
          const raw = addOffset(completedAt, parsed)
          if (dueRule.shiftOnNonBusinessDay) {
            const shifted = await shiftToNextBusinessDay(raw, supabase)
            shiftedFromNonBusinessDay = shifted.getTime() !== raw.getTime()
            newDueDate = shifted
          } else {
            newDueDate = raw
          }
        } else {
          // Imperativa
          const result = await dueRule({
            prereqCompletedAt: completedAt,
            businessDay: (d) => shiftToNextBusinessDay(d, supabase),
          })
          newDueDate = result
        }

        const previousDueDate = row.due_date ?? null

        const { error: updateErr } = await (
          supabase as unknown as { from: (t: string) => ReturnType<SupabaseClient['from']> }
        )
          .from('proc_subtasks')
          .update({ due_date: newDueDate.toISOString() })
          .eq('id', row.id)

        if (updateErr) {
          console.error('[propagateDueDates] update sibling:', updateErr.message)
          failed++
          continue
        }

        // Activity em `proc_task_activities` — NÃO reverte em caso de erro do UPDATE,
        // porque queremos que o sibling fique com o due_date correcto mesmo se o
        // activity log falhar (raro mas possível).
        await logTaskActivity(
          supabase,
          row.proc_task_id,
          userId,
          'due_date_set' as never, // adicionado a TASK_ACTIVITY_TYPE_CONFIG pela Section 6
          `Due date atribuído a "${rule.key}" após conclusão de "${completed.subtask_key}"`,
          {
            subtask_id: row.id,
            subtask_key: row.subtask_key,
            owner_id: row.owner_id,
            previous_due_date: previousDueDate,
            new_due_date: newDueDate.toISOString(),
            triggered_by: {
              subtask_id: completed.id,
              subtask_key: completed.subtask_key,
            },
            shifted_from_non_business_day: shiftedFromNonBusinessDay,
          }
        )

        updated++
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        console.error(`[propagateDueDates] erro em sibling ${row.id}:`, msg)
        failed++
      }
    }
  }

  return { updated, skipped, failed }
}
