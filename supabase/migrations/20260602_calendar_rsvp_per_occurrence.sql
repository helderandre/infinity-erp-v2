-- 20260602_calendar_rsvp_per_occurrence.sql
--
-- RSVP por ocorrência para eventos recorrentes.
--
-- Problema: `calendar_event_rsvp` era único por (event_id, user_id), portanto um
-- evento recorrente (1 linha em calendar_events, expandido em N ocorrências no
-- calendário) só conseguia guardar UMA resposta para toda a série. Pior: o
-- frontend enviava o ID composto da ocorrência ("<uuid>_<iso>") ao endpoint de
-- RSVP, que falhava o lookup `.eq('id', ...)` e nunca gravava nada (404 silencioso).
--
-- Fix: adicionar `occurrence_date` (NULL para eventos não-recorrentes — uma única
-- ocorrência) e tornar a unicidade por (event_id, user_id, occurrence_date).
-- Como NULLs não são tratados como iguais por uma UNIQUE constraint normal,
-- usamos um índice funcional com COALESCE para um sentinela ('epoch'), garantindo
-- "uma resposta por (evento, utilizador, NULL)" para os não-recorrentes.
--
-- NOTA: o índice funcional não casa com o `onConflict` do PostgREST, por isso o
-- endpoint faz upsert manual (find + update/insert). Ver app/api/calendar/events/[id]/rsvp/route.ts.
--
-- Aditiva: linhas existentes ficam com occurrence_date = NULL (continuam válidas
-- como a resposta da série/evento simples).
--
-- Revert:
--   DROP INDEX IF EXISTS calendar_event_rsvp_occurrence_uniq;
--   ALTER TABLE calendar_event_rsvp ADD CONSTRAINT calendar_event_rsvp_event_id_user_id_key UNIQUE (event_id, user_id);
--   ALTER TABLE calendar_event_rsvp DROP COLUMN IF EXISTS occurrence_date;

ALTER TABLE calendar_event_rsvp
  ADD COLUMN IF NOT EXISTS occurrence_date timestamptz;

ALTER TABLE calendar_event_rsvp
  DROP CONSTRAINT IF EXISTS calendar_event_rsvp_event_id_user_id_key;

CREATE UNIQUE INDEX IF NOT EXISTS calendar_event_rsvp_occurrence_uniq
  ON calendar_event_rsvp (event_id, user_id, COALESCE(occurrence_date, 'epoch'::timestamptz));
