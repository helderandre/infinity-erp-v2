-- PROC-NEG hardcoded handoff — task skeleton stays SQL-seeded; subtasks move to the registry.
--
-- ⚠️ DEPLOY-TIME ONLY — apply TOGETHER with the code that wires
--    populateSubtasks(.,.,'negocio') into POST /api/deals/[id]/submit.
--    The RPC populate_process_tasks seeds proc_tasks from tpl_tasks AND
--    proc_subtasks from tpl_subtasks. After this migration there are no
--    negócio tpl_subtasks, so the hardcoded registry MUST own them — applying
--    this before the code ships would make new negócio submits create tasks
--    with zero subtasks. Safe vs data: 0 live PROC-NEG proc_instances
--    (memory `proc-neg-greenfield`).
--
-- Does two things:
--   1) Disambiguates duplicate task titles so `taskKind` ↔ `proc_tasks.title`
--      is 1:1. "Foto e descrição IA do momento" and "Pagamento aos consultores
--      e parceiros" each exist in BOTH the CPCV (stage 2) and Escritura
--      (stage 4) stages; the registry needs distinct kinds (distinct
--      moment_type / payment moment).
--   2) Deletes the 48 negócio tpl_subtasks (the registry owns subtasks now).
--
-- REVERT: re-run 20260517_neg_process_template.sql subtask inserts + rename the
--   4 tasks back to their non-suffixed titles.

DO $$
DECLARE
  v_tpl uuid := 'ca943474-2514-4781-b91f-83e76a8b7831';
  v_stage2 uuid;
  v_stage4 uuid;
BEGIN
  SELECT id INTO v_stage2 FROM tpl_stages WHERE tpl_process_id = v_tpl AND order_index = 2;
  SELECT id INTO v_stage4 FROM tpl_stages WHERE tpl_process_id = v_tpl AND order_index = 4;

  UPDATE tpl_tasks SET title = 'Foto e descrição IA do momento (CPCV)'
   WHERE tpl_stage_id = v_stage2 AND title = 'Foto e descrição IA do momento';
  UPDATE tpl_tasks SET title = 'Foto e descrição IA do momento (Escritura)'
   WHERE tpl_stage_id = v_stage4 AND title = 'Foto e descrição IA do momento';
  UPDATE tpl_tasks SET title = 'Pagamento aos consultores e parceiros (CPCV)'
   WHERE tpl_stage_id = v_stage2 AND title = 'Pagamento aos consultores e parceiros';
  UPDATE tpl_tasks SET title = 'Pagamento aos consultores e parceiros (Escritura)'
   WHERE tpl_stage_id = v_stage4 AND title = 'Pagamento aos consultores e parceiros';

  DELETE FROM tpl_subtasks ts
   USING tpl_tasks tt, tpl_stages st
   WHERE ts.tpl_task_id = tt.id
     AND tt.tpl_stage_id = st.id
     AND st.tpl_process_id = v_tpl;
END $$;
