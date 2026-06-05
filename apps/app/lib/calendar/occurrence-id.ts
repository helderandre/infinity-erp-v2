// Helpers para o ID composto de ocorrências de eventos recorrentes.
//
// O endpoint GET /api/calendar/events expande um evento recorrente (1 linha em
// `calendar_events`) em várias ocorrências sintéticas, cada uma com um ID
// composto `${event_id}_${occ.toISOString()}` — ex:
//   "550e8400-e29b-41d4-a716-446655440000_2026-03-15T10:00:00.000Z"
//
// Um UUID nunca contém "_" e a string ISO também não, por isso o split no
// PRIMEIRO "_" separa de forma segura o ID real do evento da data da ocorrência.
// Eventos não-recorrentes têm o UUID puro (occurrenceDate = null).

export interface ParsedOccurrenceId {
  /** UUID real da linha em calendar_events. */
  eventId: string
  /** ISO da ocorrência específica, ou null para eventos não-recorrentes. */
  occurrenceDate: string | null
}

export function parseOccurrenceId(compositeId: string): ParsedOccurrenceId {
  const id = compositeId.replace(/^manual:/, '')
  const sepIndex = id.indexOf('_')
  if (sepIndex === -1) {
    return { eventId: id, occurrenceDate: null }
  }
  return {
    eventId: id.slice(0, sepIndex),
    occurrenceDate: id.slice(sepIndex + 1),
  }
}
