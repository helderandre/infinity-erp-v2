-- ==================================================================
-- MIGRATION: neg_buyer_tasks_repeat_per_client
-- ==================================================================
-- Adiciona `repeat_per_client: true` + `person_type_filter` ao config
-- das tasks "Documentos do Comprador (Singular)" e "(Empresa)" no
-- template PROC-NEG. Lido pelo helper
-- `lib/processes/neg/repeat-tasks-per-client.ts` que corre no submit
-- de cada deal (após o bypass post-processor) e clona a task uma vez
-- por `deal_clients` matching.
--
-- Não toca em proc_tasks já existentes — o helper só corre em
-- proc_instances novos (criados via /api/deals/[id]/submit). Para
-- backfill manual em deals já submetidos, chamar o helper directamente
-- via script.
--
-- ADITIVA. Idempotente via `||` operator (concat de jsonb sobrescreve
-- chaves existentes; aplicar 2× não duplica nada).
-- ==================================================================

UPDATE public.tpl_tasks
SET config = COALESCE(config, '{}'::jsonb)
           || '{"repeat_per_client": true, "person_type_filter": "singular"}'::jsonb
WHERE tpl_stage_id IN (
  SELECT s.id
  FROM public.tpl_stages s
  JOIN public.tpl_processes p ON s.tpl_process_id = p.id
  WHERE p.process_type = 'negocio'
    AND p.name        = 'Processo de Negócio'
    AND s.name        = 'Recolha Documental'
)
AND title = 'Documentos do Comprador (Singular)';

UPDATE public.tpl_tasks
SET config = COALESCE(config, '{}'::jsonb)
           || '{"repeat_per_client": true, "person_type_filter": "coletiva"}'::jsonb
WHERE tpl_stage_id IN (
  SELECT s.id
  FROM public.tpl_stages s
  JOIN public.tpl_processes p ON s.tpl_process_id = p.id
  WHERE p.process_type = 'negocio'
    AND p.name        = 'Processo de Negócio'
    AND s.name        = 'Recolha Documental'
)
AND title = 'Documentos do Comprador (Empresa)';

-- ==================================================================
-- REVERT
-- ==================================================================
-- UPDATE public.tpl_tasks
-- SET config = config - 'repeat_per_client' - 'person_type_filter'
-- WHERE title IN ('Documentos do Comprador (Singular)', 'Documentos do Comprador (Empresa)')
--   AND tpl_stage_id IN (
--     SELECT s.id FROM public.tpl_stages s
--     JOIN public.tpl_processes p ON s.tpl_process_id = p.id
--     WHERE p.process_type='negocio' AND p.name='Processo de Negócio'
--   );
