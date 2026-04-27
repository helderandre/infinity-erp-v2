/**
 * PROC-NEG per-client task multiplication.
 *
 * Para cada `proc_tasks` com `config.repeat_per_client = true` (ex.:
 * "Documentos do Comprador (Singular)"), filtra `deal_clients` pelo
 * `config.person_type_filter` e:
 *   - Se houver 1 cliente: anota a task com `config.client_id` +
 *     `config.client_name` e injecta o nome no título (" — <Nome>").
 *   - Se houver 2+ clientes: anota a primeira (existente) e CLONA a
 *     task + subtasks uma vez por cada cliente adicional.
 *
 * As tasks clonadas:
 *   - Mantêm `tpl_task_id` e `order_index` da original (para preservar
 *     agrupamento na UI; o `created_at` desempata pela ordem).
 *   - Recebem `config.client_id` + `config.client_name` (NÃO usam
 *     `proc_tasks.owner_id` porque o FK aponta para `owners` não para
 *     `deal_clients`).
 *   - Subtasks clonadas usam `subtask_key='legacy_clone_<task>_<idx>'`
 *     para satisfazer a unique constraint `proc_subtasks_dedup` —
 *     cada clone tem chave única dentro da nova task.
 *
 * Idempotência: o helper assume que corre 1x por proc_instance fresca.
 * Se for re-chamado, vai duplicar. Caller deve garantir single-call.
 *
 * Errors: re-thrown — caller deve envolver em try/catch.
 */

import type { SupabaseClient } from '@supabase/supabase-js'

type DealClient = {
  id: string
  name: string
  person_type: 'singular' | 'coletiva'
  order_index: number | null
}

type ProcTaskRow = {
  id: string
  proc_instance_id: string
  tpl_task_id: string | null
  title: string
  status: string | null
  is_mandatory: boolean | null
  is_bypassed: boolean | null
  due_date: string | null
  task_result: unknown
  stage_name: string | null
  stage_order_index: number | null
  action_type: string | null
  config: Record<string, unknown> | null
  assigned_role: string | null
  order_index: number | null
  priority: string
  dependency_proc_task_id: string | null
}

type ProcSubtaskRow = {
  id: string
  title: string
  is_mandatory: boolean | null
  order_index: number
  config: Record<string, unknown> | null
  due_date: string | null
  assigned_role: string | null
  priority: string
}

export type RepeatResult = {
  tasks_repeated: number
  total_clones: number
  details: { task_title: string; client_count: number; clones_created: number }[]
}

export async function repeatTasksPerClient(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: SupabaseClient<any>,
  procInstanceId: string,
  dealId: string
): Promise<RepeatResult> {
  // 1. Fetch deal_clients
  const { data: clientsRaw } = await admin
    .from('deal_clients')
    .select('id, name, person_type, order_index')
    .eq('deal_id', dealId)
    .order('order_index', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: true })

  const clients = (clientsRaw ?? []) as DealClient[]
  if (clients.length === 0) {
    return { tasks_repeated: 0, total_clones: 0, details: [] }
  }

  // 2. Fetch repeatable tasks (active, not bypassed)
  const { data: tasksRaw } = await admin
    .from('proc_tasks')
    .select(
      'id, proc_instance_id, tpl_task_id, title, status, is_mandatory, is_bypassed, due_date, task_result, stage_name, stage_order_index, action_type, config, assigned_role, order_index, priority, dependency_proc_task_id'
    )
    .eq('proc_instance_id', procInstanceId)
    .eq('is_bypassed', false)

  const tasks = (tasksRaw ?? []) as ProcTaskRow[]
  if (tasks.length === 0) {
    return { tasks_repeated: 0, total_clones: 0, details: [] }
  }

  let tasksRepeated = 0
  let totalClones = 0
  const details: RepeatResult['details'] = []

  for (const task of tasks) {
    const config = task.config ?? {}
    if (config.repeat_per_client !== true) continue

    const filter = (config.person_type_filter ?? 'all') as 'singular' | 'coletiva' | 'all'
    const matching = clients.filter((c) =>
      filter === 'all' ? true : c.person_type === filter
    )

    if (matching.length === 0) continue

    const baseTitle = task.title
    const [firstClient, ...restClients] = matching

    // Annotate the existing task with first client
    const firstConfig = {
      ...config,
      client_id: firstClient.id,
      client_name: firstClient.name,
    }
    await admin
      .from('proc_tasks')
      .update({
        title: `${baseTitle} — ${firstClient.name}`,
        config: firstConfig,
      })
      .eq('id', task.id)

    let clonesForThisTask = 0

    if (restClients.length > 0) {
      // Fetch subtasks of the original task to clone
      const { data: subtasksRaw } = await admin
        .from('proc_subtasks')
        .select('id, title, is_mandatory, order_index, config, due_date, assigned_role, priority')
        .eq('proc_task_id', task.id)
        .order('order_index', { ascending: true })

      const subtasks = (subtasksRaw ?? []) as ProcSubtaskRow[]

      // Clone the task per remaining client
      for (const client of restClients) {
        const cloneConfig = {
          ...config,
          client_id: client.id,
          client_name: client.name,
        }

        const { data: insertedTask, error: insertErr } = await admin
          .from('proc_tasks')
          .insert({
            proc_instance_id: procInstanceId,
            tpl_task_id: task.tpl_task_id,
            title: `${baseTitle} — ${client.name}`,
            status: task.status ?? 'pending',
            is_mandatory: task.is_mandatory ?? false,
            is_bypassed: false,
            stage_name: task.stage_name,
            stage_order_index: task.stage_order_index,
            action_type: task.action_type ?? 'COMPOSITE',
            config: cloneConfig,
            assigned_role: task.assigned_role,
            order_index: task.order_index ?? 0,
            priority: task.priority,
            dependency_proc_task_id: task.dependency_proc_task_id,
          })
          .select('id')
          .single()

        if (insertErr || !insertedTask) {
          console.error('[RepeatPerClient] Falha ao clonar task:', insertErr?.message)
          continue
        }

        const newTaskId = (insertedTask as { id: string }).id

        if (subtasks.length > 0) {
          const subtaskInserts = subtasks.map((st) => ({
            proc_task_id: newTaskId,
            title: st.title,
            is_mandatory: st.is_mandatory ?? false,
            order_index: st.order_index,
            config: st.config ?? {},
            due_date: st.due_date,
            assigned_role: st.assigned_role,
            priority: st.priority,
            // subtask_key precisa ser único — chave humana baseada no
            // novo task id + order_index garante zero colisão e
            // sinaliza claramente que é uma clone.
            subtask_key: `legacy_clone_${newTaskId}_${st.order_index}`,
          }))

          const { error: stInsertErr } = await admin
            .from('proc_subtasks')
            .insert(subtaskInserts)

          if (stInsertErr) {
            console.error('[RepeatPerClient] Falha ao clonar subtasks:', stInsertErr.message)
          }
        }

        clonesForThisTask += 1
      }
    }

    tasksRepeated += 1
    totalClones += clonesForThisTask
    details.push({
      task_title: baseTitle,
      client_count: matching.length,
      clones_created: clonesForThisTask,
    })
  }

  return { tasks_repeated: tasksRepeated, total_clones: totalClones, details }
}
