-- 20260628_leads_entries_no_answer_statuses.sql
--
-- Adds two early-funnel call-attempt stages to the Leads pipeline
-- (kanban of `leads_entries`), inserted BEFORE "Contactado":
--
--   Novo → Não atendeu → Não atendeu 2+ → Contactado → Qualificado (→ Perdido)
--
-- Motivação: o consultor liga a uma lead, ninguém atende, e até agora não
-- tinha forma de registar "liguei uma vez, fica pendente de 2.º contacto".
-- Estas duas fases permitem mover a lead para "Não atendeu" (1.ª tentativa)
-- e "Não atendeu 2+" (tentativas seguintes) sem a marcar como contactada.
--
-- Apenas relaxa o CHECK `chk_entry_status` para aceitar os 2 novos valores.
-- Aditivo — nenhuma linha existente é alterada (mantêm new/seen/processing/
-- converted/discarded). Sem default novo (continua 'new').
--
-- REVERT:
--   ALTER TABLE public.leads_entries DROP CONSTRAINT IF EXISTS chk_entry_status;
--   ALTER TABLE public.leads_entries ADD CONSTRAINT chk_entry_status
--     CHECK (status = ANY (ARRAY['new','seen','processing','converted','discarded']));
--   (só seguro se não existirem linhas em 'no_answer'/'no_answer_2plus').

ALTER TABLE public.leads_entries DROP CONSTRAINT IF EXISTS chk_entry_status;

ALTER TABLE public.leads_entries
  ADD CONSTRAINT chk_entry_status
  CHECK (status = ANY (ARRAY[
    'new'::text,
    'seen'::text,
    'no_answer'::text,
    'no_answer_2plus'::text,
    'processing'::text,
    'converted'::text,
    'discarded'::text
  ]));
