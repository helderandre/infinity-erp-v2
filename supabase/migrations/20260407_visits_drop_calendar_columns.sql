-- Drop colunas vestigiais da tabela `visits`.
--
-- Estas colunas existiam para guardar a referência ao evento do calendário
-- criado/sincronizado a partir de cada visita. Após o refactor que tornou
-- a `visits` a única fonte da verdade (o aggregator do calendário em
-- /api/calendar/events projecta as visitas em runtime via `visit_id`),
-- estas colunas deixaram de ter qualquer uso.
--
-- - `calendar_event_id`     — ligava à tabela `calendar_events` (FK órfão)
-- - `external_calendar_id`  — placeholder para sincronização com Google Calendar
--                              (nunca foi implementado nesta versão)
--
-- Nenhuma linha em produção tinha estas colunas preenchidas (`calendar_event_id`
-- foi escrito sempre como NULL porque o INSERT antigo apontava para uma tabela
-- inexistente `temp_calendar_events`, falhando silenciosamente).

ALTER TABLE visits
  DROP COLUMN IF EXISTS calendar_event_id,
  DROP COLUMN IF EXISTS external_calendar_id;
