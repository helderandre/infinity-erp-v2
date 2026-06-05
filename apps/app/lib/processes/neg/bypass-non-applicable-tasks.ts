/**
 * PROC-NEG `applies_when` post-processor.
 *
 * Avalia `proc_tasks.config.applies_when` (definido no template em
 * 20260517_neg_process_template.sql) contra o estado real do `deals`
 * row + clients + property, e marca tasks irrelevantes como
 * `is_bypassed=true`.
 *
 * Predicados suportados:
 *   - `deal_type: 'angariacao_externa'` — task só corre quando deal_type
 *     bate exactamente o valor.
 *   - `buyer_has_singular: true` — task só corre se houver pelo menos
 *     um `deal_clients` com person_type='singular'.
 *   - `buyer_has_coletiva: true` — análogo para colectiva.
 *   - `angariacao_interna: true` — task só corre quando `deal_type !==
 *     'angariacao_externa'` (cobre pleno + pleno_agencia + comprador_externo).
 *   - `property_has_mortgage: true` — task só corre se
 *     `dev_property_internal.has_mortgage = true`. Permissivo (true)
 *     se a info estiver NULL ou se o deal não tiver `property_id`
 *     (caso angariacao_externa).
 *   - `property_has_condominium: true` — task só corre se
 *     `dev_property_internal.condominium_fee > 0`. Permissivo (true)
 *     em ausência de info.
 *
 * Cada `applies_when` pode combinar múltiplos predicados (AND lógico).
 * Se TODOS baterem → task fica activa; se algum NÃO bater → task é
 * marcada `is_bypassed=true` com `bypass_reason` enumerando os falhados.
 *
 * Subtasks NÃO são tocadas — `is_bypassed` da task pai é o sinal único
 * para a UI esconder/mute o subgrupo.
 *
 * Errors NÃO são propagados — caller envolve em try/catch + log.
 * O submit de deal não deve abortar por causa do post-processor.
 */

import type { SupabaseClient } from '@supabase/supabase-js'

type AppliesWhen = {
  deal_type?: string
  buyer_has_singular?: boolean
  buyer_has_coletiva?: boolean
  angariacao_interna?: boolean
  property_has_mortgage?: boolean
  property_has_condominium?: boolean
}

type DealForBypass = {
  id: string
  deal_type: string | null
  property_id: string | null
}

type ProcTaskRow = {
  id: string
  config: { applies_when?: AppliesWhen } | null
}

export type BypassResult = {
  total_evaluated: number
  bypassed_count: number
  bypassed: { id: string; reason: string }[]
}

export async function bypassNonApplicableNegTasks(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: SupabaseClient<any>,
  procInstanceId: string,
  dealId: string,
  bypassedBy: string | null = null
): Promise<BypassResult> {
  // 1. Fetch deal context
  const { data: dealRaw } = await admin
    .from('deals')
    .select('id, deal_type, property_id')
    .eq('id', dealId)
    .maybeSingle()

  const deal = dealRaw as DealForBypass | null
  if (!deal) {
    return { total_evaluated: 0, bypassed_count: 0, bypassed: [] }
  }

  // 2. Fetch deal_clients (todos são compradores hoje — não há `side`)
  const { data: clientsRaw } = await admin
    .from('deal_clients')
    .select('person_type')
    .eq('deal_id', dealId)

  const clients = (clientsRaw ?? []) as { person_type: string }[]
  const buyer_has_singular = clients.some((c) => c.person_type === 'singular')
  const buyer_has_coletiva = clients.some((c) => c.person_type === 'coletiva')

  // 3. Property internal flags (mortgage / condominium). Permissivo se
  //    NULL ou se não há property_id (caso angariacao_externa).
  let property_has_mortgage = true
  let property_has_condominium = true
  if (deal.property_id) {
    const { data: internal } = await admin
      .from('dev_property_internal')
      .select('has_mortgage, condominium_fee')
      .eq('property_id', deal.property_id)
      .maybeSingle()
    if (internal) {
      const internalRow = internal as { has_mortgage: boolean | null; condominium_fee: number | null }
      property_has_mortgage = internalRow.has_mortgage !== false  // true OR null → true
      property_has_condominium = Number(internalRow.condominium_fee ?? 0) > 0
    }
  }

  const angariacao_interna = deal.deal_type !== 'angariacao_externa'

  // 4. Fetch tasks com applies_when não-vazio
  const { data: tasksRaw } = await admin
    .from('proc_tasks')
    .select('id, config')
    .eq('proc_instance_id', procInstanceId)
    .eq('is_bypassed', false)

  const tasks = (tasksRaw ?? []) as ProcTaskRow[]
  if (tasks.length === 0) {
    return { total_evaluated: 0, bypassed_count: 0, bypassed: [] }
  }

  // 5. Evaluate each predicate
  const toBypass: { id: string; reason: string }[] = []
  const ctx = {
    deal_type: deal.deal_type,
    buyer_has_singular,
    buyer_has_coletiva,
    angariacao_interna,
    property_has_mortgage,
    property_has_condominium,
  }

  for (const t of tasks) {
    const aw = t.config?.applies_when
    if (!aw || Object.keys(aw).length === 0) continue

    const failures: string[] = []

    if (aw.deal_type !== undefined && aw.deal_type !== ctx.deal_type) {
      failures.push(`deal_type=${ctx.deal_type ?? 'null'} (esperado ${aw.deal_type})`)
    }
    if (aw.buyer_has_singular !== undefined && aw.buyer_has_singular !== ctx.buyer_has_singular) {
      failures.push(`buyer_has_singular=${ctx.buyer_has_singular}`)
    }
    if (aw.buyer_has_coletiva !== undefined && aw.buyer_has_coletiva !== ctx.buyer_has_coletiva) {
      failures.push(`buyer_has_coletiva=${ctx.buyer_has_coletiva}`)
    }
    if (aw.angariacao_interna !== undefined && aw.angariacao_interna !== ctx.angariacao_interna) {
      failures.push(`angariacao_interna=${ctx.angariacao_interna}`)
    }
    if (aw.property_has_mortgage !== undefined && aw.property_has_mortgage !== ctx.property_has_mortgage) {
      failures.push(`property_has_mortgage=${ctx.property_has_mortgage}`)
    }
    if (aw.property_has_condominium !== undefined && aw.property_has_condominium !== ctx.property_has_condominium) {
      failures.push(`property_has_condominium=${ctx.property_has_condominium}`)
    }

    if (failures.length > 0) {
      toBypass.push({
        id: t.id,
        reason: `Não aplicável: ${failures.join(', ')}`,
      })
    }
  }

  if (toBypass.length === 0) {
    return { total_evaluated: tasks.length, bypassed_count: 0, bypassed: [] }
  }

  // 6. Bulk UPDATE — uma row de cada vez (Supabase não tem CASE-based bulk update fácil)
  for (const item of toBypass) {
    await admin
      .from('proc_tasks')
      .update({
        is_bypassed: true,
        bypass_reason: item.reason,
        bypassed_by: bypassedBy,
      })
      .eq('id', item.id)
  }

  return {
    total_evaluated: tasks.length,
    bypassed_count: toBypass.length,
    bypassed: toBypass,
  }
}
