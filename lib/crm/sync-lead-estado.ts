import {
  computeLeadEstado,
  isAutoManaged,
  type NegocioForEstado,
} from './compute-lead-estado'

// Generic Supabase client type — works with both server-cookies clients
// and admin/service-role clients. We only call the methods these helpers
// happen to share.
type SupabaseLike = {
  from: (table: string) => any
}

interface NegocioRow {
  pipeline_type: string | null
  stage:
    | { name: string | null; is_terminal: boolean | null; terminal_type: string | null }
    | null
}

async function fetchNegociosForLead(
  supabase: SupabaseLike,
  leadId: string
): Promise<NegocioForEstado[]> {
  const { data, error } = await supabase
    .from('negocios')
    .select(
      'pipeline_type, stage:leads_pipeline_stages!pipeline_stage_id(name, is_terminal, terminal_type)'
    )
    .eq('lead_id', leadId)

  if (error) {
    console.error('sync-lead-estado fetch error:', error)
    return []
  }

  return ((data || []) as NegocioRow[]).map((n) => ({
    pipeline_type: n.pipeline_type,
    stage_name: n.stage?.name ?? null,
    is_terminal: n.stage?.is_terminal ?? null,
    terminal_type: n.stage?.terminal_type ?? null,
  }))
}

/**
 * Recompute and persist the auto-managed `leads.estado` for a single contact.
 *
 * - No-op if the lead's current estado is one of the manually-managed values
 *   (Qualificado / Perdido / Inactivo) — those are the consultant's call.
 * - No-op if the computed value already matches the current value.
 * - Errors are logged but never thrown — callers (negocio CRUD endpoints)
 *   should not fail because of an estado-sync glitch.
 */
export async function syncLeadEstado(
  supabase: SupabaseLike,
  leadId: string
): Promise<void> {
  if (!leadId) return

  try {
    const { data: lead, error: leadErr } = await supabase
      .from('leads')
      .select('id, estado')
      .eq('id', leadId)
      .maybeSingle()

    if (leadErr || !lead) {
      if (leadErr) console.error('sync-lead-estado lead fetch error:', leadErr)
      return
    }

    if (!isAutoManaged(lead.estado)) return

    const negocios = await fetchNegociosForLead(supabase, leadId)
    const next = computeLeadEstado(negocios)

    if (lead.estado === next) return

    const { error: updateErr } = await supabase
      .from('leads')
      .update({ estado: next })
      .eq('id', leadId)

    if (updateErr) {
      console.error('sync-lead-estado update error:', updateErr)
    }
  } catch (err) {
    console.error('sync-lead-estado unexpected error:', err)
  }
}

/**
 * Bulk recompute. Used by the backfill script and by callers that touch
 * many leads at once. Sequential to keep DB load predictable.
 */
export async function syncLeadEstadoBulk(
  supabase: SupabaseLike,
  leadIds: string[]
): Promise<void> {
  for (const id of leadIds) {
    // eslint-disable-next-line no-await-in-loop
    await syncLeadEstado(supabase, id)
  }
}
