-- ==================================================================
-- MIGRATION: neg_ai_caption_promotion
-- ==================================================================
-- Consolida e promove as subtasks de marketing do PROC-NEG.
--
-- Antes: cada task "Foto e descrição IA do momento" (Stages 2 e 4)
-- tinha 2 subtasks `type=checklist`:
--   - "Foto do momento carregada"
--   - "Descrição IA gerada e revista"
--
-- Depois: cada task tem 1 subtask consolidada `type=ai_caption` com
-- `config.moment_type ∈ {cpcv, escritura}`, renderizada por
-- `<SubtaskCardAiCaption>` que combina upload de fotos + geração de
-- legenda IA num só card. Fluxo:
--   1. Consultor carrega fotos → R2 via /upload
--   2. Clica "Gerar com IA" → cria row em deal_marketing_moments
--      com legenda GPT-4o-mini, OU re-gera se já existe
--   3. Edita legenda manualmente, publica em Instagram/LinkedIn
--   4. Ao "Guardar momento" a subtask é marcada is_completed=true
--
-- Operação (em duas fases para preservar ordering):
--   1. UPDATE da primeira subtask ("Foto do momento carregada"):
--      - Renomeia para "Momento de marketing (foto + legenda)"
--      - Muda type='ai_caption'
--      - Adiciona config.moment_type
--   2. DELETE da segunda subtask ("Descrição IA gerada e revista")
--
-- Apenas afecta tpl_subtasks. Proc_subtasks já populadas em
-- proc_instances existentes ficam intactas (continuam a usar checklist).
-- Novos proc_instances vão herdar a estrutura nova.
--
-- ADITIVA / CONSOLIDATIVA. Revert no fim.
-- ==================================================================

-- Stage 2 (CPCV) — task "Foto e descrição IA do momento"
WITH neg_proc AS (
  SELECT id FROM public.tpl_processes
  WHERE process_type='negocio' AND name='Processo de Negócio' LIMIT 1
),
target_task AS (
  SELECT t.id
  FROM public.tpl_tasks t
  JOIN public.tpl_stages s ON t.tpl_stage_id = s.id
  JOIN neg_proc np ON s.tpl_process_id = np.id
  WHERE s.name = 'CPCV' AND t.title = 'Foto e descrição IA do momento'
)
UPDATE public.tpl_subtasks st
SET title = 'Momento de marketing (foto + legenda)',
    config = (st.config - 'hint')
           || jsonb_build_object('type', 'ai_caption', 'moment_type', 'cpcv')
WHERE st.tpl_task_id IN (SELECT id FROM target_task)
  AND st.title = 'Foto do momento carregada';

WITH neg_proc AS (
  SELECT id FROM public.tpl_processes
  WHERE process_type='negocio' AND name='Processo de Negócio' LIMIT 1
),
target_task AS (
  SELECT t.id
  FROM public.tpl_tasks t
  JOIN public.tpl_stages s ON t.tpl_stage_id = s.id
  JOIN neg_proc np ON s.tpl_process_id = np.id
  WHERE s.name = 'CPCV' AND t.title = 'Foto e descrição IA do momento'
)
DELETE FROM public.tpl_subtasks st
WHERE st.tpl_task_id IN (SELECT id FROM target_task)
  AND st.title = 'Descrição IA gerada e revista';

-- Stage 4 (Escritura) — task "Foto e descrição IA do momento"
WITH neg_proc AS (
  SELECT id FROM public.tpl_processes
  WHERE process_type='negocio' AND name='Processo de Negócio' LIMIT 1
),
target_task AS (
  SELECT t.id
  FROM public.tpl_tasks t
  JOIN public.tpl_stages s ON t.tpl_stage_id = s.id
  JOIN neg_proc np ON s.tpl_process_id = np.id
  WHERE s.name = 'Escritura / Contrato Final' AND t.title = 'Foto e descrição IA do momento'
)
UPDATE public.tpl_subtasks st
SET title = 'Momento de marketing (foto + legenda)',
    config = (st.config - 'hint')
           || jsonb_build_object('type', 'ai_caption', 'moment_type', 'escritura')
WHERE st.tpl_task_id IN (SELECT id FROM target_task)
  AND st.title = 'Foto do momento carregada';

WITH neg_proc AS (
  SELECT id FROM public.tpl_processes
  WHERE process_type='negocio' AND name='Processo de Negócio' LIMIT 1
),
target_task AS (
  SELECT t.id
  FROM public.tpl_tasks t
  JOIN public.tpl_stages s ON t.tpl_stage_id = s.id
  JOIN neg_proc np ON s.tpl_process_id = np.id
  WHERE s.name = 'Escritura / Contrato Final' AND t.title = 'Foto e descrição IA do momento'
)
DELETE FROM public.tpl_subtasks st
WHERE st.tpl_task_id IN (SELECT id FROM target_task)
  AND st.title = 'Descrição IA gerada e revista';

-- ==================================================================
-- REVERT (manual — re-create the deleted "Descrição IA gerada e revista"
-- subtasks if needed, and reverse the UPDATEs):
--
-- UPDATE public.tpl_subtasks
-- SET title = 'Foto do momento carregada',
--     config = (config - 'moment_type')
--           || jsonb_build_object('type', 'checklist',
--              'hint', 'Promovido a type=upload com photo gallery quando o componente <DealMarketingMomentUpload> estiver pronto.')
-- WHERE title = 'Momento de marketing (foto + legenda)'
--   AND tpl_task_id IN (
--     SELECT t.id FROM tpl_tasks t
--     JOIN tpl_stages s ON t.tpl_stage_id = s.id
--     JOIN tpl_processes p ON s.tpl_process_id = p.id
--     WHERE p.process_type='negocio' AND p.name='Processo de Negócio'
--       AND t.title = 'Foto e descrição IA do momento'
--   );
--
-- INSERT INTO tpl_subtasks (tpl_task_id, title, is_mandatory, order_index, config)
-- SELECT t.id, 'Descrição IA gerada e revista', false, 1,
--        jsonb_build_object('type','checklist','hint','Promovido a type=ai_caption quando o componente estiver pronto.')
-- FROM tpl_tasks t ... (filtro equivalente);
