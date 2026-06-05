/**
 * PROC-NEG `close_deal` hook.
 *
 * Disparado pela última task do Stage 5 (Encerramento) — "Fechar
 * negócio" — quando todas as subtasks ficam completas.
 *
 * Acções:
 *   1. `deals.status='completed'` (+ updated_at).
 *   2. Lookup do `terminal_won` stage do pipeline_type do negócio (1 row
 *      em `leads_pipeline_stages`).
 *   3. UPDATE `negocios` SET pipeline_stage_id = <won_id>, won_date,
 *      lost_date=NULL, estado=<stage name>, stage_entered_at=now().
 *   4. `syncLeadEstado(lead_id)` para propagar para `leads.estado` se
 *      o lead estiver em modo auto-managed.
 *
 * Idempotência: se `deals.status` já for `'completed'`, no-op silencioso
 * (return). Se o negócio já estiver na terminal won, no-op.
 *
 * Errors NÃO são propagados — caller envolve em try/catch + log.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { syncLeadEstado } from '@/lib/crm/sync-lead-estado'

export type CloseDealResult = {
  status: 'closed' | 'already_closed' | 'no_deal' | 'no_terminal_stage' | 'error'
  deal_id?: string
  negocio_id?: string
  won_stage_id?: string
  message?: string
}

export async function closeDealFromHook(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: SupabaseClient<any>,
  procInstanceId: string
): Promise<CloseDealResult> {
  // 1. Find the deal linked to this proc_instance
  const { data: dealRow, error: dealErr } = await admin
    .from('deals')
    .select('id, status, negocio_id')
    .eq('proc_instance_id', procInstanceId)
    .maybeSingle()

  if (dealErr || !dealRow) {
    return { status: 'no_deal', message: dealErr?.message ?? 'Deal não encontrado' }
  }

  const deal = dealRow as { id: string; status: string | null; negocio_id: string | null }

  if (deal.status === 'completed') {
    return { status: 'already_closed', deal_id: deal.id }
  }

  // 2. Update deals.status='completed'
  const { error: updateDealErr } = await admin
    .from('deals')
    .update({ status: 'completed', updated_at: new Date().toISOString() })
    .eq('id', deal.id)

  if (updateDealErr) {
    return { status: 'error', message: `Erro ao actualizar deal: ${updateDealErr.message}` }
  }

  // 3. Move negócio to terminal won stage (if linked)
  if (!deal.negocio_id) {
    return { status: 'closed', deal_id: deal.id }
  }

  const { data: negRow } = await admin
    .from('negocios')
    .select('id, lead_id, pipeline_type, pipeline_stage_id')
    .eq('id', deal.negocio_id)
    .maybeSingle()

  const negocio = negRow as {
    id: string
    lead_id: string
    pipeline_type: string | null
    pipeline_stage_id: string | null
  } | null

  if (!negocio || !negocio.pipeline_type) {
    return { status: 'closed', deal_id: deal.id, negocio_id: deal.negocio_id }
  }

  // Lookup terminal_won stage for this pipeline_type
  const { data: wonStageRow } = await admin
    .from('leads_pipeline_stages')
    .select('id, name')
    .eq('pipeline_type', negocio.pipeline_type)
    .eq('is_terminal', true)
    .eq('terminal_type', 'won')
    .limit(1)
    .maybeSingle()

  const wonStage = wonStageRow as { id: string; name: string } | null

  if (!wonStage) {
    return {
      status: 'no_terminal_stage',
      deal_id: deal.id,
      negocio_id: negocio.id,
      message: `Nenhuma stage terminal won encontrada para pipeline_type='${negocio.pipeline_type}'`,
    }
  }

  // Skip if already on the won stage
  if (negocio.pipeline_stage_id === wonStage.id) {
    return {
      status: 'closed',
      deal_id: deal.id,
      negocio_id: negocio.id,
      won_stage_id: wonStage.id,
    }
  }

  const nowIso = new Date().toISOString()
  await admin
    .from('negocios')
    .update({
      pipeline_stage_id: wonStage.id,
      won_date: nowIso,
      lost_date: null,
      lost_reason: null,
      lost_notes: null,
      estado: wonStage.name,
      stage_entered_at: nowIso,
    })
    .eq('id', negocio.id)

  // 4. Sync lead estado (auto-managed)
  if (negocio.lead_id) {
    await syncLeadEstado(admin as never, negocio.lead_id)
  }

  return {
    status: 'closed',
    deal_id: deal.id,
    negocio_id: negocio.id,
    won_stage_id: wonStage.id,
  }
}
