-- Resolve `proc_tasks.assigned_to` a partir de `tpl_tasks.assigned_role` ao
-- popular um proc_instance, e backfill das rows existentes.
--
-- Resolver:
--   - assigned_role = 'Consultor' OU NULL
--       → consultor primário do proc_instance (property.consultant_id
--         para angariações, negocios.assigned_consultant_id para PROC-NEG,
--         ou requested_by como fallback)
--   - assigned_role = role canónica (ex. 'Gestor Processual', 'Office Manager')
--       → primeiro user activo com essa role (ORDER BY assigned_at)
--   - role sem user activo → fallback ao consultor primário
--
-- Subtasks herdam o `assigned_to` do parent task (já resolvido em
-- populate_process_tasks). tpl_subtasks raramente tem `assigned_role`
-- próprio; quando precisar de override, é caso a caso pós-template.

-- A) Normalizar 3 spellings em tpl_tasks + proc_tasks (data cleanup)
UPDATE tpl_tasks SET assigned_role = 'Gestor Processual'
 WHERE assigned_role IN ('Gestora Processual', 'Processual');

UPDATE proc_tasks SET assigned_role = 'Gestor Processual'
 WHERE assigned_role IN ('Gestora Processual', 'Processual');

-- Helper: resolver assignee para uma task num proc_instance específico.
CREATE OR REPLACE FUNCTION public.resolve_proc_task_assignee(
  p_proc_instance_id uuid,
  p_assigned_role text
) RETURNS uuid
LANGUAGE plpgsql STABLE AS $fn$
DECLARE
  v_consultant uuid;
  v_resolved uuid;
BEGIN
  SELECT COALESCE(p.consultant_id, n.assigned_consultant_id, pi.requested_by)
    INTO v_consultant
    FROM proc_instances pi
    LEFT JOIN dev_properties p ON p.id = pi.property_id
    LEFT JOIN negocios n ON n.id = pi.negocio_id
   WHERE pi.id = p_proc_instance_id;

  IF p_assigned_role IS NULL OR p_assigned_role = 'Consultor' THEN
    RETURN v_consultant;
  END IF;

  SELECT ur.user_id INTO v_resolved
    FROM user_roles ur
    JOIN roles r ON r.id = ur.role_id
    JOIN dev_users u ON u.id = ur.user_id
   WHERE r.name = p_assigned_role
     AND u.is_active = true
   ORDER BY ur.assigned_at ASC NULLS LAST, ur.user_id
   LIMIT 1;

  RETURN COALESCE(v_resolved, v_consultant);
END;
$fn$;

-- B) populate_process_tasks → resolve assigned_to por task ao copiar do template.
CREATE OR REPLACE FUNCTION public.populate_process_tasks()
RETURNS trigger
LANGUAGE plpgsql AS $fn$
DECLARE
  v_task RECORD;
  v_owner RECORD;
  v_owner_type text;
  v_new_task_id uuid;
  v_assigned_to uuid;
BEGIN
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
    WHERE s.tpl_process_id = NEW.tpl_process_id
    ORDER BY s.order_index, t.order_index
  LOOP
    v_owner_type := v_task.owner_type;
    v_assigned_to := public.resolve_proc_task_assignee(NEW.id, v_task.assigned_role);

    IF v_owner_type IS NOT NULL AND NEW.property_id IS NOT NULL THEN
      FOR v_owner IN
        SELECT po.owner_id, o.name AS owner_name, o.person_type
        FROM property_owners po
        JOIN owners o ON o.id = po.owner_id
        WHERE po.property_id = NEW.property_id
          AND o.person_type = v_owner_type
        ORDER BY po.is_main_contact DESC, o.name
      LOOP
        INSERT INTO proc_tasks (
          proc_instance_id, tpl_task_id, title, action_type, config,
          status, is_mandatory, assigned_role, due_date,
          stage_name, stage_order_index, order_index, owner_id, priority,
          assigned_to
        ) VALUES (
          NEW.id, v_task.tpl_task_id,
          v_task.title || ' — ' || v_owner.owner_name,
          v_task.action_type, v_task.config || jsonb_build_object('owner_id', v_owner.owner_id),
          'pending', v_task.is_mandatory, v_task.assigned_role,
          CASE WHEN v_task.sla_days IS NOT NULL THEN NOW() + (v_task.sla_days * interval '1 day') ELSE NULL END,
          v_task.stage_name, v_task.stage_order, v_task.task_order,
          v_owner.owner_id, v_task.priority,
          v_assigned_to
        )
        RETURNING id INTO v_new_task_id;

        IF v_task.has_subtasks THEN
          PERFORM public._populate_subtasks(v_new_task_id, v_task.tpl_task_id, NEW.property_id, v_owner.owner_id);
        END IF;
      END LOOP;
    ELSE
      INSERT INTO proc_tasks (
        proc_instance_id, tpl_task_id, title, action_type, config,
        status, is_mandatory, assigned_role, due_date,
        stage_name, stage_order_index, order_index, owner_id, priority,
        assigned_to
      ) VALUES (
        NEW.id, v_task.tpl_task_id, v_task.title,
        v_task.action_type, v_task.config,
        'pending', v_task.is_mandatory, v_task.assigned_role,
        CASE WHEN v_task.sla_days IS NOT NULL THEN NOW() + (v_task.sla_days * interval '1 day') ELSE NULL END,
        v_task.stage_name, v_task.stage_order, v_task.task_order,
        NULL, v_task.priority,
        v_assigned_to
      )
      RETURNING id INTO v_new_task_id;

      IF v_task.has_subtasks THEN
        PERFORM public._populate_subtasks(v_new_task_id, v_task.tpl_task_id, NEW.property_id, NULL);
      END IF;
    END IF;
  END LOOP;

  RETURN NEW;
END;
$fn$;

-- C) _populate_subtasks → herda assigned_to do parent task (já resolved).
CREATE OR REPLACE FUNCTION public._populate_subtasks(
  p_proc_task_id uuid,
  p_tpl_task_id uuid,
  p_property_id uuid,
  p_parent_owner_id uuid
) RETURNS void
LANGUAGE plpgsql AS $fn$
DECLARE
  v_subtask RECORD;
  v_sub_owner RECORD;
  v_owner_scope text;
  v_person_filter text;
  v_has_variants boolean;
  v_resolved_config jsonb;
  v_loop_idx int;
  v_parent_person_type text;
  v_due_date timestamptz;
  v_parent_assigned_to uuid;
BEGIN
  SELECT assigned_to INTO v_parent_assigned_to
    FROM proc_tasks WHERE id = p_proc_task_id;

  FOR v_subtask IN
    SELECT * FROM tpl_subtasks
    WHERE tpl_task_id = p_tpl_task_id
    ORDER BY order_index
  LOOP
    v_owner_scope := v_subtask.config->>'owner_scope';
    v_person_filter := COALESCE(v_subtask.config->>'person_type_filter', 'all');
    v_has_variants := COALESCE((v_subtask.config->>'has_person_type_variants')::boolean, false);

    v_due_date := CASE
      WHEN v_subtask.sla_days IS NOT NULL THEN NOW() + (v_subtask.sla_days * interval '1 day')
      ELSE NULL
    END;

    IF v_owner_scope IS NOT NULL AND v_owner_scope != 'none' THEN
      IF p_parent_owner_id IS NOT NULL THEN
        SELECT o.person_type INTO v_parent_person_type
        FROM owners o WHERE o.id = p_parent_owner_id;

        v_resolved_config := v_subtask.config;
        IF v_has_variants THEN
          IF v_parent_person_type = 'singular' AND v_subtask.config ? 'singular_config' THEN
            v_resolved_config := v_subtask.config || (v_subtask.config->'singular_config');
          ELSIF v_parent_person_type = 'coletiva' AND v_subtask.config ? 'coletiva_config' THEN
            v_resolved_config := v_subtask.config || (v_subtask.config->'coletiva_config');
          END IF;
        END IF;

        INSERT INTO proc_subtasks (
          proc_task_id, tpl_subtask_id, title, is_mandatory,
          order_index, config, owner_id,
          due_date, assigned_role, priority, subtask_key, assigned_to
        ) VALUES (
          p_proc_task_id, v_subtask.id, v_subtask.title,
          v_subtask.is_mandatory, v_subtask.order_index,
          v_resolved_config, p_parent_owner_id,
          v_due_date, v_subtask.assigned_role, v_subtask.priority,
          'legacy_' || v_subtask.id::text, v_parent_assigned_to
        );

      ELSE
        v_loop_idx := 0;
        FOR v_sub_owner IN
          SELECT po.owner_id, o.name, o.person_type, po.is_main_contact
          FROM property_owners po
          JOIN owners o ON o.id = po.owner_id
          WHERE po.property_id = p_property_id
            AND (v_person_filter = 'all' OR o.person_type = v_person_filter)
            AND (v_owner_scope != 'main_contact_only' OR po.is_main_contact = true)
          ORDER BY po.is_main_contact DESC, o.name
        LOOP
          v_loop_idx := v_loop_idx + 1;

          v_resolved_config := v_subtask.config;
          IF v_has_variants THEN
            IF v_sub_owner.person_type = 'singular' AND v_subtask.config ? 'singular_config' THEN
              v_resolved_config := v_subtask.config || (v_subtask.config->'singular_config');
            ELSIF v_sub_owner.person_type = 'coletiva' AND v_subtask.config ? 'coletiva_config' THEN
              v_resolved_config := v_subtask.config || (v_subtask.config->'coletiva_config');
            END IF;
          END IF;

          INSERT INTO proc_subtasks (
            proc_task_id, tpl_subtask_id, title, is_mandatory,
            order_index, config, owner_id,
            due_date, assigned_role, priority, subtask_key, assigned_to
          ) VALUES (
            p_proc_task_id,
            v_subtask.id,
            v_subtask.title,
            v_subtask.is_mandatory,
            v_subtask.order_index * 100 + v_loop_idx,
            v_resolved_config,
            v_sub_owner.owner_id,
            v_due_date, v_subtask.assigned_role, v_subtask.priority,
            'legacy_' || v_subtask.id::text, v_parent_assigned_to
          );
        END LOOP;
      END IF;

    ELSE
      INSERT INTO proc_subtasks (
        proc_task_id, tpl_subtask_id, title, is_mandatory,
        order_index, config,
        due_date, assigned_role, priority, subtask_key, assigned_to
      ) VALUES (
        p_proc_task_id, v_subtask.id, v_subtask.title,
        v_subtask.is_mandatory, v_subtask.order_index, v_subtask.config,
        v_due_date, v_subtask.assigned_role, v_subtask.priority,
        'legacy_' || v_subtask.id::text, v_parent_assigned_to
      );
    END IF;
  END LOOP;
END;
$fn$;

-- D) Backfill — proc_tasks primeiro, depois subtasks (que herdam do parent)
UPDATE proc_tasks pt
   SET assigned_to = public.resolve_proc_task_assignee(pt.proc_instance_id, pt.assigned_role)
 WHERE pt.assigned_to IS NULL;

UPDATE proc_subtasks ps
   SET assigned_to = pt.assigned_to
  FROM proc_tasks pt
 WHERE ps.proc_task_id = pt.id
   AND ps.assigned_to IS NULL
   AND pt.assigned_to IS NOT NULL;
