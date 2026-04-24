-- ==================================================================
-- MIGRATION: split_armazenar_documentos_task
-- ==================================================================
-- Alinha o template de angariação (tpl_process `c8cd3fcb-...`) com a
-- UI correcta: a task única "Armazenar documentos" é dividida em três
-- grupos distintos de documentação por entidade:
--
--   1. "Documentos do Imóvel"            (renomeação da task existente,
--      preservando `tpl_task_id = c51cf081-...` para não quebrar FKs
--      dos 3 processos activos que já a referenciam em `proc_tasks`)
--   2. "Documentos Pessoa Colectiva"     (NOVA — para owners person_type='coletiva')
--   3. "Documentos Pessoa Singular"      (NOVA — para owners person_type='singular')
--
-- Subtasks antigas (5 rows, todas com scope owner-based genérico)
-- são APAGADAS (`proc_subtasks.tpl_subtask_id` tem FK ON DELETE SET NULL,
-- pelo que as 15 linhas de proc_subtasks existentes ficam com NULL
-- mas continuam válidas porque `subtask_key` já foi backfilled em
-- `20260501_proc_subtasks_hardcoded.sql` como `legacy_tpl_<uuid>`).
--
-- 19 subtasks novas são inseridas distribuídas por 3 grupos: 7 Imóvel,
-- 7 Colectiva, 5 Singular. Replicam o que a UI do produto apresenta:
--
--   Imóvel (7):
--     - Certificado Energético (upload)
--     - Caderneta Predial Urbana (upload)
--     - Certidão Permanente (upload)
--     - Licença de Utilização (upload, hint "post-1951")
--     - Ficha Técnica de Habitação (upload, hint "post-2004")
--     - Planta do Imóvel (upload)
--     - Hipoteca — valor em dívida (field, se aplicável)
--
--   Pessoa Colectiva (7):
--     - Certidão Comercial da Empresa (upload)     [usa doc_type "Certidão Permanente da Empresa"]
--     - RCBE (upload)
--     - CC / Passaporte do representante legal (upload)
--     - Naturalidade do representante legal (field)
--     - Morada atual do representante legal (field)
--     - Estado civil do representante legal (field)
--     - Ficha de Branqueamento (Empresa) (upload)
--
--   Pessoa Singular (5):
--     - Cartão de Cidadão / Passaporte (upload)
--     - Naturalidade — freguesia e concelho (field)
--     - Morada atual (field)
--     - Estado civil (field)
--     - Ficha de Branqueamento de Capitais (upload, "uma por proprietário")
--
-- NOTA importante: as 3 proc_tasks existentes que apontam para a task
-- `c51cf081-...` vão passar a mostrar o novo título "Documentos do
-- Imóvel" nos processos activos. O populate_process_tasks() só copia o
-- título na criação — os proc_tasks existentes mantêm o título antigo
-- no campo `proc_tasks.title`. Isto é intencional: os processos
-- activos não têm as 7 subtasks de imóvel, só as 5 legacy; para os
-- migrar convenientemente correr o `populate-angariacao` endpoint +
-- backfill script (idempotente via supersedesTplSubtaskId).
--
-- REVERT:
--   1. DELETE FROM tpl_subtasks WHERE tpl_task_id IN (
--        '11111111-...-coletiva-uuid', '11111111-...-singular-uuid');
--   2. DELETE FROM tpl_tasks WHERE id IN
--        ('11111111-...-coletiva-uuid', '11111111-...-singular-uuid');
--   3. UPDATE tpl_tasks SET title='Armazenar documentos'
--        WHERE id='c51cf081-06cc-4d70-80a9-9e97563cc776';
--   4. UPDATE tpl_tasks SET order_index = order_index - 2
--        WHERE tpl_stage_id='e203caef-885c-48ff-a3df-9017bbe7222f'
--          AND order_index >= 4;
--   5. Re-INSERT as 5 tpl_subtasks antigas (ver backup deste ficheiro).
-- ==================================================================

DO $$
DECLARE
  v_stage_id uuid := 'e203caef-885c-48ff-a3df-9017bbe7222f';
  v_task_imovel_id uuid := 'c51cf081-06cc-4d70-80a9-9e97563cc776'; -- preservado
  v_task_coletiva_id uuid;
  v_task_singular_id uuid;
BEGIN
  -- ────────────────────────────────────────────────────────────────
  -- 1. RENAME tpl_task existente
  -- ────────────────────────────────────────────────────────────────
  UPDATE public.tpl_tasks
    SET title = 'Documentos do Imóvel',
        description = 'Documentos obrigatórios do imóvel (certificado energético, caderneta predial, certidão permanente, etc.)'
  WHERE id = v_task_imovel_id;

  -- ────────────────────────────────────────────────────────────────
  -- 2. SHIFT order_index das tasks subsequentes (+= 2)
  -- ────────────────────────────────────────────────────────────────
  UPDATE public.tpl_tasks
    SET order_index = order_index + 2
  WHERE tpl_stage_id = v_stage_id
    AND order_index >= 2;

  -- ────────────────────────────────────────────────────────────────
  -- 3. INSERT 2 novas tpl_tasks (Coletiva + Singular)
  -- ────────────────────────────────────────────────────────────────
  INSERT INTO public.tpl_tasks (id, tpl_stage_id, title, description, action_type, is_mandatory, order_index, priority, config)
  VALUES
    (gen_random_uuid(), v_stage_id, 'Documentos Pessoa Colectiva',
     'Documentação específica de proprietários do tipo pessoa colectiva (empresas).',
     'COMPOSITE', true, 2, 'normal', '{}'::jsonb)
  RETURNING id INTO v_task_coletiva_id;

  INSERT INTO public.tpl_tasks (id, tpl_stage_id, title, description, action_type, is_mandatory, order_index, priority, config)
  VALUES
    (gen_random_uuid(), v_stage_id, 'Documentos Pessoa Singular',
     'Documentação específica de proprietários do tipo pessoa singular.',
     'COMPOSITE', true, 3, 'normal', '{}'::jsonb)
  RETURNING id INTO v_task_singular_id;

  -- ────────────────────────────────────────────────────────────────
  -- 4. DELETE das 5 tpl_subtasks antigas de "Armazenar documentos"
  --    (FK proc_subtasks.tpl_subtask_id é ON DELETE SET NULL,
  --    então os proc_subtasks existentes ficam órfãos mas válidos —
  --    o subtask_key backfilled preserva a identidade.)
  -- ────────────────────────────────────────────────────────────────
  DELETE FROM public.tpl_subtasks
  WHERE tpl_task_id = v_task_imovel_id;

  -- ────────────────────────────────────────────────────────────────
  -- 5. INSERT 19 novas tpl_subtasks (7 Imóvel + 7 Colectiva + 5 Singular)
  -- ────────────────────────────────────────────────────────────────

  -- ─── Grupo Imóvel (7) ────────────────────────────────────────────
  INSERT INTO public.tpl_subtasks (tpl_task_id, title, is_mandatory, order_index, priority, dependency_type, config) VALUES
    (v_task_imovel_id, 'Certificado Energético', true, 0, 'normal', 'none',
      '{"type":"upload","doc_type_id":"b201aa0e-fa71-4ca7-88d7-1372bd351aa5"}'::jsonb),
    (v_task_imovel_id, 'Caderneta Predial Urbana', true, 1, 'normal', 'none',
      '{"type":"upload","doc_type_id":"5da10e4a-80bb-4f24-93a8-1e9731e20071"}'::jsonb),
    (v_task_imovel_id, 'Certidão Permanente', true, 2, 'normal', 'none',
      '{"type":"upload","doc_type_id":"09eac23e-8d32-46f3-9ad8-f579d8d8bf9f"}'::jsonb),
    (v_task_imovel_id, 'Licença de Utilização', false, 3, 'normal', 'none',
      '{"type":"upload","doc_type_id":"b326071d-8e8c-43e4-b74b-a377e76b94dc","hint":"Obrigatório para imóveis posteriores a 07 de Agosto de 1951"}'::jsonb),
    (v_task_imovel_id, 'Ficha Técnica de Habitação', false, 4, 'normal', 'none',
      '{"type":"upload","doc_type_id":"f4df68d0-f833-4d18-ad61-f30c699c22d6","hint":"Obrigatória para imóveis posteriores a 1 de Abril de 2004"}'::jsonb),
    (v_task_imovel_id, 'Planta do Imóvel', true, 5, 'normal', 'none',
      '{"type":"upload","doc_type_id":"afde278e-3c7e-4214-a779-588778023dc6"}'::jsonb),
    (v_task_imovel_id, 'Hipoteca — valor em dívida (se aplicável)', false, 6, 'normal', 'none',
      '{"type":"field","hint":"Indicar se existe hipoteca e, em caso afirmativo, valor aproximado em dívida","field":{"label":"Hipoteca em dívida","field_name":"mortgage_balance","field_type":"currency","order_index":0,"target_entity":"property_internal"}}'::jsonb);

  -- ─── Grupo Pessoa Colectiva (7) ──────────────────────────────────
  INSERT INTO public.tpl_subtasks (tpl_task_id, title, is_mandatory, order_index, priority, dependency_type, config) VALUES
    (v_task_coletiva_id, 'Certidão Comercial da Empresa', true, 0, 'normal', 'none',
      '{"type":"upload","doc_type_id":"e433c9f1-b323-43ac-9607-05b31f72bbb9","owner_scope":"all_owners","person_type_filter":"coletiva","hint":"Código de acesso válido"}'::jsonb),
    (v_task_coletiva_id, 'RCBE', true, 1, 'normal', 'none',
      '{"type":"upload","doc_type_id":"6dd8bf4c-d354-4e0e-8098-eda5a8767fd1","owner_scope":"all_owners","person_type_filter":"coletiva","hint":"Código de acesso válido"}'::jsonb),
    (v_task_coletiva_id, 'CC / Passaporte do representante legal', true, 2, 'normal', 'none',
      '{"type":"upload","doc_type_id":"16706cb5-1a27-413d-ad75-ec6aee1c3674","owner_scope":"all_owners","person_type_filter":"coletiva"}'::jsonb),
    (v_task_coletiva_id, 'Naturalidade do representante legal', true, 3, 'normal', 'none',
      '{"type":"field","owner_scope":"all_owners","person_type_filter":"coletiva","field":{"label":"Naturalidade do representante legal","field_name":"legal_rep_naturality","field_type":"text","order_index":0,"target_entity":"owner"}}'::jsonb),
    (v_task_coletiva_id, 'Morada atual do representante legal', true, 4, 'normal', 'none',
      '{"type":"field","owner_scope":"all_owners","person_type_filter":"coletiva","field":{"label":"Morada atual do representante legal","field_name":"legal_rep_address","field_type":"textarea","order_index":0,"target_entity":"owner"}}'::jsonb),
    (v_task_coletiva_id, 'Estado civil do representante legal', true, 5, 'normal', 'none',
      '{"type":"field","owner_scope":"all_owners","person_type_filter":"coletiva","field":{"label":"Estado civil do representante legal","field_name":"legal_rep_marital_status","field_type":"text","order_index":0,"target_entity":"owner"}}'::jsonb),
    (v_task_coletiva_id, 'Ficha de Branqueamento (Empresa)', true, 6, 'normal', 'none',
      '{"type":"upload","doc_type_id":"f9a3ee8f-04a6-40f0-aae0-021ae7c48c6d","owner_scope":"all_owners","person_type_filter":"coletiva"}'::jsonb);

  -- ─── Grupo Pessoa Singular (5) ───────────────────────────────────
  INSERT INTO public.tpl_subtasks (tpl_task_id, title, is_mandatory, order_index, priority, dependency_type, config) VALUES
    (v_task_singular_id, 'Cartão de Cidadão / Passaporte', true, 0, 'normal', 'none',
      '{"type":"upload","doc_type_id":"16706cb5-1a27-413d-ad75-ec6aee1c3674","owner_scope":"all_owners","person_type_filter":"singular"}'::jsonb),
    (v_task_singular_id, 'Naturalidade (freguesia e concelho)', true, 1, 'normal', 'none',
      '{"type":"field","owner_scope":"all_owners","person_type_filter":"singular","field":{"label":"Naturalidade (freguesia e concelho)","field_name":"naturality","field_type":"text","order_index":0,"target_entity":"owner"}}'::jsonb),
    (v_task_singular_id, 'Morada atual', true, 2, 'normal', 'none',
      '{"type":"field","owner_scope":"all_owners","person_type_filter":"singular","field":{"label":"Morada atual","field_name":"address","field_type":"textarea","order_index":0,"target_entity":"owner"}}'::jsonb),
    (v_task_singular_id, 'Estado civil', true, 3, 'normal', 'none',
      '{"type":"field","owner_scope":"all_owners","person_type_filter":"singular","field":{"label":"Estado civil","field_name":"marital_status","field_type":"text","order_index":0,"target_entity":"owner"}}'::jsonb),
    (v_task_singular_id, 'Ficha de Branqueamento de Capitais', true, 4, 'normal', 'none',
      '{"type":"upload","doc_type_id":"02b63b46-d5ed-4314-9e83-1447095f8a15","owner_scope":"all_owners","person_type_filter":"singular","hint":"Uma por proprietário, mesmo em caso de casados"}'::jsonb);

END $$;
