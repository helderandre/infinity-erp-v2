import type { SupabaseClient } from '@supabase/supabase-js'
import { getRulesFor } from './registry'
import { shiftToNextBusinessDay } from './business-days'
import type {
  ClientRef,
  DealContext,
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

  // PROC-NEG tem um modelo de contexto diferente (deal + deal_clients +
  // cenário) — delega num branch dedicado que reusa os helpers partilhados
  // (deleteSupersededLegacyRows / insertBatchWithDedup). A pista de
  // angariação fica intocada.
  if (processType === 'negocio') {
    return populateNegocioSubtasks(supabase, processId, rules)
  }

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

    const includeOwner = scope === 'all' || scope === 'main_contact_only'

    for (const task of matchingTasks) {
      for (const owner of expansion) {
        try {
          const ctx: SubtaskContext = {
            supabase,
            processId,
            procTaskId: task.id,
            propertyId: processCtx.property_id,
            consultantId: processCtx.consultant_id,
            owner: includeOwner ? owner : null,
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
            owner_id: includeOwner && owner ? owner.owner_id : null,
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

// ───────────────────────────── PROC-NEG ─────────────────────────────

interface NegocioContextLite {
  property_id: string | null
  consultant_id: string | null
  deal: DealContext
  clients: ClientRef[]
  /** Mirror do bypass legacy: default true, permissivo na ausência de info. */
  propertyHasMortgage: boolean
  propertyHasCondominium: boolean
}

/**
 * Contexto de um processo de fecho (PROC-NEG). Resolve o deal via
 * `deals.proc_instance_id`, lê os `deal_clients` (compradores) e as flags
 * do imóvel interno (hipoteca/condomínio) com a MESMA semântica permissiva
 * do antigo `bypassNonApplicableNegTasks`. `property_id` pode ser null
 * (cenário `angariacao_externa`, sem imóvel interno).
 */
async function fetchNegocioContext(
  supabase: SupabaseClient,
  processId: string
): Promise<NegocioContextLite | null> {
  const db = supabase as unknown as {
    from: (t: string) => ReturnType<SupabaseClient['from']>
  }

  const { data: piRaw } = await db
    .from('proc_instances')
    .select('property_id')
    .eq('id', processId)
    .single()
  const piPropertyId =
    (piRaw as { property_id: string | null } | null)?.property_id ?? null

  const { data: dealRaw, error: dealErr } = await db
    .from('deals')
    .select(
      'id, deal_type, business_type, partner_agency_name, partner_agency_nif, consultant_id, property_id'
    )
    .eq('proc_instance_id', processId)
    .maybeSingle()

  if (dealErr || !dealRaw) {
    console.error(
      '[populate/negocio] deal não encontrado para proc_instance',
      processId,
      dealErr?.message ?? ''
    )
    return null
  }

  const deal = dealRaw as {
    id: string
    deal_type: string | null
    business_type: string | null
    partner_agency_name: string | null
    partner_agency_nif: string | null
    consultant_id: string | null
    property_id: string | null
  }

  const propertyId = piPropertyId ?? deal.property_id ?? null

  const { data: clientsRaw } = await db
    .from('deal_clients')
    .select('id, person_type, name, email, nif, is_main_contact, order_index')
    .eq('deal_id', deal.id)
    .order('order_index', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: true })

  const clients: ClientRef[] = (
    (clientsRaw ?? []) as Array<{
      id: string
      person_type: 'singular' | 'coletiva' | null
      name: string
      email: string | null
      nif: string | null
      is_main_contact: boolean | null
      order_index: number | null
    }>
  ).map((c) => ({
    client_id: c.id,
    person_type: c.person_type ?? null,
    name: c.name ?? '',
    email: c.email ?? null,
    nif: c.nif ?? null,
    is_main_contact: Boolean(c.is_main_contact),
    order_index: c.order_index ?? null,
  }))

  // Flags do imóvel interno — mesma lógica permissiva do bypass legacy.
  let propertyHasMortgage = true
  let propertyHasCondominium = true
  if (propertyId) {
    const { data: internal } = await db
      .from('dev_property_internal')
      .select('has_mortgage, condominium_fee')
      .eq('property_id', propertyId)
      .maybeSingle()
    if (internal) {
      const row = internal as {
        has_mortgage: boolean | null
        condominium_fee: number | null
      }
      propertyHasMortgage = row.has_mortgage !== false
      propertyHasCondominium = Number(row.condominium_fee ?? 0) > 0
    }
  }

  return {
    property_id: propertyId,
    consultant_id: deal.consultant_id ?? null,
    deal: {
      dealId: deal.id,
      dealType: deal.deal_type ?? '',
      businessType: deal.business_type ?? null,
      partnerAgencyName: deal.partner_agency_name ?? null,
      partnerAgencyNif: deal.partner_agency_nif ?? null,
    },
    clients,
    propertyHasMortgage,
    propertyHasCondominium,
  }
}

/**
 * Avalia `rule.appliesWhen` contra o contexto do negócio. AND lógico entre
 * predicados declarados; predicados omitidos são ignorados. Espelha
 * `bypassNonApplicableNegTasks` mas ao nível da subtarefa (gate de criação).
 */
function evaluateNegocioAppliesWhen(
  when: NonNullable<SubtaskRule['appliesWhen']>,
  ctx: NegocioContextLite
): boolean {
  const dt = ctx.deal.dealType
  if (when.deal_type !== undefined && when.deal_type !== dt) return false

  if (when.buyer_has_singular !== undefined) {
    const has = ctx.clients.some((c) => c.person_type === 'singular')
    if (when.buyer_has_singular !== has) return false
  }
  if (when.buyer_has_coletiva !== undefined) {
    const has = ctx.clients.some((c) => c.person_type === 'coletiva')
    if (when.buyer_has_coletiva !== has) return false
  }
  if (when.angariacao_interna !== undefined) {
    const interna = dt !== 'angariacao_externa'
    if (when.angariacao_interna !== interna) return false
  }
  if (
    when.property_has_mortgage !== undefined &&
    when.property_has_mortgage !== ctx.propertyHasMortgage
  ) {
    return false
  }
  if (
    when.property_has_condominium !== undefined &&
    when.property_has_condominium !== ctx.propertyHasCondominium
  ) {
    return false
  }
  return true
}

/**
 * Populate de PROC-NEG. Expande `rules × proc_tasks × deal_clients?`:
 *  - `appliesWhen` faz gate de criação por cenário (deal_type/buyers/imóvel).
 *  - `repeatPerClient` cria uma row por comprador (filtrado por
 *    `personTypeFilter`), gravando `config.client_id`/`config.client_name`
 *    (NUNCA `owner_id`, cujo FK aponta para `owners`).
 *  - Caso contrário, 1 row sem owner/client.
 *
 * Idempotente (reusa `proc_subtasks_dedup` + `insertBatchWithDedup`). NÃO
 * marca `proc_tasks.is_bypassed` — isso continua a ser feito ao nível da
 * task pelo `bypassNonApplicableNegTasks` (que tem o lookup de imóvel).
 */
async function populateNegocioSubtasks(
  supabase: SupabaseClient,
  processId: string,
  rules: SubtaskRule[]
): Promise<PopulateResult> {
  const ctx = await fetchNegocioContext(supabase, processId)
  if (!ctx) return { inserted: 0, skipped: 0, failed: 1 }

  const tasks = await fetchProcessTasks(supabase, processId)
  if (tasks.length === 0) return { inserted: 0, skipped: 0, failed: 0 }

  // Remove as subtarefas legacy seedadas pela RPC populate_process_tasks
  // (tpl_subtask_id != null) para estas tasks — o registry hardcoded é o dono
  // ÚNICO das subtarefas de negócio. Torna o populate correcto e sem
  // duplicação INDEPENDENTEMENTE da migration de handoff (que apaga os
  // tpl_subtasks). Idempotente: as rows hardcoded têm tpl_subtask_id=null,
  // logo não são apagadas em re-runs; subtarefas concluídas são preservadas.
  const rpcSeededDeleted = await deleteRpcSeededSubtasks(
    supabase,
    tasks.map((t) => t.id)
  )

  const tasksByKind = new Map<string, ProcTaskLite[]>()
  for (const t of tasks) {
    const existing = tasksByKind.get(t.title) ?? []
    existing.push(t)
    tasksByKind.set(t.title, existing)
  }

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

    // Gate de cenário — se algum predicado declarado não bate, a rule não
    // materializa subtarefa.
    if (rule.appliesWhen && !evaluateNegocioAppliesWhen(rule.appliesWhen, ctx)) {
      continue
    }

    // Expansão por cliente (comprador) quando repeatPerClient.
    const personTypeFilter = rule.personTypeFilter ?? 'all'
    let expansion: (ClientRef | null)[]
    if (rule.repeatPerClient) {
      const filtered =
        personTypeFilter === 'all'
          ? ctx.clients
          : ctx.clients.filter((c) => c.person_type === personTypeFilter)
      expansion = filtered.length > 0 ? filtered : []
    } else {
      expansion = [null]
    }

    for (const task of matchingTasks) {
      for (const client of expansion) {
        try {
          const subCtx: SubtaskContext = {
            supabase,
            processId,
            procTaskId: task.id,
            propertyId: ctx.property_id,
            consultantId: ctx.consultant_id,
            owner: null,
            client,
            deal: ctx.deal,
            businessDay: (d) => shiftToNextBusinessDay(d, supabase),
          }

          const title = rule.titleBuilder(subCtx)
          const assignedTo = rule.assignedToResolver
            ? await rule.assignedToResolver(subCtx)
            : task.assigned_to

          const userConfig = rule.configBuilder ? rule.configBuilder(subCtx) : {}
          const config = {
            ...userConfig,
            ...(client
              ? { client_id: client.client_id, client_name: client.name }
              : {}),
            ...(rule.hint ? { hint: rule.hint } : {}),
            hardcoded: true,
            process_type: 'negocio',
            rule_key: rule.key,
          }

          rowsToInsert.push({
            proc_task_id: task.id,
            subtask_key: rule.key,
            title,
            is_mandatory: rule.isMandatory !== false,
            is_completed: false,
            // PROC-NEG usa config.client_id (não owner_id — FK→owners).
            owner_id: null,
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
            `[populate/negocio] erro ao expandir rule "${rule.key}" na task "${task.id}":`,
            msg
          )
          failed++
        }
      }
    }
  }

  if (rpcSeededDeleted > 0 || supersededDeleted > 0) {
    console.info(
      `[populate/negocio] removed ${rpcSeededDeleted} RPC-seeded + ${supersededDeleted} superseded legacy row(s)`
    )
  }

  if (rowsToInsert.length === 0) {
    return { inserted: 0, skipped: 0, failed }
  }

  const inserted = await insertBatchWithDedup(supabase, rowsToInsert)
  return {
    inserted: inserted.inserted,
    skipped: rowsToInsert.length - inserted.inserted - inserted.failed,
    failed: failed + inserted.failed,
  }
}

/**
 * Apaga as subtarefas que a RPC `populate_process_tasks` seedou a partir dos
 * `tpl_subtasks` (identificadas por `tpl_subtask_id IS NOT NULL`) para as tasks
 * indicadas. Usado SÓ no populate de negócio, onde o registry hardcoded é o
 * dono único das subtarefas. Preserva subtarefas concluídas e as hardcoded
 * (que têm `tpl_subtask_id = null`).
 */
async function deleteRpcSeededSubtasks(
  supabase: SupabaseClient,
  taskIds: string[]
): Promise<number> {
  if (taskIds.length === 0) return 0
  const db = supabase as unknown as {
    from: (t: string) => ReturnType<SupabaseClient['from']>
  }
  const { data, error } = await (db.from('proc_subtasks') as ReturnType<SupabaseClient['from']>)
    .delete()
    .in('proc_task_id', taskIds)
    .not('tpl_subtask_id', 'is', null)
    .eq('is_completed', false)
    .select('id')

  if (error) {
    console.error('[populate/negocio] deleteRpcSeededSubtasks:', error.message)
    return 0
  }
  return (data ?? []).length
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
