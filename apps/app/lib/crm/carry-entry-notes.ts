// Carrega as notas de texto livre de uma lead entry para a timeline do
// contacto quando a entrada é convertida. Sem isto, as notas ficam órfãs em
// `leads_entries.notes` — a entrada sai da inbox depois da conversão e o
// consultor que recebe o contacto perde o histórico ("Histórico: ...",
// "23.09 desmarcou visita", etc.).
//
// Idempotente: dedup via metadata.entry_id + metadata.event, por isso pode
// ser chamado em qualquer caminho de conversão (qualificação via dialog,
// PATCH manual de status, backfill) sem duplicar notas.
// Best-effort: nunca lança — uma falha aqui não pode abortar a conversão.

interface CarryEntryNotesOpts {
  entryId: string
  contactId: string | null | undefined
  notes: string | null | undefined
  /** Data do registo original da entrada — usada como occurred_at da nota. */
  entryCreatedAt?: string | null
  /** Negócio criado na qualificação, para a nota aparecer também no feed do negócio. */
  negocioId?: string | null
  createdBy?: string | null
}

export async function carryEntryNotesToContact(
  supabase: any,
  opts: CarryEntryNotesOpts,
): Promise<{ carried: boolean }> {
  try {
    const text = (opts.notes ?? '').trim()
    if (!opts.contactId || !text) return { carried: false }

    const { data: existing } = await supabase
      .from('leads_activities')
      .select('id')
      .eq('contact_id', opts.contactId)
      .eq('metadata->>event', 'entry_notes_carryover')
      .eq('metadata->>entry_id', opts.entryId)
      .limit(1)

    if (existing && existing.length > 0) return { carried: false }

    const { error } = await supabase.from('leads_activities').insert({
      contact_id: opts.contactId,
      negocio_id: opts.negocioId ?? null,
      activity_type: 'note',
      subject: 'Notas do registo da lead',
      description: text,
      occurred_at: opts.entryCreatedAt ?? new Date().toISOString(),
      created_by: opts.createdBy ?? null,
      metadata: { event: 'entry_notes_carryover', entry_id: opts.entryId },
    })

    if (error) {
      console.error('[carry-entry-notes] insert failed:', error.message)
      return { carried: false }
    }
    return { carried: true }
  } catch (err) {
    console.error('[carry-entry-notes]', err)
    return { carried: false }
  }
}
