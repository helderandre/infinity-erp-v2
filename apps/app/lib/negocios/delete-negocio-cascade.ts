/**
 * Single source of truth for deleting a negócio (oportunidade) + its cascade.
 *
 * Used by BOTH the direct delete path (DELETE /api/negocios/[id]) and the
 * partner-approved path (POST /api/deletion-requests/[id]/approve). Syncs the
 * parent lead's `estado` label afterwards, mirroring the original endpoint.
 */

import { syncLeadEstado } from '@/lib/crm/sync-lead-estado'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any

export async function deleteNegocioCascade(
  db: Db,
  negocioId: string,
): Promise<{ error: string | null }> {
  const { data: existing } = await db
    .from('negocios')
    .select('lead_id')
    .eq('id', negocioId)
    .maybeSingle()

  const { error } = await db.from('negocios').delete().eq('id', negocioId)
  if (error) return { error: error.message }

  if (existing?.lead_id) {
    await syncLeadEstado(db, existing.lead_id)
  }
  return { error: null }
}
