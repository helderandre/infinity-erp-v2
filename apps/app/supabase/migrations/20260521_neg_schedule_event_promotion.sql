-- ==================================================================
-- MIGRATION: neg_schedule_event_promotion
-- ==================================================================
-- Promove a subtask "Escritura agendada" (Stage 3 "Pré-Escritura",
-- task "Agendar escritura") de `type=checklist` para `type=schedule_event`
-- e remove o hint placeholder.
--
-- Ao concluir esta subtask, o endpoint
-- `POST /api/processes/[id]/tasks/[taskId]/subtasks/[subtaskId]/schedule-event`
-- (já existente, genérico) cria/actualiza um row em `calendar_events`.
-- A partir desta migration + extensão do endpoint (commit acompanhante),
-- também sincroniza `deal_events.scheduled_at` da row matching para o
-- deal — derivada do `parent_task.config.hook='schedule_escritura'`.
--
-- ADITIVA. Idempotente via `jsonb_set` (sobrescreve `type`).
-- ==================================================================

WITH neg_proc AS (
  SELECT id FROM public.tpl_processes
  WHERE process_type='negocio' AND name='Processo de Negócio'
  LIMIT 1
)
UPDATE public.tpl_subtasks st
SET config = (st.config - 'hint')
           || jsonb_build_object('type', 'schedule_event')
FROM public.tpl_tasks t
JOIN public.tpl_stages s ON t.tpl_stage_id = s.id
JOIN neg_proc np ON s.tpl_process_id = np.id
WHERE st.tpl_task_id = t.id
  AND s.name = 'Pré-Escritura'
  AND t.title = 'Agendar escritura'
  AND st.title = 'Escritura agendada'
  AND (st.config->>'type') = 'checklist';

-- ==================================================================
-- REVERT
-- ==================================================================
-- UPDATE tpl_subtasks SET config = (config - 'event_type')
--   || jsonb_build_object('type', 'checklist',
--      'hint', 'Promovido a type=schedule_event quando o populate engine suportar materialização em deal_events.')
-- WHERE title = 'Escritura agendada' AND ... (filtros equivalentes acima);
