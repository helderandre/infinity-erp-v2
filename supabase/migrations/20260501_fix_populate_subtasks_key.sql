-- ============================================================================
-- Fix: _populate_subtasks viola NOT NULL de proc_subtasks.subtask_key
-- ============================================================================
-- CONTEXTO: A migration 20260501_proc_subtasks_hardcoded.sql adicionou a coluna
-- subtask_key NOT NULL em proc_subtasks, mas a função _populate_subtasks
-- (chamada pelo RPC populate_process_tasks durante a aprovação de processos)
-- não foi actualizada e continua a inserir linhas sem preencher subtask_key.
-- Isto parte silenciosamente o fluxo de aprovação — proc_instances fica active
-- mas sem proc_tasks nem proc_subtasks.
--
-- FIX: CREATE OR REPLACE da função para incluir subtask_key nos 3 INSERTs,
-- usando a convenção legacy já definida no backfill: 'legacy_' || tpl_subtask_id.
-- O pre-check em components/processes/subtask-card-list.tsx:195-224 já sabe
-- tratar keys 'legacy_*' — cai no switch legacy. Comportamento preservado.
--
-- REVERT: impraticável reverter sem re-introduzir o bug. Se necessário,
-- aplicar a versão anterior da função (copy de pg_get_functiondef antes desta
-- migration). Não há mudança de schema — apenas corpo da função.
-- ============================================================================

CREATE OR REPLACE FUNCTION public._populate_subtasks(
  p_proc_task_id uuid,
  p_tpl_task_id uuid,
  p_property_id uuid,
  p_parent_owner_id uuid
)
RETURNS void
LANGUAGE plpgsql
AS $function$
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
BEGIN
  FOR v_subtask IN
    SELECT * FROM tpl_subtasks
    WHERE tpl_task_id = p_tpl_task_id
    ORDER BY order_index
  LOOP
    v_owner_scope := v_subtask.config->>'owner_scope';
    v_person_filter := COALESCE(v_subtask.config->>'person_type_filter', 'all');
    v_has_variants := COALESCE((v_subtask.config->>'has_person_type_variants')::boolean, false);

    -- Calcular due_date a partir de sla_days
    v_due_date := CASE
      WHEN v_subtask.sla_days IS NOT NULL THEN NOW() + (v_subtask.sla_days * interval '1 day')
      ELSE NULL
    END;

    IF v_owner_scope IS NOT NULL AND v_owner_scope != 'none' THEN
      -- === Fan-out: subtarefa multiplicada por proprietário ===

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
          due_date, assigned_role, priority, subtask_key
        ) VALUES (
          p_proc_task_id, v_subtask.id, v_subtask.title,
          v_subtask.is_mandatory, v_subtask.order_index,
          v_resolved_config, p_parent_owner_id,
          v_due_date, v_subtask.assigned_role, v_subtask.priority,
          'legacy_' || v_subtask.id::text
        );

      ELSE
        -- Tarefa-pai NÃO tem owner → fan-out sobre os owners do imóvel
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
            due_date, assigned_role, priority, subtask_key
          ) VALUES (
            p_proc_task_id,
            v_subtask.id,
            v_subtask.title,
            v_subtask.is_mandatory,
            v_subtask.order_index * 100 + v_loop_idx,
            v_resolved_config,
            v_sub_owner.owner_id,
            v_due_date, v_subtask.assigned_role, v_subtask.priority,
            'legacy_' || v_subtask.id::text
          );
        END LOOP;
      END IF;

    ELSE
      -- === Subtarefa normal (sem fan-out) — cópia literal ===
      INSERT INTO proc_subtasks (
        proc_task_id, tpl_subtask_id, title, is_mandatory,
        order_index, config,
        due_date, assigned_role, priority, subtask_key
      ) VALUES (
        p_proc_task_id, v_subtask.id, v_subtask.title,
        v_subtask.is_mandatory, v_subtask.order_index, v_subtask.config,
        v_due_date, v_subtask.assigned_role, v_subtask.priority,
        'legacy_' || v_subtask.id::text
      );
    END IF;
  END LOOP;
END;
$function$;
