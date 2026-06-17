-- 20260617_capture_populate_process_tasks_fn.sql
--
-- PROPÓSITO: fechar um schema-drift. A função public.populate_process_tasks(p_instance_id uuid)
-- — chamada em runtime via supabase.rpc('populate_process_tasks', { p_instance_id })
-- em lib/processes/auto-activate.ts e app/api/deals/[id]/submit/route.ts — existe APENAS
-- na base de dados de produção (criada ad-hoc), NUNCA num ficheiro de migration. Se alguém
-- reconstruir a DB a partir do histórico de migrations, TODO o motor de processos parte
-- silenciosamente (angariação + futuro fecho de negócio).
--
-- Esta migration:
--   1. Captura o corpo ACTUAL da função (uuid) tal como está em produção (idempotente —
--      CREATE OR REPLACE com o mesmo corpo é no-op em prod).
--   2. Remove o overload morto populate_process_tasks() RETURNS trigger — verificado
--      (2026-06-17) que NENHUM trigger o referencia (pg_trigger vazio para esta função).
--
-- DEPENDÊNCIA: o corpo chama _populate_subtasks(...), que JÁ está versionado
-- (20260501_fix_populate_subtasks_key.sql + 20260528_proc_tasks_resolve_assignee_from_role.sql).
--
-- NOTA DE ROADMAP: este corpo representa o ESTADO ACTUAL (híbrido) — ainda chama
-- _populate_subtasks, que cria subtarefas `legacy_*` que o motor hardcoded
-- (populateSubtasks) apaga logo a seguir. A Fase 1 da reestruturação ("hardcode total"
-- da angariação) vai REMOVER essas chamadas a _populate_subtasks daqui. Capturar primeiro,
-- modificar depois.
--
-- REVERT:
--   DROP FUNCTION IF EXISTS public.populate_process_tasks(uuid);
--   -- (re-criar o overload trigger() não é recomendado — está morto)

-- 1) Captura da função viva (uuid) — corpo verbatim de produção
CREATE OR REPLACE FUNCTION public.populate_process_tasks(p_instance_id uuid)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_tpl_process_id uuid;
  v_property_id uuid;
  v_task RECORD;
  v_owner RECORD;
  v_owner_type text;
  v_new_task_id uuid;
BEGIN
  SELECT tpl_process_id, property_id
  INTO v_tpl_process_id, v_property_id
  FROM proc_instances WHERE id = p_instance_id;

  IF v_tpl_process_id IS NULL THEN
    RAISE EXCEPTION 'Instância % não encontrada ou sem template', p_instance_id;
  END IF;

  FOR v_task IN
    SELECT
      t.id AS tpl_task_id, t.title, t.action_type, t.config,
      t.is_mandatory, t.assigned_role, t.sla_days, t.priority,
      t.order_index AS task_order,
      s.name AS stage_name, s.order_index AS stage_order,
      t.config->>'owner_type' AS owner_type,
      EXISTS(SELECT 1 FROM tpl_subtasks st WHERE st.tpl_task_id = t.id) AS has_subtasks
    FROM tpl_tasks t
    JOIN tpl_stages s ON t.tpl_stage_id = s.id
    WHERE s.tpl_process_id = v_tpl_process_id
    ORDER BY s.order_index, t.order_index
  LOOP
    v_owner_type := v_task.owner_type;

    IF v_owner_type IS NOT NULL AND v_property_id IS NOT NULL THEN
      -- Multiplicar por proprietário do tipo correspondente
      FOR v_owner IN
        SELECT po.owner_id, o.name AS owner_name, o.person_type
        FROM property_owners po
        JOIN owners o ON o.id = po.owner_id
        WHERE po.property_id = v_property_id
          AND o.person_type = v_owner_type
        ORDER BY po.is_main_contact DESC, o.name
      LOOP
        INSERT INTO proc_tasks (
          proc_instance_id, tpl_task_id, title, action_type, config,
          status, is_mandatory, assigned_role, due_date,
          stage_name, stage_order_index, order_index, owner_id, priority
        ) VALUES (
          p_instance_id, v_task.tpl_task_id,
          v_task.title || ' — ' || v_owner.owner_name,
          v_task.action_type, v_task.config || jsonb_build_object('owner_id', v_owner.owner_id),
          'pending', v_task.is_mandatory, v_task.assigned_role,
          CASE WHEN v_task.sla_days IS NOT NULL THEN NOW() + (v_task.sla_days * interval '1 day') ELSE NULL END,
          v_task.stage_name, v_task.stage_order, v_task.task_order,
          v_owner.owner_id, v_task.priority
        )
        RETURNING id INTO v_new_task_id;

        -- Usar lógica de fan-out: tarefa-pai já tem owner_id → subtarefas herdam
        IF v_task.has_subtasks THEN
          PERFORM _populate_subtasks(
            v_new_task_id,
            v_task.tpl_task_id,
            v_property_id,
            v_owner.owner_id
          );
        END IF;
      END LOOP;
    ELSE
      -- Tarefa normal (sem owner_type)
      INSERT INTO proc_tasks (
        proc_instance_id, tpl_task_id, title, action_type, config,
        status, is_mandatory, assigned_role, due_date,
        stage_name, stage_order_index, order_index, owner_id, priority
      ) VALUES (
        p_instance_id, v_task.tpl_task_id, v_task.title,
        v_task.action_type, v_task.config,
        'pending', v_task.is_mandatory, v_task.assigned_role,
        CASE WHEN v_task.sla_days IS NOT NULL THEN NOW() + (v_task.sla_days * interval '1 day') ELSE NULL END,
        v_task.stage_name, v_task.stage_order, v_task.task_order,
        NULL, v_task.priority
      )
      RETURNING id INTO v_new_task_id;

      -- Usar lógica de fan-out: tarefa-pai não tem owner_id → subtarefas podem fazer fan-out
      IF v_task.has_subtasks THEN
        PERFORM _populate_subtasks(
          v_new_task_id,
          v_task.tpl_task_id,
          v_property_id,
          NULL
        );
      END IF;
    END IF;
  END LOOP;
END;
$function$;

-- 2) Remover o overload morto () RETURNS trigger (nenhum trigger o usa)
DROP FUNCTION IF EXISTS public.populate_process_tasks();
