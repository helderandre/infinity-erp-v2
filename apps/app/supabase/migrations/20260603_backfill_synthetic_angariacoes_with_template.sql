-- 20260603_backfill_synthetic_angariacoes_with_template.sql
--
-- The 2026-06-03 backfill of synthetic angariações for published imóveis
-- (see 20260603_backfill_published_property_angariacao_processes.sql) created
-- 59 placeholder proc_instances at current_status='completed' but with
-- tpl_process_id=NULL, so the Pipeline tab rendered "Pipeline não disponível —
-- O processo precisa de ser aprovado antes de ter tarefas." That's a misleading
-- empty-state for a process that's already completed.
--
-- This migration wires the single active angariação template onto each of
-- those 59 rows, populates the template's tasks via populate_process_tasks(),
-- and marks every populated task + subtask as completed so the Pipeline tab
-- shows a uniform 100%-completed process with full task visibility.
--
-- Idempotent — picks up only synthetics that haven't been wired yet
-- (tpl_process_id IS NULL).
--
-- Note: hardcoded subtasks (the populateSubtasks() registry) live in
-- TypeScript, not SQL, so they aren't materialised by this migration. That's
-- fine — these are placeholders, not real workflow rows. New synthetics
-- created via POST /api/properties go through autoActivateProcess() which
-- DOES populate the hardcoded subtasks.
--
-- Revert: DELETE FROM proc_tasks/proc_subtasks for the affected instances and
-- UNSET tpl_process_id back to NULL — but the rows remain valid placeholders.

DO $$
DECLARE
  v_template_id uuid;
  v_instance record;
  v_now timestamptz := now();
BEGIN
  SELECT id INTO v_template_id
  FROM tpl_processes
  WHERE process_type = 'angariacao'
    AND is_active = true
    AND deleted_at IS NULL
  LIMIT 1;

  IF v_template_id IS NULL THEN
    RAISE EXCEPTION 'Sem template activo de angariação — abortar backfill';
  END IF;

  FOR v_instance IN
    SELECT id FROM proc_instances
    WHERE is_synthetic = true
      AND process_type = 'angariacao'
      AND tpl_process_id IS NULL
      AND deleted_at IS NULL
  LOOP
    UPDATE proc_instances
    SET tpl_process_id = v_template_id,
        started_at = COALESCE(started_at, v_now)
    WHERE id = v_instance.id;

    PERFORM populate_process_tasks(v_instance.id);

    UPDATE proc_subtasks
    SET is_completed = true,
        completed_at = v_now
    WHERE proc_task_id IN (
      SELECT id FROM proc_tasks WHERE proc_instance_id = v_instance.id
    );

    UPDATE proc_tasks
    SET status = 'completed',
        completed_at = v_now
    WHERE proc_instance_id = v_instance.id
      AND (status IS NULL OR status <> 'completed');

    UPDATE proc_instances
    SET percent_complete = 100,
        current_status = 'completed',
        completed_at = COALESCE(completed_at, v_now)
    WHERE id = v_instance.id;
  END LOOP;
END $$;
