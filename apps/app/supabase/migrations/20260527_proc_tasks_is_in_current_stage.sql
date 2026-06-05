-- Denormaliza visibilidade da stage corrente em proc_tasks.
--
-- Adiciona `proc_tasks.is_in_current_stage BOOLEAN`, sincronizado por
-- trigger sempre que (a) uma proc_task é inserida/actualizada nas
-- colunas relevantes ou (b) `current_stage_id` da `proc_instance`
-- parent muda. Permite filtro PostgREST barato (`.eq()`) em
-- /api/tasks e em /api/tasks/stats — substitui o flatMap in-memory
-- e torna os counts/badges coerentes com o inbox real.
--
-- Regra:
--   - stage_order_index IS NULL (ad-hoc) → TRUE (sempre visível)
--   - proc_instance sem current_stage_id → TRUE (defensivo)
--   - stage_order_index = current_stage.order_index → TRUE
--   - caso contrário → FALSE (stage futura, escondida no inbox)
--
-- Revert:
--   DROP TRIGGER IF EXISTS trg_proc_instances_recompute_task_flags ON proc_instances;
--   DROP TRIGGER IF EXISTS trg_proc_tasks_set_current_stage ON proc_tasks;
--   DROP FUNCTION IF EXISTS public.trg_proc_instances_recompute_task_flags();
--   DROP FUNCTION IF EXISTS public.trg_proc_tasks_set_current_stage();
--   DROP FUNCTION IF EXISTS public.compute_proc_task_in_current_stage(uuid, integer);
--   DROP INDEX IF EXISTS public.idx_proc_tasks_current_stage_assignee;
--   ALTER TABLE proc_tasks DROP COLUMN IF EXISTS is_in_current_stage;

ALTER TABLE proc_tasks
  ADD COLUMN IF NOT EXISTS is_in_current_stage BOOLEAN NOT NULL DEFAULT TRUE;

CREATE OR REPLACE FUNCTION public.compute_proc_task_in_current_stage(
  p_proc_instance_id UUID,
  p_stage_order_index INTEGER
) RETURNS BOOLEAN
LANGUAGE plpgsql STABLE AS $fn$
DECLARE
  v_current_order INTEGER;
BEGIN
  IF p_stage_order_index IS NULL THEN
    RETURN TRUE;
  END IF;
  SELECT s.order_index INTO v_current_order
  FROM proc_instances pi
  LEFT JOIN tpl_stages s ON s.id = pi.current_stage_id
  WHERE pi.id = p_proc_instance_id;
  IF v_current_order IS NULL THEN
    RETURN TRUE;
  END IF;
  RETURN p_stage_order_index = v_current_order;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.trg_proc_tasks_set_current_stage()
RETURNS TRIGGER LANGUAGE plpgsql AS $fn$
BEGIN
  NEW.is_in_current_stage := public.compute_proc_task_in_current_stage(
    NEW.proc_instance_id, NEW.stage_order_index
  );
  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS trg_proc_tasks_set_current_stage ON proc_tasks;
CREATE TRIGGER trg_proc_tasks_set_current_stage
  BEFORE INSERT OR UPDATE OF stage_order_index, proc_instance_id ON proc_tasks
  FOR EACH ROW EXECUTE FUNCTION public.trg_proc_tasks_set_current_stage();

CREATE OR REPLACE FUNCTION public.trg_proc_instances_recompute_task_flags()
RETURNS TRIGGER LANGUAGE plpgsql AS $fn$
BEGIN
  IF NEW.current_stage_id IS DISTINCT FROM OLD.current_stage_id THEN
    UPDATE proc_tasks
       SET is_in_current_stage = public.compute_proc_task_in_current_stage(NEW.id, stage_order_index)
     WHERE proc_instance_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS trg_proc_instances_recompute_task_flags ON proc_instances;
CREATE TRIGGER trg_proc_instances_recompute_task_flags
  AFTER UPDATE OF current_stage_id ON proc_instances
  FOR EACH ROW EXECUTE FUNCTION public.trg_proc_instances_recompute_task_flags();

CREATE INDEX IF NOT EXISTS idx_proc_tasks_current_stage_assignee
  ON proc_tasks(assigned_to, is_in_current_stage)
  WHERE is_in_current_stage = TRUE;

-- Backfill linhas existentes
UPDATE proc_tasks
   SET is_in_current_stage = public.compute_proc_task_in_current_stage(proc_instance_id, stage_order_index);
