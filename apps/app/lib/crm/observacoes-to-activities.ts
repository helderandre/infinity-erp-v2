// Bridges a négocio's free-text "Observações" (written in the qualify dialog or
// the observations editor, stored in `negocios.observacoes`) into first-class
// notes in `leads_activities`, so they surface in the Notas / Histórico feeds of
// the oportunidade instead of living only in the deal's description field.
//
// `negocios.observacoes` has two historical shapes:
//   1. Plain text  — e.g. "Esta é uma nota da qualificação" (qualify dialog).
//   2. JSON array  — [{ id, text, created_at }] (the ObservationsDialog editor).
// `parseNegocioObservacoes` normalises both into a stable list. Each item keeps a
// deterministic `obsId` so the sync can be run repeatedly (qualify + backfill)
// without ever duplicating a note (`metadata.obs_id` de-dup guard).

export interface ParsedObservation {
  /** Stable id used for idempotency. Structured items reuse their own id; items
   *  without one fall back to their index; legacy plain text uses 'legacy'. */
  obsId: string
  text: string
  /** When the observation was originally made (structured items only). */
  createdAt: string | null
}

export function parseNegocioObservacoes(
  raw: string | null | undefined,
): ParsedObservation[] {
  if (!raw || typeof raw !== 'string' || raw.trim() === '') return []

  try {
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) {
      return parsed
        .filter((o) => o && typeof o.text === 'string' && o.text.trim() !== '')
        .map((o, i) => ({
          obsId: typeof o.id === 'string' && o.id.trim() !== '' ? o.id : `idx_${i}`,
          text: String(o.text).trim(),
          createdAt: typeof o.created_at === 'string' ? o.created_at : null,
        }))
    }
  } catch {
    // Not JSON — treat as legacy plain text below.
  }

  return [{ obsId: 'legacy', text: raw.trim(), createdAt: null }]
}

interface SyncArgs {
  negocioId: string
  contactId: string
  observacoes: string | null | undefined
  createdBy?: string | null
  /** occurred_at fallback when the observation carries no own timestamp
   *  (e.g. the négocio's created_at, so backfilled notes don't read "today"). */
  fallbackOccurredAt?: string | null
}

/**
 * Create a `leads_activities` note per observation that doesn't yet have one.
 * Idempotent: skips observations already materialised (matched by
 * `metadata.obs_id` on notes scoped to this négocio). Best-effort callers should
 * wrap this in try/catch — it must never abort the qualification.
 *
 * `supabase` is an admin (service-role) client — this bypasses RLS by design.
 */
export async function syncNegocioObservacoesToActivities(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  args: SyncArgs,
): Promise<{ created: number; skipped: number }> {
  const items = parseNegocioObservacoes(args.observacoes)
  if (items.length === 0) return { created: 0, skipped: 0 }

  const { data: existing } = await supabase
    .from('leads_activities')
    .select('id, metadata')
    .eq('negocio_id', args.negocioId)
    .eq('activity_type', 'note')

  const existingObsIds = new Set<string>(
    (existing ?? [])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((r: any) => r?.metadata?.obs_id)
      .filter((x: unknown): x is string => typeof x === 'string'),
  )

  const toInsert = items
    .filter((it) => !existingObsIds.has(it.obsId))
    .map((it) => ({
      contact_id: args.contactId,
      negocio_id: args.negocioId,
      activity_type: 'note' as const,
      description: it.text,
      created_by: args.createdBy ?? null,
      occurred_at: it.createdAt ?? args.fallbackOccurredAt ?? null,
      metadata: { source: 'negocio_observacao', obs_id: it.obsId },
    }))

  const skipped = items.length - toInsert.length
  if (toInsert.length === 0) return { created: 0, skipped }

  const { error } = await supabase.from('leads_activities').insert(toInsert)
  if (error) throw new Error(error.message)

  return { created: toInsert.length, skipped }
}
