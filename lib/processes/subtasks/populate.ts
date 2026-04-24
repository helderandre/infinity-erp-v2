import type { SupabaseClient } from '@supabase/supabase-js'
import { getRulesFor } from './registry'
import { shiftToNextBusinessDay } from './business-days'
import type {
  OwnerRef,
  ProcessType,
  SubtaskContext,
  SubtaskRule,
} from './types'

/**
 * Offset base de `order_index` para subtarefas hardcoded. Colocado alto
 * para evitar colisão visual/ordenação com subtarefas legacy (que usam
 * 0..N contiguos) e para dar margem a futuras inserções declarativas.
 */
const HARDCODED_ORDER_INDEX_BASE = 1000

interface PopulateResult {
  inserted: number
  skipped: number
  failed: number
}

interface PopulateRow {
  proc_task_id: string
  subtask_key: string
  title: string
  is_mandatory: boolean
  is_completed: boolean
  owner_id: string | null
  assigned_to: string | null
  order_index: number
  priority: string
  is_blocked: boolean
  config: Record<string, unknown>
  tpl_subtask_id: null
}

interface ProcTaskLite {
  id: string
  title: string
  assigned_to: string | null
}

interface ProcInstanceLite {
  property_id: string
  consultant_id: string | null
}

async function fetchProcessContext(
  supabase: SupabaseClient,
  processId: string
): Promise<ProcInstanceLite | null> {
  const { data, error } = await (
    supabase as unknown as { from: (t: string) => ReturnType<SupabaseClient['from']> }
  )
    .from('proc_instances')
    .select('property_id, property:dev_properties(consultant_id)')
    .eq('id', processId)
    .single()

  if (error || !data) return null
  const row = data as unknown as {
    property_id: string
    property: { consultant_id: string | null } | null
  }
  return {
    property_id: row.property_id,
    consultant_id: row.property?.consultant_id ?? null,
  }
}

async function fetchProcessTasks(
  supabase: SupabaseClient,
  processId: string
): Promise<ProcTaskLite[]> {
  const { data, error } = await (
    supabase as unknown as { from: (t: string) => ReturnType<SupabaseClient['from']> }
  )
    .from('proc_tasks')
    .select('id, title, assigned_to')
    .eq('proc_instance_id', processId)

  if (error) {
    console.error('[populate] fetchProcessTasks:', error.message)
    return []
  }
  return (data ?? []) as unknown as ProcTaskLite[]
}

async function fetchOwners(
  supabase: SupabaseClient,
  propertyId: string
): Promise<OwnerRef[]> {
  const { data, error } = await (
    supabase as unknown as { from: (t: string) => ReturnType<SupabaseClient['from']> }
  )
    .from('property_owners')
    .select(
      'owner_id, ownership_percentage, is_main_contact, owners(name, person_type, email)'
    )
    .eq('property_id', propertyId)

  if (error) {
    console.error('[populate] fetchOwners:', error.message)
    return []
  }

  const rows = (data ?? []) as unknown as Array<{
    owner_id: string
    ownership_percentage: number | null
    is_main_contact: boolean | null
    owners: {
      name: string
      person_type: 'singular' | 'coletiva' | null
      email: string | null
    } | null
  }>

  return rows.map((r) => ({
    owner_id: r.owner_id,
    ownership_percentage: r.ownership_percentage ?? null,
    is_main_contact: Boolean(r.is_main_contact),
    person_type: r.owners?.person_type ?? null,
    name: r.owners?.name ?? '',
    email: r.owners?.email ?? null,
  }))
}

/**
 * Popula `proc_subtasks` expandindo `rules × proc_tasks × owners?` para o
 * processo indicado. Idempotente: usa `ON CONFLICT DO NOTHING` contra o
 * índice `proc_subtasks_dedup` sobre `(proc_task_id, subtask_key,
 * COALESCE(owner_id, uuid_nil))`.
 *
 * NÃO envolve a operação numa transacção — erros parciais deixam linhas
 * inseridas. O caller (handler populate-angariacao) lida com retomada
 * via re-invocação (idempotente).
 */
export async function populateSubtasks(
  supabase: SupabaseClient,
  processId: string,
  processType: ProcessType
): Promise<PopulateResult> {
  const rules = getRulesFor(processType)
  if (rules.length === 0) return { inserted: 0, skipped: 0, failed: 0 }

  const processCtx = await fetchProcessContext(supabase, processId)
  if (!processCtx) {
    return { inserted: 0, skipped: 0, failed: 1 }
  }

  const tasks = await fetchProcessTasks(supabase, processId)
  if (tasks.length === 0) return { inserted: 0, skipped: 0, failed: 0 }

  const owners = await fetchOwners(supabase, processCtx.property_id)

  // Index tasks por `title` (== taskKind da rule). Mantemos um Map de
  // arrays porque é legítimo uma rule materializar-se em várias tasks
  // com o mesmo kind (raro, mas possível em templates revistos).
  const tasksByKind = new Map<string, ProcTaskLite[]>()
  for (const t of tasks) {
    const existing = tasksByKind.get(t.title) ?? []
    existing.push(t)
    tasksByKind.set(t.title, existing)
  }

  // Pre-pass: para cada rule com `supersedesTplSubtaskId`, apagar as rows
  // legacy correspondentes (criadas pelo `_populate_subtasks` durante a
  // aprovação). Idempotente — corre a cada populate e só apaga as rows
  // que ainda não foram concluídas ou editadas pela pista hardcoded.
  const supersededDeleted = await deleteSupersededLegacyRows(
    supabase,
    rules,
    tasksByKind
  )

  const rowsToInsert: PopulateRow[] = []
  let orderCursor = HARDCODED_ORDER_INDEX_BASE
  let failed = 0

  for (const rule of rules) {
    const matchingTasks = tasksByKind.get(rule.taskKind) ?? []
    if (matchingTasks.length === 0) continue

    // Resolve escopo de owner: ownerScope prevalece; caso omitido,
    // fallback para repeatPerOwner legacy.
    const scope: 'none' | 'main_contact_only' | 'all' =
      rule.ownerScope ?? (rule.repeatPerOwner ? 'all' : 'none')

    // Aplica personTypeFilter antes do scope (só se o scope toca owners).
    const personTypeFilter = rule.personTypeFilter ?? 'all'
    const ownersFiltered =
      scope === 'none' || personTypeFilter === 'all'
        ? owners
        : owners.filter((o) => o.person_type === personTypeFilter)

    let expansion: OwnerRef[]
    if (scope === 'all') {
      expansion = ownersFiltered
    } else if (scope === 'main_contact_only') {
      const main =
        ownersFiltered.find((o) => o.is_main_contact) ?? ownersFiltered[0] ?? null
      expansion = main ? [main] : []
    } else {
      expansion = [null as unknown as OwnerRef]
    }

    for (const task of matchingTasks) {
      for (const owner of expansion) {
        try {
          const ctx: SubtaskContext = {
            supabase,
            processId,
            procTaskId: task.id,
            propertyId: processCtx.property_id,
            consultantId: processCtx.consultant_id,
            owner: rule.repeatPerOwner ? owner : null,
            businessDay: (d) => shiftToNextBusinessDay(d, supabase),
          }

          const title = rule.titleBuilder(ctx)
          const assignedTo = rule.assignedToResolver
            ? await rule.assignedToResolver(ctx)
            : task.assigned_to

          // Config base hardcoded + merge com configBuilder (se existir).
          // Os marcadores (`hardcoded`, `process_type`, `rule_key`, `hint`)
          // prevalecem sobre chaves do configBuilder.
          const userConfig = rule.configBuilder ? rule.configBuilder(ctx) : {}
          const config = {
            ...userConfig,
            ...(rule.hint ? { hint: rule.hint } : {}),
            hardcoded: true,
            process_type: processType,
            rule_key: rule.key,
          }

          rowsToInsert.push({
            proc_task_id: task.id,
            subtask_key: rule.key,
            title,
            is_mandatory: rule.isMandatory !== false,
            is_completed: false,
            owner_id: rule.repeatPerOwner ? owner.owner_id : null,
            assigned_to: assignedTo ?? null,
            order_index: orderCursor++,
            priority: 'normal',
            is_blocked: false,
            config,
            tpl_subtask_id: null,
          })
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err)
          console.error(
            `[populate] erro ao expandir rule "${rule.key}" na task "${task.id}":`,
            msg
          )
          failed++
        }
      }
    }
  }

  if (supersededDeleted > 0) {
    console.info(
      `[populate] ${supersededDeleted} legacy row(s) superseded removed before hardcoded insert`
    )
  }

  if (rowsToInsert.length === 0) {
    return { inserted: 0, skipped: 0, failed }
  }

  // INSERT ... ON CONFLICT DO NOTHING via PostgREST: passamos
  // onConflict: 'proc_task_id,subtask_key,owner_id'. Nota: o unique
  // index usa COALESCE(owner_id, uuid_nil), o que o PostgREST não consegue
  // resolver directamente; como workaround, fazemos INSERT directo e
  // absorvemos o erro `23505` (unique_violation) linha-a-linha via
  // batches de 1 em caso de conflict em batch.
  //
  // Estratégia preferida: tentar batch; se falhar com 23505, cair para
  // modo 1-por-1 com upsert null-safe.
  const inserted = await insertBatchWithDedup(supabase, rowsToInsert)

  return {
    inserted: inserted.inserted,
    skipped: rowsToInsert.length - inserted.inserted - inserted.failed,
    failed: failed + inserted.failed,
  }
}

/**
 * Apaga rows legacy (criadas pelo `_populate_subtasks` durante a aprovação)
 * que correspondam aos `supersedesTplSubtaskId` declarados pelas rules.
 *
 * Scope da query: apenas `proc_tasks` do processo actual (via task ids
 * que já temos no `tasksByKind`) + `subtask_key LIKE 'legacy_%'` — evita
 * apagar rows hardcoded ou ad-hoc por engano.
 *
 * Idempotente: não apaga rows já concluídas (`is_completed=true`) para
 * preservar auditoria caso uma rule seja introduzida depois de o
 * processo ter avançado.
 */
async function deleteSupersededLegacyRows(
  supabase: SupabaseClient,
  rules: SubtaskRule[],
  tasksByKind: Map<string, ProcTaskLite[]>
): Promise<number> {
  const supersededIds = new Set<string>()
  for (const rule of rules) {
    if (!rule.supersedesTplSubtaskId) continue
    // Só apagamos se a rule vai de facto materializar-se em alguma task
    // do processo — se a task não existe, deixar o legacy em paz.
    const hasMatchingTask = (tasksByKind.get(rule.taskKind) ?? []).length > 0
    if (!hasMatchingTask) continue
    const list = Array.isArray(rule.supersedesTplSubtaskId)
      ? rule.supersedesTplSubtaskId
      : [rule.supersedesTplSubtaskId]
    for (const id of list) supersededIds.add(id)
  }

  if (supersededIds.size === 0) return 0

  // Colecciona os task ids que contêm rules com supersede.
  const relevantTaskIds = new Set<string>()
  for (const rule of rules) {
    if (!rule.supersedesTplSubtaskId) continue
    for (const t of tasksByKind.get(rule.taskKind) ?? []) {
      relevantTaskIds.add(t.id)
    }
  }

  if (relevantTaskIds.size === 0) return 0

  const db = supabase as unknown as {
    from: (t: string) => ReturnType<SupabaseClient['from']>
  }

  const { data, error } = await (db.from('proc_subtasks') as ReturnType<SupabaseClient['from']>)
    .delete()
    .in('proc_task_id', Array.from(relevantTaskIds))
    .in('tpl_subtask_id', Array.from(supersededIds))
    .like('subtask_key', 'legacy_%')
    .eq('is_completed', false)
    .select('id')

  if (error) {
    console.error('[populate] deleteSupersededLegacyRows:', error.message)
    return 0
  }
  return (data ?? []).length
}

/**
 * Insert batch com tolerância a conflict. Tenta primeiro um INSERT bulk;
 * se o Postgres rejeitar por unique_violation (23505) em batch (todo ou
 * parte), cai em modo 1-por-1 para isolar conflitos.
 *
 * Esta abordagem manual é necessária porque o functional unique index
 * `(proc_task_id, subtask_key, COALESCE(owner_id, uuid_nil))` não casa
 * com o `onConflict` do PostgREST, que só suporta índices de colunas
 * directas (mesma limitação documentada no CLAUDE.md para
 * `contact_automation_lead_settings.custom_event_id`).
 */
async function insertBatchWithDedup(
  supabase: SupabaseClient,
  rows: PopulateRow[]
): Promise<{ inserted: number; failed: number }> {
  const db = supabase as unknown as {
    from: (t: string) => ReturnType<SupabaseClient['from']>
  }

  // Primeira tentativa: bulk insert
  const { data, error } = await (db.from('proc_subtasks') as ReturnType<SupabaseClient['from']>)
    .insert(rows)
    .select('id')

  if (!error) {
    return { inserted: (data ?? []).length, failed: 0 }
  }

  // Falha: se for unique_violation (ou indicação dela), fazemos row-a-row.
  const isUniqueViolation =
    error.code === '23505' ||
    /duplicate key|unique/i.test(error.message ?? '')

  if (!isUniqueViolation) {
    console.error('[populate] bulk insert falhou (não-unique):', error.message)
    return { inserted: 0, failed: rows.length }
  }

  let inserted = 0
  let failed = 0

  for (const row of rows) {
    const { error: rowErr } = await (db.from('proc_subtasks') as ReturnType<SupabaseClient['from']>)
      .insert(row)

    if (!rowErr) {
      inserted++
      continue
    }

    const isDup =
      rowErr.code === '23505' ||
      /duplicate key|unique/i.test(rowErr.message ?? '')

    if (isDup) {
      // skipped — row já existia (expected em retries idempotentes)
      continue
    }

    console.error(
      `[populate] insert 1-por-1 falhou para (${row.proc_task_id}, ${row.subtask_key}):`,
      rowErr.message
    )
    failed++
  }

  return { inserted, failed }
}
