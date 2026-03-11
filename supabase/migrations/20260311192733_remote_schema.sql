


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE EXTENSION IF NOT EXISTS "pg_cron" WITH SCHEMA "pg_catalog";






COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_net" WITH SCHEMA "public";






CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgmq";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "unaccent" WITH SCHEMA "public";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE TYPE "public"."auto_channel_type" AS ENUM (
    'whatsapp',
    'email',
    'notification'
);


ALTER TYPE "public"."auto_channel_type" OWNER TO "postgres";


CREATE TYPE "public"."auto_delivery_status" AS ENUM (
    'pending',
    'sent',
    'delivered',
    'failed',
    'cancelled'
);


ALTER TYPE "public"."auto_delivery_status" OWNER TO "postgres";


CREATE TYPE "public"."auto_run_status" AS ENUM (
    'pending',
    'queued',
    'running',
    'completed',
    'failed',
    'cancelled',
    'timed_out'
);


ALTER TYPE "public"."auto_run_status" OWNER TO "postgres";


CREATE TYPE "public"."auto_step_status" AS ENUM (
    'pending',
    'running',
    'completed',
    'failed',
    'skipped',
    'cancelled'
);


ALTER TYPE "public"."auto_step_status" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."_populate_subtasks"("p_proc_task_id" "uuid", "p_tpl_task_id" "uuid", "p_property_id" "uuid", "p_parent_owner_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
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
          due_date, assigned_role, priority
        ) VALUES (
          p_proc_task_id, v_subtask.id, v_subtask.title,
          v_subtask.is_mandatory, v_subtask.order_index,
          v_resolved_config, p_parent_owner_id,
          v_due_date, v_subtask.assigned_role, v_subtask.priority
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
            due_date, assigned_role, priority
          ) VALUES (
            p_proc_task_id,
            v_subtask.id,
            v_subtask.title,
            v_subtask.is_mandatory,
            v_subtask.order_index * 100 + v_loop_idx,
            v_resolved_config,
            v_sub_owner.owner_id,
            v_due_date, v_subtask.assigned_role, v_subtask.priority
          );
        END LOOP;
      END IF;

    ELSE
      -- === Subtarefa normal (sem fan-out) — cópia literal ===
      INSERT INTO proc_subtasks (
        proc_task_id, tpl_subtask_id, title, is_mandatory,
        order_index, config,
        due_date, assigned_role, priority
      ) VALUES (
        p_proc_task_id, v_subtask.id, v_subtask.title,
        v_subtask.is_mandatory, v_subtask.order_index, v_subtask.config,
        v_due_date, v_subtask.assigned_role, v_subtask.priority
      );
    END IF;
  END LOOP;
END;
$$;


ALTER FUNCTION "public"."_populate_subtasks"("p_proc_task_id" "uuid", "p_tpl_task_id" "uuid", "p_property_id" "uuid", "p_parent_owner_id" "uuid") OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."auto_step_runs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "run_id" "uuid" NOT NULL,
    "flow_id" "uuid" NOT NULL,
    "node_id" "text" NOT NULL,
    "node_type" "text" NOT NULL,
    "node_label" "text",
    "status" "public"."auto_step_status" DEFAULT 'pending'::"public"."auto_step_status" NOT NULL,
    "input_data" "jsonb",
    "output_data" "jsonb",
    "scheduled_for" timestamp with time zone DEFAULT "now"(),
    "priority" integer DEFAULT 3,
    "retry_count" integer DEFAULT 0,
    "max_retries" integer DEFAULT 1,
    "error_message" "text",
    "duration_ms" integer,
    "started_at" timestamp with time zone,
    "completed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "auto_step_runs_priority_check" CHECK ((("priority" >= 1) AND ("priority" <= 5)))
);


ALTER TABLE "public"."auto_step_runs" OWNER TO "postgres";


COMMENT ON TABLE "public"."auto_step_runs" IS 'Execução de cada nó individual com input/output e Realtime';



COMMENT ON COLUMN "public"."auto_step_runs"."retry_count" IS 'Contador de tentativas. 0=primeira, 1=retry auto, 2+=bloqueado (requer manual).';



COMMENT ON COLUMN "public"."auto_step_runs"."max_retries" IS '1 = retry automático uma vez. Após 2ª falha, requer retry manual via dashboard.';



CREATE OR REPLACE FUNCTION "public"."auto_claim_steps"("batch_size" integer DEFAULT 5) RETURNS SETOF "public"."auto_step_runs"
    LANGUAGE "sql"
    AS $$
  UPDATE auto_step_runs SET status = 'running', started_at = now()
  WHERE id IN (
    SELECT id FROM auto_step_runs
    WHERE status = 'pending' AND scheduled_for <= now()
    ORDER BY priority DESC, scheduled_for ASC
    FOR UPDATE SKIP LOCKED LIMIT batch_size
  ) RETURNING *;
$$;


ALTER FUNCTION "public"."auto_claim_steps"("batch_size" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."auto_complete_form_tasks_on_owner_update"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $_$
DECLARE
  v_task RECORD;
  v_subtask RECORD;
  v_field_name text;
  v_field_value text;
  v_all_complete boolean;
  v_affected_instances uuid[] := '{}';
BEGIN
  -- Buscar todas as proc_tasks FORM pendentes deste owner
  FOR v_task IN
    SELECT pt.id AS task_id, pt.proc_instance_id, pt.config
    FROM proc_tasks pt
    JOIN proc_instances pi ON pi.id = pt.proc_instance_id
    WHERE pt.owner_id = NEW.id
      AND pt.action_type = 'FORM'
      AND pt.status IN ('pending', 'in_progress')
      AND pi.current_status = 'active'
  LOOP
    -- Verificar subtarefas (checklist de campos)
    v_all_complete := true;
    
    FOR v_subtask IN
      SELECT ps.id, ps.config, ps.is_mandatory, ps.is_completed
      FROM proc_subtasks ps
      WHERE ps.proc_task_id = v_task.task_id
      ORDER BY ps.order_index
    LOOP
      -- Se subtarefa é de tipo "field", verificar se o campo está preenchido no owner
      IF v_subtask.config->>'check_type' = 'field' AND v_subtask.is_mandatory THEN
        v_field_name := v_subtask.config->>'field_name';
        IF v_field_name IS NOT NULL THEN
          EXECUTE format('SELECT ($1).%I::text', v_field_name) INTO v_field_value USING NEW;
          
          IF v_field_value IS NOT NULL AND v_field_value != '' THEN
            -- Marcar subtarefa como completa
            IF NOT v_subtask.is_completed THEN
              UPDATE proc_subtasks SET is_completed = true, completed_at = NOW()
              WHERE id = v_subtask.id;
            END IF;
          ELSE
            v_all_complete := false;
            -- Marcar como incompleta se mudou
            IF v_subtask.is_completed THEN
              UPDATE proc_subtasks SET is_completed = false, completed_at = NULL
              WHERE id = v_subtask.id;
            END IF;
          END IF;
        END IF;
      ELSIF v_subtask.config->>'check_type' = 'document' THEN
        -- Verificar se doc existe em doc_registry
        IF EXISTS(
          SELECT 1 FROM doc_registry 
          WHERE owner_id = NEW.id 
            AND doc_type_id = (v_subtask.config->>'doc_type_id')::uuid
            AND status = 'active'
        ) THEN
          IF NOT v_subtask.is_completed THEN
            UPDATE proc_subtasks SET is_completed = true, completed_at = NOW()
            WHERE id = v_subtask.id;
          END IF;
        ELSE
          v_all_complete := false;
          IF v_subtask.is_completed THEN
            UPDATE proc_subtasks SET is_completed = false, completed_at = NULL
            WHERE id = v_subtask.id;
          END IF;
        END IF;
      ELSIF NOT v_subtask.is_completed AND v_subtask.is_mandatory THEN
        v_all_complete := false;
      END IF;
    END LOOP;

    -- Se todas as subtarefas obrigatórias estão completas, completar a tarefa
    IF v_all_complete THEN
      UPDATE proc_tasks SET
        status = 'completed',
        completed_at = NOW(),
        task_result = jsonb_build_object(
          'auto_completed', true,
          'source', 'owner_form_complete'
        )
      WHERE id = v_task.task_id AND status != 'completed';

      IF NOT v_task.proc_instance_id = ANY(v_affected_instances) THEN
        v_affected_instances := v_affected_instances || v_task.proc_instance_id;
      END IF;
    ELSE
      -- Marcar como in_progress se pelo menos uma subtarefa está completa
      UPDATE proc_tasks SET status = 'in_progress'
      WHERE id = v_task.task_id AND status = 'pending';
    END IF;
  END LOOP;

  -- Recalcular progresso
  DECLARE v_inst_id uuid;
  BEGIN
    FOREACH v_inst_id IN ARRAY v_affected_instances
    LOOP
      PERFORM recalculate_process_progress(v_inst_id);
    END LOOP;
  END;

  RETURN NEW;
END;
$_$;


ALTER FUNCTION "public"."auto_complete_form_tasks_on_owner_update"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."auto_complete_form_tasks_on_owner_update"() IS 'Quando owner é actualizado, verifica tarefas FORM pendentes e completa subtarefas/tarefas conforme campos preenchidos.';



CREATE OR REPLACE FUNCTION "public"."auto_complete_tasks_on_doc_insert"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_task RECORD;
  v_affected_instances uuid[] := '{}';
  v_property_ids uuid[];
  v_instance_id uuid;
BEGIN
  -- Só processar se tiver doc_type_id e status activo
  IF NEW.doc_type_id IS NULL OR NEW.status != 'active' THEN
    RETURN NEW;
  END IF;

  -- Verificar validade do documento
  IF NEW.valid_until IS NOT NULL AND NEW.valid_until < NOW() THEN
    RETURN NEW;
  END IF;

  -- ============================================================
  -- CASO 1: Documento com property_id
  -- Procurar proc_tasks do(s) processo(s) desse imóvel
  -- ============================================================
  IF NEW.property_id IS NOT NULL THEN
    FOR v_task IN
      SELECT pt.id AS task_id, pt.proc_instance_id, pt.owner_id AS task_owner_id
      FROM proc_tasks pt
      JOIN proc_instances pi ON pi.id = pt.proc_instance_id
      WHERE pi.property_id = NEW.property_id
        AND pi.current_status = 'active'
        AND pt.action_type = 'UPLOAD'
        AND pt.status IN ('pending', 'in_progress')
        AND pt.config->>'doc_type_id' = NEW.doc_type_id::text
        -- Se a tarefa tem owner_id, só completar se match
        AND (pt.owner_id IS NULL OR pt.owner_id = NEW.owner_id)
    LOOP
      UPDATE proc_tasks SET
        status = 'completed',
        completed_at = NOW(),
        task_result = jsonb_build_object(
          'doc_registry_id', NEW.id,
          'auto_completed', true,
          'source', 'doc_registry_trigger'
        )
      WHERE id = v_task.task_id;

      IF NOT v_task.proc_instance_id = ANY(v_affected_instances) THEN
        v_affected_instances := v_affected_instances || v_task.proc_instance_id;
      END IF;
    END LOOP;
  END IF;

  -- ============================================================
  -- CASO 2: Documento com owner_id (doc do proprietário)
  -- Procurar proc_tasks em TODOS os processos activos
  -- onde esse proprietário está ligado via property_owners
  -- ============================================================
  IF NEW.owner_id IS NOT NULL THEN
    SELECT ARRAY_AGG(DISTINCT property_id) INTO v_property_ids
    FROM property_owners
    WHERE owner_id = NEW.owner_id;

    IF v_property_ids IS NOT NULL THEN
      FOR v_task IN
        SELECT pt.id AS task_id, pt.proc_instance_id
        FROM proc_tasks pt
        JOIN proc_instances pi ON pi.id = pt.proc_instance_id
        WHERE pi.property_id = ANY(v_property_ids)
          AND pi.current_status = 'active'
          AND pt.action_type = 'UPLOAD'
          AND pt.status IN ('pending', 'in_progress')
          AND pt.config->>'doc_type_id' = NEW.doc_type_id::text
          -- Match por owner_id da tarefa
          AND (pt.owner_id IS NULL OR pt.owner_id = NEW.owner_id)
          -- Evitar duplicar completions já feitas no CASO 1
          AND pt.id NOT IN (
            SELECT unnest(
              ARRAY(
                SELECT pt2.id FROM proc_tasks pt2
                JOIN proc_instances pi2 ON pi2.id = pt2.proc_instance_id
                WHERE pi2.property_id = NEW.property_id
                  AND pt2.status = 'completed'
                  AND pt2.completed_at >= NOW() - interval '1 second'
              )
            )
          )
      LOOP
        UPDATE proc_tasks SET
          status = 'completed',
          completed_at = NOW(),
          task_result = jsonb_build_object(
            'doc_registry_id', NEW.id,
            'auto_completed', true,
            'source', 'owner_document_trigger'
          )
        WHERE id = v_task.task_id;

        IF NOT v_task.proc_instance_id = ANY(v_affected_instances) THEN
          v_affected_instances := v_affected_instances || v_task.proc_instance_id;
        END IF;
      END LOOP;
    END IF;
  END IF;

  -- ============================================================
  -- Recalcular progresso de todos os processos afectados
  -- ============================================================
  FOREACH v_instance_id IN ARRAY v_affected_instances
  LOOP
    PERFORM recalculate_process_progress(v_instance_id);
  END LOOP;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."auto_complete_tasks_on_doc_insert"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."auto_complete_tasks_on_doc_insert"() IS 'AFTER INSERT em doc_registry: auto-completa proc_tasks UPLOAD. Respeita proc_tasks.owner_id para matching preciso. Reutiliza docs entre processos do mesmo proprietário.';



CREATE OR REPLACE FUNCTION "public"."auto_get_table_columns"("p_table" "text") RETURNS TABLE("column_name" "text", "data_type" "text")
    LANGUAGE "sql" SECURITY DEFINER
    AS $$
  SELECT c.column_name::TEXT, c.data_type::TEXT
  FROM information_schema.columns c
  WHERE c.table_schema = 'public' AND c.table_name = p_table
  ORDER BY c.ordinal_position;
$$;


ALTER FUNCTION "public"."auto_get_table_columns"("p_table" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."auto_reset_stuck_steps"() RETURNS integer
    LANGUAGE "plpgsql"
    AS $$
DECLARE reset_count INTEGER;
BEGIN
  UPDATE auto_step_runs SET status = 'pending', retry_count = retry_count + 1,
    error_message = COALESCE(error_message,'') || E'\n[auto-reset] ' || now()::text
  WHERE status = 'running' AND started_at < now() - interval '5 minutes' AND retry_count < max_retries;
  GET DIAGNOSTICS reset_count = ROW_COUNT;
  UPDATE auto_step_runs SET status = 'failed', completed_at = now(),
    error_message = COALESCE(error_message,'') || E'\n[auto-failed] Max retries'
  WHERE status = 'running' AND started_at < now() - interval '5 minutes' AND retry_count >= max_retries;
  RETURN reset_count;
END; $$;


ALTER FUNCTION "public"."auto_reset_stuck_steps"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."auto_resolve_owner_id_on_doc_insert"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_category text;
  v_resolved_owner_id uuid;
BEGIN
  -- Só actuar se owner_id é NULL e property_id existe
  IF NEW.owner_id IS NOT NULL OR NEW.property_id IS NULL OR NEW.doc_type_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Verificar categoria do doc_type
  SELECT category INTO v_category
  FROM doc_types
  WHERE id = NEW.doc_type_id;

  -- Só para documentos de proprietário
  IF v_category IS NULL OR NOT (v_category LIKE 'Proprietário%') THEN
    RETURN NEW;
  END IF;

  -- Buscar proprietário principal do imóvel
  SELECT owner_id INTO v_resolved_owner_id
  FROM property_owners
  WHERE property_id = NEW.property_id
    AND is_main_contact = true
  LIMIT 1;

  -- Fallback: se não há main_contact, usar o primeiro
  IF v_resolved_owner_id IS NULL THEN
    SELECT owner_id INTO v_resolved_owner_id
    FROM property_owners
    WHERE property_id = NEW.property_id
    ORDER BY owner_id
    LIMIT 1;
  END IF;

  -- Preencher owner_id
  IF v_resolved_owner_id IS NOT NULL THEN
    NEW.owner_id := v_resolved_owner_id;
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."auto_resolve_owner_id_on_doc_insert"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."auto_resolve_owner_id_on_doc_insert"() IS 'Preenche owner_id automaticamente quando doc de proprietário é inserido sem owner_id mas com property_id.';



CREATE OR REPLACE FUNCTION "public"."auto_save_flow_version"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE next_ver INTEGER;
BEGIN
  -- Versionar quando draft_definition muda
  IF OLD.draft_definition IS DISTINCT FROM NEW.draft_definition THEN
    SELECT COALESCE(MAX(version), 0) + 1 INTO next_ver
    FROM auto_flow_versions WHERE flow_id = NEW.id;
    INSERT INTO auto_flow_versions (flow_id, version, flow_definition)
    VALUES (NEW.id, next_ver, OLD.draft_definition);
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."auto_save_flow_version"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."auto_unblock_on_subtask_complete"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  IF NEW.is_completed = true AND (OLD.is_completed IS NULL OR OLD.is_completed = false) THEN
    UPDATE proc_subtasks
    SET is_blocked = false, unblocked_at = now()
    WHERE dependency_proc_subtask_id = NEW.id AND is_blocked = true;
  END IF;
  
  IF NEW.is_completed = false AND OLD.is_completed = true THEN
    UPDATE proc_subtasks
    SET is_blocked = true, unblocked_at = null
    WHERE dependency_proc_subtask_id = NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."auto_unblock_on_subtask_complete"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."auto_unblock_on_task_complete"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  -- Desbloquear tarefas que dependem desta
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    UPDATE proc_tasks 
    SET is_blocked = false, unblocked_at = now()
    WHERE dependency_proc_task_id = NEW.id AND is_blocked = true;
    
    -- Desbloquear subtarefas que dependem desta tarefa
    UPDATE proc_subtasks
    SET is_blocked = false, unblocked_at = now()
    WHERE dependency_proc_task_id = NEW.id AND is_blocked = true;
  END IF;
  
  -- Re-bloquear se tarefa foi reactivada (reset)
  IF NEW.status IN ('pending', 'in_progress') AND OLD.status = 'completed' THEN
    UPDATE proc_tasks 
    SET is_blocked = true, unblocked_at = null
    WHERE dependency_proc_task_id = NEW.id;
    
    UPDATE proc_subtasks
    SET is_blocked = true, unblocked_at = null
    WHERE dependency_proc_task_id = NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."auto_unblock_on_task_complete"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."auto_update_run_counts"("p_run_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  UPDATE auto_runs SET
    total_steps = (SELECT COUNT(*) FROM auto_step_runs WHERE run_id = p_run_id),
    completed_steps = (SELECT COUNT(*) FROM auto_step_runs WHERE run_id = p_run_id AND status = 'completed'),
    failed_steps = (SELECT COUNT(*) FROM auto_step_runs WHERE run_id = p_run_id AND status = 'failed'),
    status = CASE
      WHEN (SELECT COUNT(*) FROM auto_step_runs WHERE run_id = p_run_id AND status = 'failed') > 0 THEN 'failed'::auto_run_status
      WHEN (SELECT COUNT(*) FROM auto_step_runs WHERE run_id = p_run_id AND status IN ('pending','running')) > 0 THEN 'running'::auto_run_status
      ELSE 'completed'::auto_run_status
    END,
    completed_at = CASE
      WHEN (SELECT COUNT(*) FROM auto_step_runs WHERE run_id = p_run_id AND status IN ('pending','running')) = 0
      THEN now() ELSE NULL
    END,
    updated_at = now()
  WHERE id = p_run_id;
END; $$;


ALTER FUNCTION "public"."auto_update_run_counts"("p_run_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."auto_update_timestamp"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;


ALTER FUNCTION "public"."auto_update_timestamp"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_overdue_and_unblock_alerts"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  item RECORD;
BEGIN
  -- 1. Subtarefas vencidas (com config.alerts.on_overdue configurado)
  FOR item IN
    SELECT ps.id, ps.title, ps.config, ps.assigned_to, ps.due_date,
           pt.proc_instance_id, pi.external_ref
    FROM proc_subtasks ps
    JOIN proc_tasks pt ON pt.id = ps.proc_task_id
    JOIN proc_instances pi ON pi.id = pt.proc_instance_id
    WHERE ps.due_date < now()
      AND ps.is_completed = false
      AND (ps.is_blocked IS NULL OR ps.is_blocked = false)
      AND pi.current_status = 'active'
      AND ps.config->'alerts'->'on_overdue'->>'enabled' = 'true'
      AND NOT EXISTS (
        SELECT 1 FROM proc_alert_log pal
        WHERE pal.entity_id = ps.id
          AND pal.event_type = 'on_overdue'
          AND pal.created_at > now() - interval '24 hours'
      )
  LOOP
    INSERT INTO proc_alert_log (proc_instance_id, entity_type, entity_id, event_type, channel, status, metadata)
    VALUES (
      item.proc_instance_id, 'proc_subtask', item.id, 'on_overdue', 'pending_dispatch',
      'pending',
      jsonb_build_object(
        'title', item.title,
        'process_ref', item.external_ref,
        'due_date', item.due_date,
        'assigned_to', item.assigned_to,
        'alert_config', item.config->'alerts'->'on_overdue'
      )
    );
  END LOOP;

  -- 2. Tarefas vencidas (com config.alerts.on_overdue configurado)
  FOR item IN
    SELECT pt.id, pt.title, pt.config, pt.assigned_to, pt.due_date,
           pt.proc_instance_id, pi.external_ref
    FROM proc_tasks pt
    JOIN proc_instances pi ON pi.id = pt.proc_instance_id
    WHERE pt.due_date < now()
      AND pt.status NOT IN ('completed', 'skipped')
      AND (pt.is_blocked IS NULL OR pt.is_blocked = false)
      AND pi.current_status = 'active'
      AND pt.config->'alerts'->'on_overdue'->>'enabled' = 'true'
      AND NOT EXISTS (
        SELECT 1 FROM proc_alert_log pal
        WHERE pal.entity_id = pt.id
          AND pal.event_type = 'on_overdue'
          AND pal.created_at > now() - interval '24 hours'
      )
  LOOP
    INSERT INTO proc_alert_log (proc_instance_id, entity_type, entity_id, event_type, channel, status, metadata)
    VALUES (
      item.proc_instance_id, 'proc_task', item.id, 'on_overdue', 'pending_dispatch',
      'pending',
      jsonb_build_object(
        'title', item.title,
        'process_ref', item.external_ref,
        'due_date', item.due_date,
        'assigned_to', item.assigned_to,
        'alert_config', item.config->'alerts'->'on_overdue'
      )
    );
  END LOOP;

  -- 3. Subtarefas recém-desbloqueadas (com config.alerts.on_unblock configurado)
  FOR item IN
    SELECT ps.id, ps.title, ps.config, ps.assigned_to, ps.unblocked_at,
           pt.proc_instance_id, pi.external_ref
    FROM proc_subtasks ps
    JOIN proc_tasks pt ON pt.id = ps.proc_task_id
    JOIN proc_instances pi ON pi.id = pt.proc_instance_id
    WHERE ps.unblocked_at > now() - interval '1 hour'
      AND ps.is_completed = false
      AND ps.config->'alerts'->'on_unblock'->>'enabled' = 'true'
      AND NOT EXISTS (
        SELECT 1 FROM proc_alert_log pal
        WHERE pal.entity_id = ps.id AND pal.event_type = 'on_unblock'
      )
  LOOP
    INSERT INTO proc_alert_log (proc_instance_id, entity_type, entity_id, event_type, channel, status, metadata)
    VALUES (
      item.proc_instance_id, 'proc_subtask', item.id, 'on_unblock', 'pending_dispatch',
      'pending',
      jsonb_build_object(
        'title', item.title,
        'process_ref', item.external_ref,
        'assigned_to', item.assigned_to,
        'alert_config', item.config->'alerts'->'on_unblock'
      )
    );
  END LOOP;

  -- 4. Tarefas recém-desbloqueadas (com config.alerts.on_unblock configurado)
  FOR item IN
    SELECT pt.id, pt.title, pt.config, pt.assigned_to, pt.unblocked_at,
           pt.proc_instance_id, pi.external_ref
    FROM proc_tasks pt
    JOIN proc_instances pi ON pi.id = pt.proc_instance_id
    WHERE pt.unblocked_at > now() - interval '1 hour'
      AND pt.status NOT IN ('completed', 'skipped')
      AND pt.config->'alerts'->'on_unblock'->>'enabled' = 'true'
      AND NOT EXISTS (
        SELECT 1 FROM proc_alert_log pal
        WHERE pal.entity_id = pt.id AND pal.event_type = 'on_unblock'
      )
  LOOP
    INSERT INTO proc_alert_log (proc_instance_id, entity_type, entity_id, event_type, channel, status, metadata)
    VALUES (
      item.proc_instance_id, 'proc_task', item.id, 'on_unblock', 'pending_dispatch',
      'pending',
      jsonb_build_object(
        'title', item.title,
        'process_ref', item.external_ref,
        'assigned_to', item.assigned_to,
        'alert_config', item.config->'alerts'->'on_unblock'
      )
    );
  END LOOP;
END;
$$;


ALTER FUNCTION "public"."check_overdue_and_unblock_alerts"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_dev_property_slug"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    new_slug text;
    counter int := 1;
    base_slug text;
BEGIN
    -- 1. Pega o valor real da coluna TITLE do imóvel
    -- Remove acentos, passa para minúsculo e troca caracteres especiais por _
    base_slug := lower(unaccent(NEW.title)); 
    base_slug := regexp_replace(base_slug, '[^a-z0-9]+', '_', 'g');
    base_slug := trim(both '_' from base_slug);
    
    new_slug := base_slug;

    -- 2. Loop para evitar duplicados (adiciona _1, _2 se necessário)
    WHILE EXISTS (SELECT 1 FROM public.dev_properties WHERE slug = new_slug AND id <> NEW.id) LOOP
        new_slug := base_slug || '_' || counter;
        counter := counter + 1;
    END LOOP;

    NEW.slug := new_slug;
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."generate_dev_property_slug"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_proc_ref"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_prefix TEXT;
  v_year   INT;
  v_counter INT;
BEGIN
  IF NEW.external_ref IS NOT NULL THEN
    RETURN NEW;
  END IF;

  v_prefix := CASE NEW.process_type
    WHEN 'angariacao' THEN 'ANG'
    WHEN 'venda'      THEN 'VND'
    WHEN 'compra'     THEN 'COMP'
    ELSE 'GEN'
  END;

  v_year := EXTRACT(YEAR FROM NOW())::INT;

  INSERT INTO ref_counters (prefix, year, counter)
  VALUES (v_prefix, v_year, 1)
  ON CONFLICT (prefix, year)
  DO UPDATE SET counter = ref_counters.counter + 1
  RETURNING counter INTO v_counter;

  NEW.external_ref := 'PROC-' || v_prefix || '-' || v_year || '-' || LPAD(v_counter::TEXT, 4, '0');

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."generate_proc_ref"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."populate_process_tasks"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_task RECORD;
  v_owner RECORD;
  v_owner_type text;
  v_new_task_id uuid;
  v_has_subtasks boolean;
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
          stage_name, stage_order_index, order_index, owner_id, priority
        ) VALUES (
          NEW.id, v_task.tpl_task_id,
          v_task.title || ' — ' || v_owner.owner_name,
          v_task.action_type, v_task.config || jsonb_build_object('owner_id', v_owner.owner_id),
          'pending', v_task.is_mandatory, v_task.assigned_role,
          CASE WHEN v_task.sla_days IS NOT NULL THEN NOW() + (v_task.sla_days * interval '1 day') ELSE NULL END,
          v_task.stage_name, v_task.stage_order, v_task.task_order,
          v_owner.owner_id, v_task.priority
        )
        RETURNING id INTO v_new_task_id;

        -- Usar lógica de fan-out para subtarefas
        IF v_task.has_subtasks THEN
          PERFORM _populate_subtasks(
            v_new_task_id,
            v_task.tpl_task_id,
            NEW.property_id,
            v_owner.owner_id
          );
        END IF;
      END LOOP;
    ELSE
      INSERT INTO proc_tasks (
        proc_instance_id, tpl_task_id, title, action_type, config,
        status, is_mandatory, assigned_role, due_date,
        stage_name, stage_order_index, order_index, owner_id, priority
      ) VALUES (
        NEW.id, v_task.tpl_task_id, v_task.title,
        v_task.action_type, v_task.config,
        'pending', v_task.is_mandatory, v_task.assigned_role,
        CASE WHEN v_task.sla_days IS NOT NULL THEN NOW() + (v_task.sla_days * interval '1 day') ELSE NULL END,
        v_task.stage_name, v_task.stage_order, v_task.task_order,
        NULL, v_task.priority
      )
      RETURNING id INTO v_new_task_id;

      -- Usar lógica de fan-out para subtarefas
      IF v_task.has_subtasks THEN
        PERFORM _populate_subtasks(
          v_new_task_id,
          v_task.tpl_task_id,
          NEW.property_id,
          NULL
        );
      END IF;
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."populate_process_tasks"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."populate_process_tasks"() IS 'Trigger version: Popula proc_tasks a partir do template. Tarefas com config.owner_type são multiplicadas por proprietário.';



CREATE OR REPLACE FUNCTION "public"."populate_process_tasks"("p_instance_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
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
$$;


ALTER FUNCTION "public"."populate_process_tasks"("p_instance_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."populate_process_tasks"("p_instance_id" "uuid") IS 'Popula proc_tasks a partir do template. Tarefas com config.owner_type são multiplicadas por cada proprietário do tipo correspondente.';



CREATE OR REPLACE FUNCTION "public"."recalculate_process_progress"("p_proc_instance_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_total int;
  v_completed int;
  v_percent int;
  v_current_stage_idx int;
  v_current_stage_id uuid;
  v_tpl_process_id uuid;
  v_is_completed boolean;
BEGIN
  -- Contar tarefas
  SELECT 
    COUNT(*),
    COUNT(*) FILTER (WHERE status = 'completed' OR is_bypassed = true)
  INTO v_total, v_completed
  FROM proc_tasks
  WHERE proc_instance_id = p_proc_instance_id;

  IF v_total = 0 THEN
    RETURN;
  END IF;

  v_percent := ROUND((v_completed::numeric / v_total::numeric) * 100);
  v_is_completed := (v_percent = 100);

  -- Encontrar primeira fase não-completa
  SELECT stage_order_index INTO v_current_stage_idx
  FROM (
    SELECT 
      stage_order_index,
      COUNT(*) AS total,
      COUNT(*) FILTER (WHERE status = 'completed' OR is_bypassed = true) AS done
    FROM proc_tasks
    WHERE proc_instance_id = p_proc_instance_id
    GROUP BY stage_order_index
    ORDER BY stage_order_index
  ) stages
  WHERE done < total
  LIMIT 1;

  -- Resolver stage_id real
  v_current_stage_id := NULL;
  IF v_current_stage_idx IS NOT NULL AND NOT v_is_completed THEN
    SELECT tpl_process_id INTO v_tpl_process_id
    FROM proc_instances WHERE id = p_proc_instance_id;

    IF v_tpl_process_id IS NOT NULL THEN
      SELECT id INTO v_current_stage_id
      FROM tpl_stages
      WHERE tpl_process_id = v_tpl_process_id
        AND order_index = v_current_stage_idx
      LIMIT 1;
    END IF;
  END IF;

  -- Actualizar processo
  UPDATE proc_instances SET
    percent_complete = v_percent,
    current_stage_id = v_current_stage_id,
    updated_at = NOW(),
    current_status = CASE 
      WHEN v_is_completed THEN 'completed'
      ELSE current_status 
    END,
    completed_at = CASE 
      WHEN v_is_completed AND completed_at IS NULL THEN NOW()
      ELSE completed_at 
    END
  WHERE id = p_proc_instance_id;
END;
$$;


ALTER FUNCTION "public"."recalculate_process_progress"("p_proc_instance_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."recalculate_process_progress"("p_proc_instance_id" "uuid") IS 'Recalcula percent_complete, current_stage e marca completed se 100%. Chamado por triggers e API.';



CREATE OR REPLACE FUNCTION "public"."resolve_process_dependencies"("p_instance_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_proc_task RECORD;
  v_proc_subtask RECORD;
  v_dep_proc_task_id uuid;
  v_dep_proc_subtask_id uuid;
BEGIN
  -- === Pass 1: Resolve task-to-task dependencies ===
  -- For each proc_task, check if its tpl_task has a dependency_task_id
  FOR v_proc_task IN
    SELECT pt.id AS proc_task_id, pt.tpl_task_id, pt.owner_id,
           tt.dependency_task_id AS tpl_dep_task_id
    FROM proc_tasks pt
    JOIN tpl_tasks tt ON tt.id = pt.tpl_task_id
    WHERE pt.proc_instance_id = p_instance_id
      AND tt.dependency_task_id IS NOT NULL
  LOOP
    -- Find the proc_task that corresponds to the dependency template task
    -- Prefer same owner_id match, fallback to any
    SELECT id INTO v_dep_proc_task_id
    FROM proc_tasks
    WHERE proc_instance_id = p_instance_id
      AND tpl_task_id = v_proc_task.tpl_dep_task_id
    ORDER BY
      CASE WHEN owner_id = v_proc_task.owner_id THEN 0
           WHEN owner_id IS NULL THEN 1
           ELSE 2 END
    LIMIT 1;

    IF v_dep_proc_task_id IS NOT NULL THEN
      UPDATE proc_tasks
      SET dependency_proc_task_id = v_dep_proc_task_id,
          is_blocked = true
      WHERE id = v_proc_task.proc_task_id;
    END IF;
  END LOOP;

  -- === Pass 2: Resolve subtask dependencies ===
  FOR v_proc_subtask IN
    SELECT ps.id AS proc_subtask_id, ps.proc_task_id, ps.tpl_subtask_id, ps.owner_id,
           ts.dependency_type AS tpl_dep_type,
           ts.dependency_subtask_id AS tpl_dep_subtask_id,
           ts.dependency_task_id AS tpl_dep_task_id
    FROM proc_subtasks ps
    JOIN tpl_subtasks ts ON ts.id = ps.tpl_subtask_id
    WHERE ps.proc_task_id IN (
      SELECT id FROM proc_tasks WHERE proc_instance_id = p_instance_id
    )
    AND ts.dependency_type IS NOT NULL
    AND ts.dependency_type != 'none'
  LOOP
    IF v_proc_subtask.tpl_dep_type = 'subtask' AND v_proc_subtask.tpl_dep_subtask_id IS NOT NULL THEN
      -- Find the proc_subtask that corresponds to the dependency template subtask
      -- Prefer same owner_id, then same task, then any
      SELECT ps2.id INTO v_dep_proc_subtask_id
      FROM proc_subtasks ps2
      JOIN proc_tasks pt2 ON pt2.id = ps2.proc_task_id
      WHERE pt2.proc_instance_id = p_instance_id
        AND ps2.tpl_subtask_id = v_proc_subtask.tpl_dep_subtask_id
      ORDER BY
        CASE WHEN ps2.owner_id = v_proc_subtask.owner_id THEN 0
             WHEN ps2.proc_task_id = v_proc_subtask.proc_task_id THEN 1
             ELSE 2 END
      LIMIT 1;

      IF v_dep_proc_subtask_id IS NOT NULL THEN
        UPDATE proc_subtasks
        SET dependency_type = 'subtask',
            dependency_proc_subtask_id = v_dep_proc_subtask_id,
            is_blocked = true
        WHERE id = v_proc_subtask.proc_subtask_id;
      END IF;

    ELSIF v_proc_subtask.tpl_dep_type = 'task' AND v_proc_subtask.tpl_dep_task_id IS NOT NULL THEN
      -- Find the proc_task that corresponds to the dependency template task
      SELECT id INTO v_dep_proc_task_id
      FROM proc_tasks
      WHERE proc_instance_id = p_instance_id
        AND tpl_task_id = v_proc_subtask.tpl_dep_task_id
      ORDER BY
        CASE WHEN owner_id = v_proc_subtask.owner_id THEN 0
             WHEN owner_id IS NULL THEN 1
             ELSE 2 END
      LIMIT 1;

      IF v_dep_proc_task_id IS NOT NULL THEN
        UPDATE proc_subtasks
        SET dependency_type = 'task',
            dependency_proc_task_id = v_dep_proc_task_id,
            is_blocked = true
        WHERE id = v_proc_subtask.proc_subtask_id;
      END IF;
    END IF;
  END LOOP;
END;
$$;


ALTER FUNCTION "public"."resolve_process_dependencies"("p_instance_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_contact_submission_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_contact_submission_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_doc_registry_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_doc_registry_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_leads_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_leads_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_roles_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_roles_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_tpl_variables_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_tpl_variables_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_updated_at_column"() OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."auto_delivery_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "step_run_id" "uuid" NOT NULL,
    "run_id" "uuid" NOT NULL,
    "flow_id" "uuid" NOT NULL,
    "channel" "public"."auto_channel_type" NOT NULL,
    "recipient_address" "text" NOT NULL,
    "message_type" "text",
    "final_content" "text",
    "media_url" "text",
    "status" "public"."auto_delivery_status" DEFAULT 'pending'::"public"."auto_delivery_status" NOT NULL,
    "external_message_id" "text",
    "track_source" "text" DEFAULT 'erp_infinity'::"text",
    "error_message" "text",
    "sent_at" timestamp with time zone,
    "delivered_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."auto_delivery_log" OWNER TO "postgres";


COMMENT ON TABLE "public"."auto_delivery_log" IS 'Log de mensagens WhatsApp, emails e notificações enviadas';



CREATE TABLE IF NOT EXISTS "public"."auto_flow_versions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "flow_id" "uuid" NOT NULL,
    "version" integer NOT NULL,
    "flow_definition" "jsonb" NOT NULL,
    "changed_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."auto_flow_versions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."auto_flows" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" DEFAULT 'Novo Fluxo'::"text" NOT NULL,
    "description" "text",
    "draft_definition" "jsonb" DEFAULT '{"edges": [], "nodes": [], "version": 1}'::"jsonb" NOT NULL,
    "is_active" boolean DEFAULT false,
    "wpp_instance_id" "uuid",
    "context_config" "jsonb" DEFAULT '{}'::"jsonb",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "published_definition" "jsonb",
    "published_at" timestamp with time zone,
    "published_by" "uuid",
    "published_triggers" "jsonb"
);


ALTER TABLE "public"."auto_flows" OWNER TO "postgres";


COMMENT ON TABLE "public"."auto_flows" IS 'Fluxos de automação com definição visual React Flow';



COMMENT ON COLUMN "public"."auto_flows"."draft_definition" IS 'Versão de rascunho editada no editor. Auto-save contínuo. Usada nos testes.';



COMMENT ON COLUMN "public"."auto_flows"."published_definition" IS 'Versão publicada que executa em produção (webhooks, crons). NULL se nunca publicado.';



COMMENT ON COLUMN "public"."auto_flows"."published_at" IS 'Quando foi publicado pela última vez.';



COMMENT ON COLUMN "public"."auto_flows"."published_triggers" IS 'Triggers extraídos da versão publicada. É o que o webhook receiver e cron usam.';



CREATE TABLE IF NOT EXISTS "public"."auto_runs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "flow_id" "uuid" NOT NULL,
    "trigger_id" "uuid",
    "triggered_by" "text" DEFAULT 'manual'::"text",
    "status" "public"."auto_run_status" DEFAULT 'pending'::"public"."auto_run_status" NOT NULL,
    "context" "jsonb" DEFAULT '{}'::"jsonb",
    "entity_type" "text",
    "entity_id" "uuid",
    "total_steps" integer DEFAULT 0,
    "completed_steps" integer DEFAULT 0,
    "failed_steps" integer DEFAULT 0,
    "started_at" timestamp with time zone,
    "completed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "error_message" "text",
    "is_test" boolean DEFAULT false NOT NULL
);


ALTER TABLE "public"."auto_runs" OWNER TO "postgres";


COMMENT ON TABLE "public"."auto_runs" IS 'Execuções individuais de fluxos';



COMMENT ON COLUMN "public"."auto_runs"."is_test" IS 'True quando a execução foi disparada pelo botão "Testar" no editor. Permite filtrar testes do histórico real.';



CREATE TABLE IF NOT EXISTS "public"."auto_triggers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "flow_id" "uuid" NOT NULL,
    "source_type" "text" NOT NULL,
    "trigger_source" "text",
    "trigger_condition" "jsonb",
    "payload_mapping" "jsonb",
    "active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "auto_triggers_source_type_check" CHECK (("source_type" = ANY (ARRAY['webhook'::"text", 'status_change'::"text", 'schedule'::"text", 'manual'::"text"])))
);


ALTER TABLE "public"."auto_triggers" OWNER TO "postgres";


COMMENT ON TABLE "public"."auto_triggers" IS 'Gatilhos N:1 com auto_flows';



CREATE TABLE IF NOT EXISTS "public"."auto_webhook_captures" (
    "source_id" "text" NOT NULL,
    "flow_name" "text",
    "payload" "jsonb",
    "received_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."auto_webhook_captures" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."auto_wpp_instances" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "uazapi_token" "text" NOT NULL,
    "uazapi_instance_id" "text",
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "connection_status" "text" DEFAULT 'disconnected'::"text" NOT NULL,
    "phone" "text",
    "profile_name" "text",
    "profile_pic_url" "text",
    "is_business" boolean DEFAULT false,
    "user_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "auto_wpp_instances_connection_status_check" CHECK (("connection_status" = ANY (ARRAY['connected'::"text", 'disconnected'::"text", 'connecting'::"text", 'not_found'::"text"]))),
    CONSTRAINT "auto_wpp_instances_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'inactive'::"text"])))
);


ALTER TABLE "public"."auto_wpp_instances" OWNER TO "postgres";


COMMENT ON TABLE "public"."auto_wpp_instances" IS 'Instâncias WhatsApp via Uazapi';



CREATE TABLE IF NOT EXISTS "public"."auto_wpp_templates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "messages" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "category" "text" DEFAULT 'geral'::"text",
    "tags" "text"[] DEFAULT '{}'::"text"[],
    "is_active" boolean DEFAULT true,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."auto_wpp_templates" OWNER TO "postgres";


COMMENT ON TABLE "public"."auto_wpp_templates" IS 'Biblioteca de templates de mensagens WhatsApp reutilizáveis';



COMMENT ON COLUMN "public"."auto_wpp_templates"."messages" IS 'Array JSON: [{type, content, mediaUrl?, docName?, delay?}]';



CREATE TABLE IF NOT EXISTS "public"."consultant_documents" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "consultant_id" "uuid" NOT NULL,
    "doc_type_id" "uuid",
    "file_url" "text" NOT NULL,
    "file_name" "text" NOT NULL,
    "uploaded_by" "uuid",
    "valid_until" "date",
    "status" "text" DEFAULT 'active'::"text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "consultant_documents_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'archived'::"text", 'expired'::"text"])))
);


ALTER TABLE "public"."consultant_documents" OWNER TO "postgres";


COMMENT ON TABLE "public"."consultant_documents" IS 'Documentos associados a consultores (contrato, ID, certificados)';



COMMENT ON COLUMN "public"."consultant_documents"."status" IS 'active | archived | expired';



CREATE TABLE IF NOT EXISTS "public"."conta_corrente_limits" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "agent_id" "uuid" NOT NULL,
    "credit_limit" numeric(10,2) DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."conta_corrente_limits" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."conta_corrente_transactions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "agent_id" "uuid" NOT NULL,
    "date" timestamp with time zone DEFAULT "now"() NOT NULL,
    "type" "text" NOT NULL,
    "category" "text" NOT NULL,
    "amount" numeric(10,2) NOT NULL,
    "description" "text" DEFAULT ''::"text" NOT NULL,
    "reference_id" "uuid",
    "reference_type" "text",
    "balance_after" numeric(10,2) DEFAULT 0 NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "conta_corrente_transactions_amount_check" CHECK (("amount" > (0)::numeric)),
    CONSTRAINT "conta_corrente_transactions_category_check" CHECK (("category" = ANY (ARRAY['marketing_purchase'::"text", 'physical_material'::"text", 'fee_registration'::"text", 'fee_renewal'::"text", 'fee_technology'::"text", 'fee_process_management'::"text", 'manual_adjustment'::"text", 'commission_payment'::"text", 'refund'::"text"]))),
    CONSTRAINT "conta_corrente_transactions_type_check" CHECK (("type" = ANY (ARRAY['DEBIT'::"text", 'CREDIT'::"text"])))
);


ALTER TABLE "public"."conta_corrente_transactions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."contact_form_submissions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "email" "text" NOT NULL,
    "phone" "text",
    "message" "text" NOT NULL,
    "status" "text" DEFAULT 'new'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "read_at" timestamp with time zone,
    "replied_at" timestamp with time zone,
    "notes" "text",
    CONSTRAINT "contact_form_submissions_status_check" CHECK (("status" = ANY (ARRAY['new'::"text", 'read'::"text", 'replied'::"text", 'archived'::"text"])))
);


ALTER TABLE "public"."contact_form_submissions" OWNER TO "postgres";


COMMENT ON TABLE "public"."contact_form_submissions" IS 'Armazena todas as submissões do formulário de contacto do website';



COMMENT ON COLUMN "public"."contact_form_submissions"."status" IS 'Status da submissão: new, read, replied, archived';



COMMENT ON COLUMN "public"."contact_form_submissions"."read_at" IS 'Timestamp de quando a mensagem foi lida';



COMMENT ON COLUMN "public"."contact_form_submissions"."replied_at" IS 'Timestamp de quando a mensagem foi respondida';



COMMENT ON COLUMN "public"."contact_form_submissions"."notes" IS 'Notas internas sobre esta submissão';



CREATE TABLE IF NOT EXISTS "public"."dev_consultant_private_data" (
    "user_id" "uuid" NOT NULL,
    "full_name" "text",
    "nif" "text",
    "iban" "text",
    "address_private" "text",
    "monthly_salary" numeric(12,2),
    "commission_rate" numeric(12,2),
    "hiring_date" "date",
    "documents_json" "jsonb" DEFAULT '{"id_card": null, "contract": null}'::"jsonb"
);


ALTER TABLE "public"."dev_consultant_private_data" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."dev_consultant_profiles" (
    "user_id" "uuid" NOT NULL,
    "bio" "text",
    "profile_photo_url" "text",
    "specializations" "text"[],
    "languages" "text"[],
    "instagram_handle" "text",
    "linkedin_url" "text",
    "phone_commercial" "text"
);


ALTER TABLE "public"."dev_consultant_profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."dev_properties" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "slug" "text",
    "external_ref" "text",
    "title" "text" NOT NULL,
    "description" "text",
    "listing_price" numeric(12,2),
    "property_type" "text",
    "business_type" "text",
    "status" "text" DEFAULT 'pending_approval'::"text",
    "energy_certificate" "text",
    "city" "text",
    "zone" "text",
    "consultant_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "property_condition" "text",
    "business_status" "text",
    "contract_regime" "text",
    "address_parish" "text",
    "address_street" "text",
    "postal_code" "text",
    "latitude" double precision,
    "longitude" double precision
);


ALTER TABLE "public"."dev_properties" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."dev_property_internal" (
    "property_id" "uuid" NOT NULL,
    "exact_address" "text",
    "postal_code" "text",
    "internal_notes" "text",
    "commission_agreed" numeric(12,2),
    "contract_regime" "text",
    "contract_expiry" "date",
    "imi_value" numeric(10,2),
    "condominium_fee" numeric(10,2),
    "contract_term" "text",
    "commission_type" "text" DEFAULT 'percentage'::"text",
    "cpcv_percentage" numeric(5,2) DEFAULT 0,
    "reference_internal" "text"
);


ALTER TABLE "public"."dev_property_internal" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."dev_property_media" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "property_id" "uuid",
    "url" "text" NOT NULL,
    "media_type" "text" DEFAULT 'image'::"text",
    "order_index" integer DEFAULT 0,
    "is_cover" boolean DEFAULT false
);


ALTER TABLE "public"."dev_property_media" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."dev_property_specifications" (
    "property_id" "uuid" NOT NULL,
    "typology" "text",
    "bedrooms" integer,
    "bathrooms" integer,
    "area_gross" numeric(10,2),
    "area_util" numeric(10,2),
    "construction_year" integer,
    "parking_spaces" integer,
    "features" "text"[],
    "has_elevator" boolean DEFAULT false,
    "fronts_count" integer,
    "solar_orientation" "text"[],
    "views" "text"[],
    "equipment" "text"[],
    "storage_area" numeric(10,2),
    "balcony_area" numeric(10,2),
    "pool_area" numeric(10,2),
    "attic_area" numeric(10,2),
    "pantry_area" numeric(10,2),
    "gym_area" numeric(10,2),
    "garage_spaces" integer
);


ALTER TABLE "public"."dev_property_specifications" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."dev_users" (
    "id" "uuid" NOT NULL,
    "commercial_name" "text" NOT NULL,
    "professional_email" "text",
    "is_active" boolean DEFAULT true,
    "display_website" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."dev_users" OWNER TO "postgres";


COMMENT ON TABLE "public"."dev_users" IS 'Utilizadores do ERP (ligada a auth.users). Roles geridos pela tabela user_roles.';



CREATE TABLE IF NOT EXISTS "public"."doc_registry" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "property_id" "uuid",
    "doc_type_id" "uuid",
    "file_url" "text" NOT NULL,
    "file_name" "text" NOT NULL,
    "uploaded_by" "uuid",
    "valid_until" timestamp with time zone,
    "status" "text" DEFAULT 'active'::"text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "owner_id" "uuid",
    "updated_at" timestamp with time zone,
    "notes" "text"
);


ALTER TABLE "public"."doc_registry" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."doc_types" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "default_validity_months" integer,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "is_system" boolean DEFAULT false,
    "category" "text" DEFAULT 'Geral'::"text",
    "allowed_extensions" "text"[] DEFAULT ARRAY['pdf'::"text", 'jpg'::"text", 'png'::"text", 'jpeg'::"text", 'doc'::"text", 'docx'::"text"]
);


ALTER TABLE "public"."doc_types" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."email_senders" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "email" "text" NOT NULL,
    "display_name" "text" NOT NULL,
    "reply_to" "text",
    "is_default" boolean DEFAULT false NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "user_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."email_senders" OWNER TO "postgres";


COMMENT ON TABLE "public"."email_senders" IS 'Contas de email remetente disponíveis para envio de alertas e automações.';



CREATE TABLE IF NOT EXISTS "public"."embarcacoes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "numero_registo" "text",
    "fls" integer,
    "livro" integer,
    "nome" "text" NOT NULL,
    "proprietario_nome" "text",
    "proprietario_morada" "text",
    "proprietario_codigo_postal" "text",
    "proprietario_cidade" "text",
    "proprietario_pais" "text" DEFAULT 'Portugal'::"text",
    "marca" "text",
    "modelo" "text",
    "numero_casco" "text",
    "data_construcao" integer,
    "material_casco" "text",
    "cor_casco" "text",
    "cor_superestrutura" "text",
    "tipo_zona" "text",
    "comprimento" numeric,
    "boca" numeric,
    "pontal" numeric,
    "arqueacao" numeric,
    "lotacao" integer,
    "motor_ps" "text",
    "motor_marca" "text",
    "motor_numero" "text",
    "motor_tipo" "text",
    "motor_potencia_hp" numeric,
    "motor_potencia_kw" numeric,
    "motor_combustivel" "text",
    "vhf_fixo" boolean DEFAULT false,
    "vhf_portatil" boolean DEFAULT false,
    "radiobaliza" boolean DEFAULT false,
    "rx_msi" boolean DEFAULT false,
    "meios_salvacao" "jsonb" DEFAULT '{}'::"jsonb",
    "data_registo" "date",
    "observacoes" "text",
    "documento_url" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."embarcacoes" OWNER TO "postgres";


COMMENT ON TABLE "public"."embarcacoes" IS 'Registo de embarcações de recreio (livretes)';



COMMENT ON COLUMN "public"."embarcacoes"."meios_salvacao" IS 'JSON com contagens: jangadas, emb_aux, boias_rot, ajudas, fumigenos, bomba_man, ext_2kg, lot_jang, lot_emb_aux, boias_sinal, paraqued, arneses, bomba_elec, disparad, boias_simpl, coletes, fachos, vertedouros, ext_1kg';



CREATE TABLE IF NOT EXISTS "public"."kv_store_6f39db24" (
    "key" "text" NOT NULL,
    "value" "jsonb" NOT NULL
);


ALTER TABLE "public"."kv_store_6f39db24" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."lead_attachments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "lead_id" "uuid" NOT NULL,
    "url" "text" NOT NULL,
    "name" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."lead_attachments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."leads" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "estado" "text",
    "data" timestamp with time zone,
    "nome" "text" NOT NULL,
    "telefone" "text",
    "email" "text",
    "origem" "text",
    "agent_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "telemovel" "text",
    "telefone_fixo" "text",
    "forma_contacto" "text",
    "observacoes" "text",
    "consentimento_contacto" boolean DEFAULT false,
    "consentimento_webmarketing" boolean DEFAULT false,
    "meio_contacto_preferencial" "text",
    "data_contacto" timestamp with time zone,
    "genero" "text",
    "data_nascimento" "date",
    "nacionalidade" "text",
    "tipo_documento" "text",
    "numero_documento" "text",
    "nif" "text",
    "pais_emissor" "text",
    "data_validade_documento" "date",
    "codigo_postal" "text",
    "localidade" "text",
    "pais" "text",
    "distrito" "text",
    "concelho" "text",
    "freguesia" "text",
    "zona" "text",
    "morada" "text",
    "empresa" "text",
    "morada_empresa" "text",
    "telefone_empresa" "text",
    "temperatura" "text",
    "tem_empresa" boolean DEFAULT false,
    "nipc" "text",
    "full_name" "text",
    "documento_identificacao_url" "text",
    "documento_identificacao_frente_url" "text",
    "documento_identificacao_verso_url" "text",
    "email_empresa" "text",
    "website_empresa" "text"
);


ALTER TABLE "public"."leads" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."log_audit" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "entity_type" "text" NOT NULL,
    "entity_id" "uuid" NOT NULL,
    "action" "text" NOT NULL,
    "old_data" "jsonb",
    "new_data" "jsonb",
    "ip_address" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."log_audit" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."log_emails" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "proc_task_id" "uuid",
    "recipient_email" "text" NOT NULL,
    "subject" "text",
    "sent_at" timestamp with time zone DEFAULT "now"(),
    "delivery_status" "text" DEFAULT 'sent'::"text",
    "provider_id" "text",
    "metadata" "jsonb",
    "proc_subtask_id" "uuid",
    "resend_email_id" "text",
    "sender_email" "text",
    "sender_name" "text",
    "cc" "text"[],
    "body_html" "text",
    "last_event" "text" DEFAULT 'sent'::"text",
    "events" "jsonb" DEFAULT '[]'::"jsonb",
    "parent_email_id" "uuid",
    "error_message" "text"
);


ALTER TABLE "public"."log_emails" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."marketing_catalog" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "description" "text" DEFAULT ''::"text" NOT NULL,
    "category" "text" NOT NULL,
    "price" numeric(10,2) NOT NULL,
    "estimated_delivery_days" integer DEFAULT 5 NOT NULL,
    "thumbnail" "text",
    "is_active" boolean DEFAULT true NOT NULL,
    "requires_scheduling" boolean DEFAULT false NOT NULL,
    "requires_property" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "is_subscription" boolean DEFAULT false NOT NULL,
    "billing_cycle" "text",
    CONSTRAINT "marketing_catalog_category_check" CHECK (("category" = ANY (ARRAY['photography'::"text", 'video'::"text", 'design'::"text", 'physical_materials'::"text", 'ads'::"text", 'social_media'::"text", 'other'::"text"]))),
    CONSTRAINT "marketing_catalog_price_check" CHECK (("price" >= (0)::numeric))
);


ALTER TABLE "public"."marketing_catalog" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."marketing_catalog_addons" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "parent_service_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text" DEFAULT ''::"text",
    "price" numeric DEFAULT 0 NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."marketing_catalog_addons" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."marketing_order_deliverables" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "order_id" "uuid" NOT NULL,
    "file_url" "text" NOT NULL,
    "file_name" "text" NOT NULL,
    "file_type" "text",
    "file_size" integer,
    "uploaded_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."marketing_order_deliverables" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."marketing_order_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "order_id" "uuid" NOT NULL,
    "catalog_item_id" "uuid",
    "pack_id" "uuid",
    "name" "text" NOT NULL,
    "price" numeric(10,2) NOT NULL,
    CONSTRAINT "marketing_order_items_check" CHECK ((("catalog_item_id" IS NOT NULL) OR ("pack_id" IS NOT NULL)))
);


ALTER TABLE "public"."marketing_order_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."marketing_orders" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "agent_id" "uuid" NOT NULL,
    "property_id" "uuid",
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "total_amount" numeric(10,2) NOT NULL,
    "rejection_reason" "text",
    "cancellation_reason" "text",
    "address" "text",
    "postal_code" "text",
    "city" "text",
    "parish" "text",
    "floor_door" "text",
    "access_instructions" "text",
    "preferred_date" "date",
    "preferred_time" "text",
    "alternative_date" "date",
    "alternative_time" "text",
    "property_type" "text",
    "typology" "text",
    "area_m2" numeric(10,2),
    "has_exteriors" boolean DEFAULT false,
    "has_facades" boolean DEFAULT false,
    "is_occupied" boolean DEFAULT false,
    "is_staged" boolean DEFAULT false,
    "number_of_divisions" integer,
    "parking_available" boolean DEFAULT false,
    "contact_is_agent" boolean DEFAULT true,
    "contact_name" "text",
    "contact_phone" "text",
    "contact_relationship" "text",
    "contact_observations" "text",
    "internal_notes" "text",
    "assigned_to" "uuid",
    "confirmed_date" "date",
    "confirmed_time" "text",
    "calendar_event_id" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "marketing_orders_alternative_time_check" CHECK (("alternative_time" = ANY (ARRAY['morning'::"text", 'afternoon'::"text", 'all_day'::"text"]))),
    CONSTRAINT "marketing_orders_preferred_time_check" CHECK (("preferred_time" = ANY (ARRAY['morning'::"text", 'afternoon'::"text", 'all_day'::"text"]))),
    CONSTRAINT "marketing_orders_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'accepted'::"text", 'scheduled'::"text", 'in_production'::"text", 'delivered'::"text", 'completed'::"text", 'rejected'::"text", 'cancelled'::"text"]))),
    CONSTRAINT "marketing_orders_total_amount_check" CHECK (("total_amount" >= (0)::numeric))
);


ALTER TABLE "public"."marketing_orders" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."marketing_pack_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "pack_id" "uuid" NOT NULL,
    "catalog_item_id" "uuid" NOT NULL
);


ALTER TABLE "public"."marketing_pack_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."marketing_packs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "description" "text" DEFAULT ''::"text" NOT NULL,
    "price" numeric(10,2) NOT NULL,
    "thumbnail" "text",
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "marketing_packs_price_check" CHECK (("price" >= (0)::numeric))
);


ALTER TABLE "public"."marketing_packs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."negocios" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "lead_id" "uuid" NOT NULL,
    "tipo" "text" NOT NULL,
    "estado" "text" DEFAULT 'Aberto'::"text",
    "observacoes" "text",
    "tipo_imovel" "text",
    "localizacao" "text",
    "area_m2" numeric,
    "quartos" integer,
    "estado_imovel" "text",
    "orcamento" numeric,
    "renda_max_mensal" numeric,
    "area_min_m2" numeric,
    "quartos_min" integer,
    "preco_venda" numeric,
    "renda_pretendida" numeric,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "orcamento_max" numeric,
    "credito_pre_aprovado" boolean,
    "valor_credito" numeric,
    "capital_proprio" numeric,
    "financiamento_necessario" boolean,
    "prazo_compra" "text",
    "motivacao_compra" "text",
    "tem_elevador" boolean,
    "tem_estacionamento" boolean,
    "tem_garagem" boolean,
    "tem_exterior" boolean,
    "tem_varanda" boolean,
    "tem_piscina" boolean,
    "tem_porteiro" boolean,
    "tem_arrumos" boolean,
    "classe_imovel" "text",
    "casas_banho" smallint,
    "num_wc" smallint,
    "total_divisoes" smallint,
    "distrito" "text",
    "concelho" "text",
    "freguesia" "text",
    "situacao_profissional" "text",
    "rendimento_mensal" numeric,
    "tem_fiador" boolean,
    "duracao_minima_contrato" "text",
    "caucao_rendas" smallint,
    "aceita_animais" boolean,
    "mobilado" boolean,
    "localizacao_venda" "text",
    "tipo_imovel_venda" "text",
    "estado_imovel_venda" "text",
    "tem_elevador_venda" boolean,
    "tem_estacionamento_venda" boolean,
    "tem_garagem_venda" boolean,
    "tem_exterior_venda" boolean,
    "tem_varanda_venda" boolean,
    "tem_piscina_venda" boolean,
    "tem_porteiro_venda" boolean,
    "tem_arrumos_venda" boolean
);


ALTER TABLE "public"."negocios" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."notifications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "recipient_id" "uuid" NOT NULL,
    "sender_id" "uuid",
    "notification_type" "text" NOT NULL,
    "entity_type" "text" NOT NULL,
    "entity_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "body" "text",
    "action_url" "text" NOT NULL,
    "is_read" boolean DEFAULT false NOT NULL,
    "read_at" timestamp with time zone,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."notifications" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."owner_beneficiaries" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "owner_id" "uuid" NOT NULL,
    "full_name" "text" NOT NULL,
    "position" "text",
    "share_percentage" "text",
    "id_doc_type" "text",
    "id_doc_number" "text",
    "id_doc_expiry" "date",
    "id_doc_issued_by" "text",
    "nif" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "owner_beneficiaries_id_doc_type_check" CHECK (("id_doc_type" = ANY (ARRAY['citizen_card'::"text", 'id_card'::"text", 'passport'::"text", 'other'::"text"])))
);


ALTER TABLE "public"."owner_beneficiaries" OWNER TO "postgres";


COMMENT ON TABLE "public"."owner_beneficiaries" IS 'Beneficiários efectivos de Pessoa Colectiva (secção B da ficha KYC)';



CREATE TABLE IF NOT EXISTS "public"."owner_role_types" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "label" "text" NOT NULL,
    "color" "text",
    "is_active" boolean DEFAULT true,
    "order_index" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."owner_role_types" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."owners" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "person_type" "text" NOT NULL,
    "name" "text" NOT NULL,
    "email" "text",
    "phone" "text",
    "nif" "text",
    "nationality" "text",
    "naturality" "text",
    "marital_status" "text",
    "address" "text",
    "legal_representative_name" "text",
    "legal_representative_nif" "text",
    "company_cert_url" "text",
    "observations" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "birth_date" "date",
    "postal_code" "text",
    "city" "text",
    "profession" "text",
    "last_profession" "text",
    "id_doc_type" "text",
    "id_doc_number" "text",
    "id_doc_expiry" "date",
    "id_doc_issued_by" "text",
    "is_portugal_resident" boolean DEFAULT true,
    "residence_country" "text",
    "marital_regime" "text",
    "is_pep" boolean DEFAULT false,
    "pep_position" "text",
    "funds_origin" "text"[] DEFAULT '{}'::"text"[],
    "legal_rep_id_doc" "text",
    "company_object" "text",
    "company_branches" "text",
    "legal_nature" "text",
    "country_of_incorporation" "text",
    "cae_code" "text",
    "rcbe_code" "text",
    "beneficiaries_json" "jsonb" DEFAULT '[]'::"jsonb",
    CONSTRAINT "owners_id_doc_type_check" CHECK (("id_doc_type" = ANY (ARRAY['citizen_card'::"text", 'id_card'::"text", 'passport'::"text", 'other'::"text"]))),
    CONSTRAINT "owners_person_type_check" CHECK (("person_type" = ANY (ARRAY['singular'::"text", 'coletiva'::"text"])))
);


ALTER TABLE "public"."owners" OWNER TO "postgres";


COMMENT ON COLUMN "public"."owners"."birth_date" IS 'Data de nascimento (Pessoa Singular)';



COMMENT ON COLUMN "public"."owners"."postal_code" IS 'Código postal da morada';



COMMENT ON COLUMN "public"."owners"."city" IS 'Localidade da morada';



COMMENT ON COLUMN "public"."owners"."profession" IS 'Profissão actual';



COMMENT ON COLUMN "public"."owners"."last_profession" IS 'Última profissão exercida (se reformado/desempregado)';



COMMENT ON COLUMN "public"."owners"."id_doc_type" IS 'Tipo de documento: citizen_card | id_card | passport | other';



COMMENT ON COLUMN "public"."owners"."id_doc_number" IS 'Número do documento de identificação';



COMMENT ON COLUMN "public"."owners"."id_doc_expiry" IS 'Data de validade do documento de identificação';



COMMENT ON COLUMN "public"."owners"."id_doc_issued_by" IS 'Entidade emissora do documento';



COMMENT ON COLUMN "public"."owners"."is_portugal_resident" IS 'Residente em Portugal';



COMMENT ON COLUMN "public"."owners"."residence_country" IS 'País de residência (se não residente em Portugal)';



COMMENT ON COLUMN "public"."owners"."marital_regime" IS 'Regime de bens (se casado)';



COMMENT ON COLUMN "public"."owners"."is_pep" IS 'Pessoa Politicamente Exposta';



COMMENT ON COLUMN "public"."owners"."pep_position" IS 'Cargo(s) PPE identificado(s)';



COMMENT ON COLUMN "public"."owners"."funds_origin" IS 'Proveniência dos fundos: financing | inheritance | personal_savings | professional_income | other';



COMMENT ON COLUMN "public"."owners"."legal_rep_id_doc" IS 'Nº documento de identificação do representante legal';



COMMENT ON COLUMN "public"."owners"."company_object" IS 'Objeto social (Pessoa Colectiva)';



COMMENT ON COLUMN "public"."owners"."company_branches" IS 'Sucursais, agências, delegações (Pessoa Colectiva)';



COMMENT ON COLUMN "public"."owners"."legal_nature" IS 'Natureza jurídica (Pessoa Colectiva)';



COMMENT ON COLUMN "public"."owners"."country_of_incorporation" IS 'País de constituição (Pessoa Colectiva)';



COMMENT ON COLUMN "public"."owners"."cae_code" IS 'Código CAE (Pessoa Colectiva)';



COMMENT ON COLUMN "public"."owners"."rcbe_code" IS 'Código RCBE — alternativa à lista de beneficiários efectivos';



CREATE TABLE IF NOT EXISTS "public"."proc_alert_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "proc_instance_id" "uuid" NOT NULL,
    "entity_type" "text" NOT NULL,
    "entity_id" "uuid" NOT NULL,
    "event_type" "text" NOT NULL,
    "channel" "text" NOT NULL,
    "recipient_id" "uuid",
    "recipient_address" "text",
    "status" "text" DEFAULT 'sent'::"text" NOT NULL,
    "error_message" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."proc_alert_log" OWNER TO "postgres";


COMMENT ON TABLE "public"."proc_alert_log" IS 'Registo de todos os alertas enviados (notificação in-app, email, WhatsApp) vinculados a tarefas e subtarefas.';



CREATE TABLE IF NOT EXISTS "public"."proc_chat_attachments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "message_id" "uuid" NOT NULL,
    "file_name" "text" NOT NULL,
    "file_url" "text" NOT NULL,
    "file_size" bigint,
    "mime_type" "text",
    "attachment_type" "text" DEFAULT 'file'::"text" NOT NULL,
    "storage_key" "text" NOT NULL,
    "uploaded_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."proc_chat_attachments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."proc_chat_messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "proc_instance_id" "uuid" NOT NULL,
    "sender_id" "uuid" NOT NULL,
    "content" "text" NOT NULL,
    "parent_message_id" "uuid",
    "mentions" "jsonb" DEFAULT '[]'::"jsonb",
    "has_attachments" boolean DEFAULT false,
    "is_deleted" boolean DEFAULT false,
    "deleted_at" timestamp with time zone,
    "is_edited" boolean DEFAULT false,
    "edited_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."proc_chat_messages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."proc_chat_reactions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "message_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "emoji" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."proc_chat_reactions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."proc_chat_read_receipts" (
    "proc_instance_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "last_read_message_id" "uuid",
    "last_read_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."proc_chat_read_receipts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."proc_instances" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "property_id" "uuid" NOT NULL,
    "tpl_process_id" "uuid",
    "external_ref" "text",
    "current_status" "text" DEFAULT 'draft'::"text",
    "current_stage_id" "uuid",
    "percent_complete" integer DEFAULT 0,
    "started_at" timestamp with time zone DEFAULT "now"(),
    "completed_at" timestamp with time zone,
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "requested_by" "uuid",
    "approved_by" "uuid",
    "approved_at" timestamp with time zone,
    "returned_at" timestamp with time zone,
    "returned_reason" "text",
    "rejected_at" timestamp with time zone,
    "rejected_reason" "text",
    "notes" "text",
    "returned_by" "uuid",
    "rejected_by" "uuid",
    "deleted_at" timestamp with time zone,
    "deleted_by" "uuid",
    "negocio_id" "uuid",
    "last_completed_step" integer DEFAULT 0,
    "process_type" "text" DEFAULT 'angariacao'::"text" NOT NULL,
    CONSTRAINT "chk_process_type" CHECK (("process_type" = ANY (ARRAY['angariacao'::"text", 'venda'::"text", 'compra'::"text"])))
);


ALTER TABLE "public"."proc_instances" OWNER TO "postgres";


COMMENT ON COLUMN "public"."proc_instances"."returned_by" IS 'UUID do utilizador que devolveu o processo';



COMMENT ON COLUMN "public"."proc_instances"."rejected_by" IS 'UUID do utilizador que rejeitou o processo';



COMMENT ON COLUMN "public"."proc_instances"."deleted_at" IS 'Timestamp de quando o processo foi eliminado (soft-delete)';



COMMENT ON COLUMN "public"."proc_instances"."deleted_by" IS 'ID do utilizador que eliminou o processo';



CREATE SEQUENCE IF NOT EXISTS "public"."proc_ref_seq_global"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."proc_ref_seq_global" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."proc_subtasks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "proc_task_id" "uuid" NOT NULL,
    "tpl_subtask_id" "uuid",
    "title" "text" NOT NULL,
    "is_mandatory" boolean DEFAULT true,
    "is_completed" boolean DEFAULT false,
    "completed_at" timestamp with time zone,
    "completed_by" "uuid",
    "order_index" integer DEFAULT 0 NOT NULL,
    "config" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "owner_id" "uuid",
    "due_date" timestamp with time zone,
    "assigned_to" "uuid",
    "assigned_role" "text",
    "priority" "text" DEFAULT 'normal'::"text" NOT NULL,
    "started_at" timestamp with time zone,
    "is_blocked" boolean DEFAULT false NOT NULL,
    "dependency_type" "text" DEFAULT 'none'::"text",
    "dependency_proc_subtask_id" "uuid",
    "dependency_proc_task_id" "uuid",
    "unblocked_at" timestamp with time zone
);


ALTER TABLE "public"."proc_subtasks" OWNER TO "postgres";


COMMENT ON TABLE "public"."proc_subtasks" IS 'Subtarefas instanciadas de um processo. Checklist items com estado individual.';



COMMENT ON COLUMN "public"."proc_subtasks"."owner_id" IS 'Proprietário associado (quando subtarefa é multiplicada por owner via tpl_subtasks.config.owner_scope)';



COMMENT ON COLUMN "public"."proc_subtasks"."due_date" IS 'Data limite calculada a partir de sla_days.';



COMMENT ON COLUMN "public"."proc_subtasks"."assigned_to" IS 'Utilizador atribuído a esta subtarefa.';



COMMENT ON COLUMN "public"."proc_subtasks"."assigned_role" IS 'Role copiado do template.';



COMMENT ON COLUMN "public"."proc_subtasks"."priority" IS 'Prioridade: urgent, normal, low.';



COMMENT ON COLUMN "public"."proc_subtasks"."started_at" IS 'Quando a subtarefa foi iniciada.';



CREATE TABLE IF NOT EXISTS "public"."proc_task_activities" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "proc_task_id" "uuid" NOT NULL,
    "user_id" "uuid",
    "activity_type" "text" NOT NULL,
    "description" "text" NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."proc_task_activities" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."proc_task_comments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "proc_task_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "content" "text" NOT NULL,
    "mentions" "jsonb" DEFAULT '[]'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."proc_task_comments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."proc_tasks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "proc_instance_id" "uuid" NOT NULL,
    "tpl_task_id" "uuid",
    "title" "text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text",
    "is_mandatory" boolean DEFAULT true,
    "is_bypassed" boolean DEFAULT false,
    "bypass_reason" "text",
    "bypassed_by" "uuid",
    "assigned_to" "uuid",
    "due_date" timestamp with time zone,
    "completed_at" timestamp with time zone,
    "task_result" "jsonb" DEFAULT '{}'::"jsonb",
    "stage_name" "text",
    "stage_order_index" integer,
    "action_type" "text",
    "config" "jsonb" DEFAULT '{}'::"jsonb",
    "assigned_role" "text",
    "order_index" integer DEFAULT 0,
    "owner_id" "uuid",
    "priority" "text" DEFAULT 'normal'::"text" NOT NULL,
    "started_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "is_blocked" boolean DEFAULT false NOT NULL,
    "dependency_proc_task_id" "uuid",
    "unblocked_at" timestamp with time zone,
    CONSTRAINT "proc_tasks_priority_check" CHECK (("priority" = ANY (ARRAY['urgent'::"text", 'normal'::"text", 'low'::"text"])))
);


ALTER TABLE "public"."proc_tasks" OWNER TO "postgres";


COMMENT ON COLUMN "public"."proc_tasks"."order_index" IS 'Ordem da tarefa dentro da fase, copiada do template';



COMMENT ON COLUMN "public"."proc_tasks"."owner_id" IS 'Proprietário associado a esta tarefa. Preenchido na instanciação para tarefas de docs de proprietário (multiplicadas por owner).';



COMMENT ON COLUMN "public"."proc_tasks"."priority" IS 'Prioridade da tarefa: urgent, normal, low. Herdada do template, editável pelo utilizador.';



COMMENT ON COLUMN "public"."proc_tasks"."started_at" IS 'Timestamp de quando a tarefa foi iniciada (status -> in_progress).';



COMMENT ON COLUMN "public"."proc_tasks"."created_at" IS 'Timestamp de criação da tarefa.';



CREATE TABLE IF NOT EXISTS "public"."property_listings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "external_reference_id" "text",
    "consultant_id" "uuid",
    "consultant_name" "text",
    "full_address_template" "text",
    "postal_locality_template" "text",
    "property_address" "text",
    "postal_code" "text",
    "parish" "text",
    "zone" "text",
    "locality" "text",
    "property_type" "text",
    "typology" "text",
    "property_condition" "text",
    "occupancy_status" "text",
    "construction_year" integer,
    "has_elevator" boolean,
    "bathrooms_count" integer,
    "fronts_count" integer,
    "solar_orientation" "text",
    "views" "text",
    "equipment" "text",
    "other_equipment" "text",
    "storage_area" numeric(10,2),
    "balcony_area" numeric(10,2),
    "garage_spaces" integer,
    "parking_spaces" integer,
    "pool_area" numeric(10,2),
    "attic_area" numeric(10,2),
    "pantry_area" numeric(10,2),
    "gym_area" numeric(10,2),
    "business_type" "text",
    "listing_price" numeric(12,2),
    "commission_rate" numeric(10,2),
    "imi_value" numeric(10,2),
    "condominium_fee" numeric(10,2),
    "contract_regime" "text",
    "contract_term" "text",
    "cmi_date" "date",
    "approval_date" "date",
    "cpcv_payment_percentage" numeric(5,2),
    "deed_payment_percentage" numeric(5,2),
    "owner_type" "text",
    "owners_count" integer,
    "has_referral" boolean DEFAULT false,
    "referral_type" "text",
    "referral_percentage" numeric(5,2),
    "referral_colleague_info" "text",
    "external_listing" "text",
    "property_notes" "text",
    "property_observations" "text",
    "deal_notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "energy_certificate" "text",
    "area_bruta" integer,
    "area_util" integer,
    CONSTRAINT "property_listings_owner_type_check" CHECK (("owner_type" = ANY (ARRAY['Singular'::"text", 'Coletiva'::"text"]))),
    CONSTRAINT "property_listings_referral_type_check" CHECK (("referral_type" = ANY (ARRAY['Interna'::"text", 'Externa'::"text"])))
);


ALTER TABLE "public"."property_listings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."property_owners" (
    "property_id" "uuid" NOT NULL,
    "owner_id" "uuid" NOT NULL,
    "ownership_percentage" numeric(5,2) DEFAULT 100.00,
    "is_main_contact" boolean DEFAULT false,
    "owner_role_id" "uuid" NOT NULL
);


ALTER TABLE "public"."property_owners" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ref_counters" (
    "prefix" "text" NOT NULL,
    "year" integer NOT NULL,
    "counter" integer DEFAULT 0 NOT NULL
);


ALTER TABLE "public"."ref_counters" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."roles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" character varying(100) NOT NULL,
    "description" "text",
    "permissions" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."roles" OWNER TO "postgres";


COMMENT ON TABLE "public"."roles" IS 'System roles with permissions for Infinity Group ERP';



COMMENT ON COLUMN "public"."roles"."permissions" IS 'JSON object containing boolean permissions for each module';



CREATE TABLE IF NOT EXISTS "public"."tpl_doc_library" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "content_html" "text" NOT NULL,
    "doc_type_id" "uuid",
    "description" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "letterhead_url" "text",
    "letterhead_file_name" "text",
    "letterhead_file_type" "text"
);


ALTER TABLE "public"."tpl_doc_library" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tpl_email_library" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "subject" "text" NOT NULL,
    "body_html" "text" NOT NULL,
    "description" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "editor_state" "jsonb",
    "created_by" "uuid",
    "usage_count" integer DEFAULT 0 NOT NULL
);


ALTER TABLE "public"."tpl_email_library" OWNER TO "postgres";


COMMENT ON COLUMN "public"."tpl_email_library"."editor_state" IS 'JSON serializado do estado do editor craft.js. body_html é gerado a partir deste JSON.';



CREATE TABLE IF NOT EXISTS "public"."tpl_form_templates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "category" "text",
    "is_active" boolean DEFAULT true,
    "sections" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."tpl_form_templates" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tpl_processes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "process_type" "text" DEFAULT 'angariacao'::"text" NOT NULL,
    "deleted_at" timestamp with time zone,
    CONSTRAINT "chk_tpl_process_type" CHECK (("process_type" = ANY (ARRAY['angariacao'::"text", 'venda'::"text", 'compra'::"text"])))
);


ALTER TABLE "public"."tpl_processes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tpl_stages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tpl_process_id" "uuid",
    "name" "text" NOT NULL,
    "order_index" integer NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "description" "text"
);


ALTER TABLE "public"."tpl_stages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tpl_subtasks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tpl_task_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "is_mandatory" boolean DEFAULT true,
    "order_index" integer DEFAULT 0 NOT NULL,
    "config" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "sla_days" integer,
    "assigned_role" "text",
    "priority" "text" DEFAULT 'normal'::"text" NOT NULL,
    "dependency_type" "text" DEFAULT 'none'::"text",
    "dependency_subtask_id" "uuid",
    "dependency_task_id" "uuid"
);


ALTER TABLE "public"."tpl_subtasks" OWNER TO "postgres";


COMMENT ON TABLE "public"."tpl_subtasks" IS 'Subtarefas/checklist items de uma tarefa de template. Ex: lista de campos KYC a preencher ou docs a carregar.';



COMMENT ON COLUMN "public"."tpl_subtasks"."sla_days" IS 'Prazo em dias para completar a subtarefa.';



COMMENT ON COLUMN "public"."tpl_subtasks"."assigned_role" IS 'Role responsável (Processual, Consultor, Broker/CEO).';



COMMENT ON COLUMN "public"."tpl_subtasks"."priority" IS 'Prioridade: urgent, normal, low.';



COMMENT ON COLUMN "public"."tpl_subtasks"."dependency_type" IS 'Tipo de dependência: none, subtask, task';



COMMENT ON COLUMN "public"."tpl_subtasks"."dependency_subtask_id" IS 'Subtarefa de que depende (quando dependency_type = subtask)';



COMMENT ON COLUMN "public"."tpl_subtasks"."dependency_task_id" IS 'Tarefa de que depende (quando dependency_type = task)';



CREATE TABLE IF NOT EXISTS "public"."tpl_tasks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tpl_stage_id" "uuid",
    "title" "text" NOT NULL,
    "description" "text",
    "action_type" "text" NOT NULL,
    "is_mandatory" boolean DEFAULT true,
    "dependency_task_id" "uuid",
    "sla_days" integer,
    "config" "jsonb" DEFAULT '{}'::"jsonb",
    "order_index" integer NOT NULL,
    "assigned_role" "text",
    "priority" "text" DEFAULT 'normal'::"text" NOT NULL,
    CONSTRAINT "tpl_tasks_priority_check" CHECK (("priority" = ANY (ARRAY['urgent'::"text", 'normal'::"text", 'low'::"text"])))
);


ALTER TABLE "public"."tpl_tasks" OWNER TO "postgres";


COMMENT ON COLUMN "public"."tpl_tasks"."config" IS 'Configuração JSON. Para UPLOAD: {doc_type_id, owner_type?}. owner_type: "singular"|"coletiva" indica que a tarefa é multiplicada por proprietário na instanciação.';



COMMENT ON COLUMN "public"."tpl_tasks"."priority" IS 'Prioridade default da tarefa: urgent, normal, low. Copiada para proc_tasks na instanciação.';



CREATE TABLE IF NOT EXISTS "public"."tpl_variables" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "key" "text" NOT NULL,
    "label" "text" NOT NULL,
    "category" "text" NOT NULL,
    "source_entity" "text" NOT NULL,
    "source_table" "text",
    "source_column" "text",
    "format_type" "text" DEFAULT 'text'::"text" NOT NULL,
    "format_config" "jsonb",
    "static_value" "text",
    "is_system" boolean DEFAULT false NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "order_index" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "category_color" "text" DEFAULT '#6B7280'::"text"
);


ALTER TABLE "public"."tpl_variables" OWNER TO "postgres";


COMMENT ON TABLE "public"."tpl_variables" IS 'Template variables for email/document templates. Each variable maps to a DB table/column for dynamic resolution.';



COMMENT ON COLUMN "public"."tpl_variables"."key" IS 'Variable key used in templates as {{key}}';



COMMENT ON COLUMN "public"."tpl_variables"."source_entity" IS 'Entity type that provides context: property, owner, consultant, process, system';



COMMENT ON COLUMN "public"."tpl_variables"."source_table" IS 'Database table to query. NULL for system-computed variables';



COMMENT ON COLUMN "public"."tpl_variables"."source_column" IS 'Column to read from source_table. NULL for concat/system types';



COMMENT ON COLUMN "public"."tpl_variables"."format_type" IS 'Value formatting: text (raw), currency (EUR format), date (locale format), concat (join multiple columns)';



COMMENT ON COLUMN "public"."tpl_variables"."format_config" IS 'JSON config for formatters. concat: {columns, separator}, currency: {currency, locale}, date: {locale, format}';



CREATE TABLE IF NOT EXISTS "public"."user_contracts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "file_url" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."user_contracts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_roles" (
    "user_id" "uuid" NOT NULL,
    "role_id" "uuid" NOT NULL,
    "assigned_at" timestamp with time zone DEFAULT "now"(),
    "assigned_by" "uuid"
);


ALTER TABLE "public"."user_roles" OWNER TO "postgres";


COMMENT ON TABLE "public"."user_roles" IS 'Tabela de associação entre utilizadores e roles (M:N)';



COMMENT ON COLUMN "public"."user_roles"."user_id" IS 'ID do utilizador';



COMMENT ON COLUMN "public"."user_roles"."role_id" IS 'ID do role';



COMMENT ON COLUMN "public"."user_roles"."assigned_at" IS 'Data de atribuição do role';



COMMENT ON COLUMN "public"."user_roles"."assigned_by" IS 'ID do utilizador que atribuiu o role';



CREATE TABLE IF NOT EXISTS "public"."users" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "full_name" "text",
    "commercial_name" "text",
    "bio" "text",
    "is_active" boolean DEFAULT true,
    "date_of_birth" "date",
    "birthplace" "text",
    "nationality" "text",
    "identity_card" "text",
    "identity_card_validity" "date",
    "nif" "text",
    "professional_email" "text",
    "personal_email" "text",
    "phone_primary" "text",
    "phone_secondary" "text",
    "address_line1" "text",
    "address_line2" "text",
    "city" "text",
    "postal_code" "text",
    "district" "text",
    "country" "text" DEFAULT 'Portugal'::"text",
    "role_id" "uuid",
    "department" "text",
    "license_number" "text",
    "hire_date" "date",
    "termination_date" "date",
    "specializations" "text"[],
    "languages" "text"[],
    "previous_agency" "text",
    "iban" "text",
    "commission_value" numeric(5,2),
    "monthly_salary" numeric(10,2),
    "agreed_value" numeric(10,2),
    "entity_type" "text",
    "tax_regime" "text",
    "green_receipt" boolean,
    "professional_activity" "text",
    "company_name" "text",
    "company_nif" "text",
    "company_address" "text",
    "company_email" "text",
    "company_iban" "text",
    "profile_photo_url" "text",
    "photo_url" "text",
    "instagram_handle" "text",
    "linkedin_url" "text",
    "facebook_url" "text",
    "documents" "jsonb" DEFAULT '{"other": [], "id_card": null, "contract": null}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "display_website" boolean DEFAULT false,
    "sub_role" "text",
    "profile_photo_crop" "jsonb",
    "identity_card_url" "text",
    "tipo_documento" "text",
    "pais_emissor" "text",
    "genero" "text",
    CONSTRAINT "users_entity_type_check" CHECK (("entity_type" = ANY (ARRAY['individual'::"text", 'company'::"text", 'recibos_verdes'::"text"])))
);


ALTER TABLE "public"."users" OWNER TO "postgres";


ALTER TABLE ONLY "public"."auto_delivery_log"
    ADD CONSTRAINT "auto_delivery_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."auto_flow_versions"
    ADD CONSTRAINT "auto_flow_versions_flow_id_version_key" UNIQUE ("flow_id", "version");



ALTER TABLE ONLY "public"."auto_flow_versions"
    ADD CONSTRAINT "auto_flow_versions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."auto_flows"
    ADD CONSTRAINT "auto_flows_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."auto_runs"
    ADD CONSTRAINT "auto_runs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."auto_step_runs"
    ADD CONSTRAINT "auto_step_runs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."auto_triggers"
    ADD CONSTRAINT "auto_triggers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."auto_webhook_captures"
    ADD CONSTRAINT "auto_webhook_captures_pkey" PRIMARY KEY ("source_id");



ALTER TABLE ONLY "public"."auto_wpp_instances"
    ADD CONSTRAINT "auto_wpp_instances_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."auto_wpp_templates"
    ADD CONSTRAINT "auto_wpp_templates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."consultant_documents"
    ADD CONSTRAINT "consultant_documents_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."conta_corrente_limits"
    ADD CONSTRAINT "conta_corrente_limits_agent_id_key" UNIQUE ("agent_id");



ALTER TABLE ONLY "public"."conta_corrente_limits"
    ADD CONSTRAINT "conta_corrente_limits_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."conta_corrente_transactions"
    ADD CONSTRAINT "conta_corrente_transactions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."contact_form_submissions"
    ADD CONSTRAINT "contact_form_submissions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."dev_consultant_private_data"
    ADD CONSTRAINT "dev_consultant_private_data_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."dev_consultant_profiles"
    ADD CONSTRAINT "dev_consultant_profiles_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."dev_properties"
    ADD CONSTRAINT "dev_properties_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."dev_properties"
    ADD CONSTRAINT "dev_properties_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."dev_property_internal"
    ADD CONSTRAINT "dev_property_internal_pkey" PRIMARY KEY ("property_id");



ALTER TABLE ONLY "public"."dev_property_media"
    ADD CONSTRAINT "dev_property_media_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."dev_property_specifications"
    ADD CONSTRAINT "dev_property_specifications_pkey" PRIMARY KEY ("property_id");



ALTER TABLE ONLY "public"."dev_users"
    ADD CONSTRAINT "dev_users_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."dev_users"
    ADD CONSTRAINT "dev_users_professional_email_key" UNIQUE ("professional_email");



ALTER TABLE ONLY "public"."doc_registry"
    ADD CONSTRAINT "doc_registry_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."doc_types"
    ADD CONSTRAINT "doc_types_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."doc_types"
    ADD CONSTRAINT "doc_types_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."email_senders"
    ADD CONSTRAINT "email_senders_email_key" UNIQUE ("email");



ALTER TABLE ONLY "public"."email_senders"
    ADD CONSTRAINT "email_senders_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."embarcacoes"
    ADD CONSTRAINT "embarcacoes_numero_registo_key" UNIQUE ("numero_registo");



ALTER TABLE ONLY "public"."embarcacoes"
    ADD CONSTRAINT "embarcacoes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."kv_store_6f39db24"
    ADD CONSTRAINT "kv_store_6f39db24_pkey" PRIMARY KEY ("key");



ALTER TABLE ONLY "public"."lead_attachments"
    ADD CONSTRAINT "lead_attachments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."leads"
    ADD CONSTRAINT "leads_email_unique" UNIQUE ("email");



ALTER TABLE ONLY "public"."leads"
    ADD CONSTRAINT "leads_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."log_audit"
    ADD CONSTRAINT "log_audit_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."log_emails"
    ADD CONSTRAINT "log_emails_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."marketing_catalog_addons"
    ADD CONSTRAINT "marketing_catalog_addons_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."marketing_catalog"
    ADD CONSTRAINT "marketing_catalog_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."marketing_order_deliverables"
    ADD CONSTRAINT "marketing_order_deliverables_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."marketing_order_items"
    ADD CONSTRAINT "marketing_order_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."marketing_orders"
    ADD CONSTRAINT "marketing_orders_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."marketing_pack_items"
    ADD CONSTRAINT "marketing_pack_items_pack_id_catalog_item_id_key" UNIQUE ("pack_id", "catalog_item_id");



ALTER TABLE ONLY "public"."marketing_pack_items"
    ADD CONSTRAINT "marketing_pack_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."marketing_packs"
    ADD CONSTRAINT "marketing_packs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."negocios"
    ADD CONSTRAINT "negocios_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."owner_beneficiaries"
    ADD CONSTRAINT "owner_beneficiaries_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."owner_role_types"
    ADD CONSTRAINT "owner_role_types_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."owner_role_types"
    ADD CONSTRAINT "owner_role_types_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."owners"
    ADD CONSTRAINT "owners_nif_key" UNIQUE ("nif");



ALTER TABLE ONLY "public"."owners"
    ADD CONSTRAINT "owners_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."proc_alert_log"
    ADD CONSTRAINT "proc_alert_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."proc_chat_attachments"
    ADD CONSTRAINT "proc_chat_attachments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."proc_chat_messages"
    ADD CONSTRAINT "proc_chat_messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."proc_chat_reactions"
    ADD CONSTRAINT "proc_chat_reactions_message_id_user_id_emoji_key" UNIQUE ("message_id", "user_id", "emoji");



ALTER TABLE ONLY "public"."proc_chat_reactions"
    ADD CONSTRAINT "proc_chat_reactions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."proc_chat_read_receipts"
    ADD CONSTRAINT "proc_chat_read_receipts_pkey" PRIMARY KEY ("proc_instance_id", "user_id");



ALTER TABLE ONLY "public"."proc_instances"
    ADD CONSTRAINT "proc_instances_external_ref_key" UNIQUE ("external_ref");



ALTER TABLE ONLY "public"."proc_instances"
    ADD CONSTRAINT "proc_instances_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."proc_subtasks"
    ADD CONSTRAINT "proc_subtasks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."proc_task_activities"
    ADD CONSTRAINT "proc_task_activities_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."proc_task_comments"
    ADD CONSTRAINT "proc_task_comments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."proc_tasks"
    ADD CONSTRAINT "proc_tasks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."property_listings"
    ADD CONSTRAINT "property_listings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."property_owners"
    ADD CONSTRAINT "property_owners_pkey" PRIMARY KEY ("property_id", "owner_id");



ALTER TABLE ONLY "public"."ref_counters"
    ADD CONSTRAINT "ref_counters_pkey" PRIMARY KEY ("prefix", "year");



ALTER TABLE ONLY "public"."roles"
    ADD CONSTRAINT "roles_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."roles"
    ADD CONSTRAINT "roles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tpl_doc_library"
    ADD CONSTRAINT "tpl_doc_library_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tpl_email_library"
    ADD CONSTRAINT "tpl_email_library_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tpl_form_templates"
    ADD CONSTRAINT "tpl_form_templates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tpl_processes"
    ADD CONSTRAINT "tpl_processes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tpl_stages"
    ADD CONSTRAINT "tpl_stages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tpl_subtasks"
    ADD CONSTRAINT "tpl_subtasks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tpl_tasks"
    ADD CONSTRAINT "tpl_tasks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tpl_variables"
    ADD CONSTRAINT "tpl_variables_key_key" UNIQUE ("key");



ALTER TABLE ONLY "public"."tpl_variables"
    ADD CONSTRAINT "tpl_variables_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_contracts"
    ADD CONSTRAINT "user_contracts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_pkey" PRIMARY KEY ("user_id", "role_id");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_pkey" PRIMARY KEY ("id");



CREATE INDEX "idx_auto_delivery_run" ON "public"."auto_delivery_log" USING "btree" ("run_id", "created_at" DESC);



CREATE INDEX "idx_auto_delivery_step" ON "public"."auto_delivery_log" USING "btree" ("step_run_id");



CREATE INDEX "idx_auto_flow_versions" ON "public"."auto_flow_versions" USING "btree" ("flow_id", "version" DESC);



CREATE INDEX "idx_auto_flows_active" ON "public"."auto_flows" USING "btree" ("is_active") WHERE ("is_active" = true);



CREATE INDEX "idx_auto_runs_entity" ON "public"."auto_runs" USING "btree" ("entity_type", "entity_id") WHERE ("entity_id" IS NOT NULL);



CREATE INDEX "idx_auto_runs_flow" ON "public"."auto_runs" USING "btree" ("flow_id", "created_at" DESC);



CREATE INDEX "idx_auto_runs_is_test" ON "public"."auto_runs" USING "btree" ("is_test") WHERE ("is_test" = true);



CREATE INDEX "idx_auto_runs_status" ON "public"."auto_runs" USING "btree" ("status") WHERE ("status" = ANY (ARRAY['pending'::"public"."auto_run_status", 'queued'::"public"."auto_run_status", 'running'::"public"."auto_run_status"]));



CREATE INDEX "idx_auto_step_runs_pending" ON "public"."auto_step_runs" USING "btree" ("priority" DESC, "scheduled_for") WHERE ("status" = 'pending'::"public"."auto_step_status");



CREATE INDEX "idx_auto_step_runs_run" ON "public"."auto_step_runs" USING "btree" ("run_id", "created_at");



CREATE INDEX "idx_auto_triggers_flow" ON "public"."auto_triggers" USING "btree" ("flow_id", "active") WHERE ("active" = true);



CREATE INDEX "idx_auto_triggers_webhook" ON "public"."auto_triggers" USING "btree" ("trigger_source") WHERE (("source_type" = 'webhook'::"text") AND ("active" = true));



CREATE INDEX "idx_auto_wpp_inst_status" ON "public"."auto_wpp_instances" USING "btree" ("connection_status") WHERE ("status" = 'active'::"text");



CREATE INDEX "idx_auto_wpp_inst_user" ON "public"."auto_wpp_instances" USING "btree" ("user_id") WHERE ("user_id" IS NOT NULL);



CREATE INDEX "idx_auto_wpp_tpl_active" ON "public"."auto_wpp_templates" USING "btree" ("is_active", "category") WHERE ("is_active" = true);



CREATE INDEX "idx_catalog_addons_parent" ON "public"."marketing_catalog_addons" USING "btree" ("parent_service_id");



CREATE INDEX "idx_consultant_documents_consultant" ON "public"."consultant_documents" USING "btree" ("consultant_id");



CREATE INDEX "idx_conta_corrente_agent" ON "public"."conta_corrente_transactions" USING "btree" ("agent_id");



CREATE INDEX "idx_conta_corrente_date" ON "public"."conta_corrente_transactions" USING "btree" ("date");



CREATE INDEX "idx_contact_submissions_created_at" ON "public"."contact_form_submissions" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_contact_submissions_email" ON "public"."contact_form_submissions" USING "btree" ("email");



CREATE INDEX "idx_contact_submissions_status" ON "public"."contact_form_submissions" USING "btree" ("status");



CREATE INDEX "idx_doc_registry_owner_id" ON "public"."doc_registry" USING "btree" ("owner_id");



CREATE INDEX "idx_form_templates_active" ON "public"."tpl_form_templates" USING "btree" ("is_active", "category");



CREATE INDEX "idx_log_emails_resend_id" ON "public"."log_emails" USING "btree" ("resend_email_id");



CREATE INDEX "idx_log_emails_subtask" ON "public"."log_emails" USING "btree" ("proc_subtask_id");



CREATE INDEX "idx_log_emails_task" ON "public"."log_emails" USING "btree" ("proc_task_id");



CREATE INDEX "idx_marketing_catalog_active" ON "public"."marketing_catalog" USING "btree" ("is_active");



CREATE INDEX "idx_marketing_catalog_category" ON "public"."marketing_catalog" USING "btree" ("category");



CREATE INDEX "idx_marketing_orders_agent" ON "public"."marketing_orders" USING "btree" ("agent_id");



CREATE INDEX "idx_marketing_orders_property" ON "public"."marketing_orders" USING "btree" ("property_id");



CREATE INDEX "idx_marketing_orders_status" ON "public"."marketing_orders" USING "btree" ("status");



CREATE INDEX "idx_notifications_entity" ON "public"."notifications" USING "btree" ("entity_type", "entity_id");



CREATE INDEX "idx_notifications_recipient_created" ON "public"."notifications" USING "btree" ("recipient_id", "created_at" DESC);



CREATE INDEX "idx_notifications_recipient_unread" ON "public"."notifications" USING "btree" ("recipient_id", "is_read", "created_at" DESC) WHERE ("is_read" = false);



CREATE INDEX "idx_owner_beneficiaries_owner_id" ON "public"."owner_beneficiaries" USING "btree" ("owner_id");



CREATE INDEX "idx_proc_alert_log_entity" ON "public"."proc_alert_log" USING "btree" ("entity_type", "entity_id", "event_type");



CREATE INDEX "idx_proc_alert_log_instance" ON "public"."proc_alert_log" USING "btree" ("proc_instance_id", "created_at" DESC);



CREATE INDEX "idx_proc_chat_attachments_message" ON "public"."proc_chat_attachments" USING "btree" ("message_id");



CREATE INDEX "idx_proc_chat_messages_instance" ON "public"."proc_chat_messages" USING "btree" ("proc_instance_id", "created_at" DESC);



CREATE INDEX "idx_proc_chat_messages_parent" ON "public"."proc_chat_messages" USING "btree" ("parent_message_id") WHERE ("parent_message_id" IS NOT NULL);



CREATE INDEX "idx_proc_chat_messages_sender" ON "public"."proc_chat_messages" USING "btree" ("sender_id");



CREATE INDEX "idx_proc_chat_reactions_message" ON "public"."proc_chat_reactions" USING "btree" ("message_id");



CREATE INDEX "idx_proc_instances_deleted_at" ON "public"."proc_instances" USING "btree" ("deleted_at") WHERE ("deleted_at" IS NULL);



CREATE INDEX "idx_proc_instances_draft" ON "public"."proc_instances" USING "btree" ("current_status") WHERE ("current_status" = 'draft'::"text");



CREATE INDEX "idx_proc_instances_negocio_id" ON "public"."proc_instances" USING "btree" ("negocio_id");



CREATE INDEX "idx_proc_instances_property" ON "public"."proc_instances" USING "btree" ("property_id");



CREATE INDEX "idx_proc_instances_status" ON "public"."proc_instances" USING "btree" ("current_status");



CREATE INDEX "idx_proc_instances_type" ON "public"."proc_instances" USING "btree" ("process_type");



CREATE INDEX "idx_proc_subtasks_assigned_to" ON "public"."proc_subtasks" USING "btree" ("assigned_to") WHERE ("is_completed" = false);



CREATE INDEX "idx_proc_subtasks_blocked" ON "public"."proc_subtasks" USING "btree" ("is_blocked") WHERE ("is_blocked" = true);



CREATE INDEX "idx_proc_subtasks_due_date" ON "public"."proc_subtasks" USING "btree" ("due_date") WHERE (("is_completed" = false) AND ("due_date" IS NOT NULL));



CREATE INDEX "idx_proc_subtasks_incomplete" ON "public"."proc_subtasks" USING "btree" ("proc_task_id") WHERE ("is_completed" = false);



CREATE INDEX "idx_proc_subtasks_owner_id" ON "public"."proc_subtasks" USING "btree" ("owner_id");



CREATE INDEX "idx_proc_subtasks_task" ON "public"."proc_subtasks" USING "btree" ("proc_task_id");



CREATE INDEX "idx_proc_task_activities_created" ON "public"."proc_task_activities" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_proc_task_activities_task" ON "public"."proc_task_activities" USING "btree" ("proc_task_id");



CREATE INDEX "idx_proc_task_comments_created" ON "public"."proc_task_comments" USING "btree" ("created_at");



CREATE INDEX "idx_proc_task_comments_task_id" ON "public"."proc_task_comments" USING "btree" ("proc_task_id");



CREATE INDEX "idx_proc_tasks_blocked" ON "public"."proc_tasks" USING "btree" ("is_blocked") WHERE ("is_blocked" = true);



CREATE INDEX "idx_proc_tasks_instance_id" ON "public"."proc_tasks" USING "btree" ("proc_instance_id");



CREATE INDEX "idx_proc_tasks_owner_id" ON "public"."proc_tasks" USING "btree" ("owner_id") WHERE ("owner_id" IS NOT NULL);



CREATE INDEX "idx_proc_tasks_priority" ON "public"."proc_tasks" USING "btree" ("priority") WHERE ("priority" = 'urgent'::"text");



CREATE INDEX "idx_proc_tasks_status" ON "public"."proc_tasks" USING "btree" ("status");



CREATE INDEX "idx_property_listings_business_type" ON "public"."property_listings" USING "btree" ("business_type");



CREATE INDEX "idx_property_listings_consultant" ON "public"."property_listings" USING "btree" ("consultant_name");



CREATE INDEX "idx_property_listings_external_ref" ON "public"."property_listings" USING "btree" ("external_reference_id");



CREATE INDEX "idx_property_listings_listing_price" ON "public"."property_listings" USING "btree" ("listing_price");



CREATE INDEX "idx_property_listings_locality" ON "public"."property_listings" USING "btree" ("locality");



CREATE INDEX "idx_property_listings_property_type" ON "public"."property_listings" USING "btree" ("property_type");



CREATE INDEX "idx_roles_name" ON "public"."roles" USING "btree" ("name");



CREATE INDEX "idx_tpl_processes_type" ON "public"."tpl_processes" USING "btree" ("process_type");



CREATE INDEX "idx_tpl_subtasks_task" ON "public"."tpl_subtasks" USING "btree" ("tpl_task_id");



CREATE INDEX "idx_tpl_variables_active" ON "public"."tpl_variables" USING "btree" ("is_active") WHERE ("is_active" = true);



CREATE INDEX "idx_tpl_variables_category" ON "public"."tpl_variables" USING "btree" ("category");



CREATE INDEX "idx_tpl_variables_source_entity" ON "public"."tpl_variables" USING "btree" ("source_entity");



CREATE INDEX "idx_user_roles_role_id" ON "public"."user_roles" USING "btree" ("role_id");



CREATE INDEX "idx_user_roles_user_id" ON "public"."user_roles" USING "btree" ("user_id");



CREATE INDEX "idx_users_commercial_name" ON "public"."users" USING "btree" ("commercial_name");



CREATE INDEX "idx_users_is_active" ON "public"."users" USING "btree" ("is_active");



CREATE INDEX "idx_users_professional_email" ON "public"."users" USING "btree" ("professional_email");



CREATE INDEX "idx_users_role_id" ON "public"."users" USING "btree" ("role_id");



CREATE INDEX "kv_store_6f39db24_key_idx" ON "public"."kv_store_6f39db24" USING "btree" ("key" "text_pattern_ops");



CREATE INDEX "kv_store_6f39db24_key_idx1" ON "public"."kv_store_6f39db24" USING "btree" ("key" "text_pattern_ops");



CREATE INDEX "kv_store_6f39db24_key_idx10" ON "public"."kv_store_6f39db24" USING "btree" ("key" "text_pattern_ops");



CREATE INDEX "kv_store_6f39db24_key_idx11" ON "public"."kv_store_6f39db24" USING "btree" ("key" "text_pattern_ops");



CREATE INDEX "kv_store_6f39db24_key_idx12" ON "public"."kv_store_6f39db24" USING "btree" ("key" "text_pattern_ops");



CREATE INDEX "kv_store_6f39db24_key_idx13" ON "public"."kv_store_6f39db24" USING "btree" ("key" "text_pattern_ops");



CREATE INDEX "kv_store_6f39db24_key_idx14" ON "public"."kv_store_6f39db24" USING "btree" ("key" "text_pattern_ops");



CREATE INDEX "kv_store_6f39db24_key_idx15" ON "public"."kv_store_6f39db24" USING "btree" ("key" "text_pattern_ops");



CREATE INDEX "kv_store_6f39db24_key_idx16" ON "public"."kv_store_6f39db24" USING "btree" ("key" "text_pattern_ops");



CREATE INDEX "kv_store_6f39db24_key_idx17" ON "public"."kv_store_6f39db24" USING "btree" ("key" "text_pattern_ops");



CREATE INDEX "kv_store_6f39db24_key_idx18" ON "public"."kv_store_6f39db24" USING "btree" ("key" "text_pattern_ops");



CREATE INDEX "kv_store_6f39db24_key_idx19" ON "public"."kv_store_6f39db24" USING "btree" ("key" "text_pattern_ops");



CREATE INDEX "kv_store_6f39db24_key_idx2" ON "public"."kv_store_6f39db24" USING "btree" ("key" "text_pattern_ops");



CREATE INDEX "kv_store_6f39db24_key_idx20" ON "public"."kv_store_6f39db24" USING "btree" ("key" "text_pattern_ops");



CREATE INDEX "kv_store_6f39db24_key_idx21" ON "public"."kv_store_6f39db24" USING "btree" ("key" "text_pattern_ops");



CREATE INDEX "kv_store_6f39db24_key_idx22" ON "public"."kv_store_6f39db24" USING "btree" ("key" "text_pattern_ops");



CREATE INDEX "kv_store_6f39db24_key_idx23" ON "public"."kv_store_6f39db24" USING "btree" ("key" "text_pattern_ops");



CREATE INDEX "kv_store_6f39db24_key_idx24" ON "public"."kv_store_6f39db24" USING "btree" ("key" "text_pattern_ops");



CREATE INDEX "kv_store_6f39db24_key_idx25" ON "public"."kv_store_6f39db24" USING "btree" ("key" "text_pattern_ops");



CREATE INDEX "kv_store_6f39db24_key_idx26" ON "public"."kv_store_6f39db24" USING "btree" ("key" "text_pattern_ops");



CREATE INDEX "kv_store_6f39db24_key_idx27" ON "public"."kv_store_6f39db24" USING "btree" ("key" "text_pattern_ops");



CREATE INDEX "kv_store_6f39db24_key_idx28" ON "public"."kv_store_6f39db24" USING "btree" ("key" "text_pattern_ops");



CREATE INDEX "kv_store_6f39db24_key_idx29" ON "public"."kv_store_6f39db24" USING "btree" ("key" "text_pattern_ops");



CREATE INDEX "kv_store_6f39db24_key_idx3" ON "public"."kv_store_6f39db24" USING "btree" ("key" "text_pattern_ops");



CREATE INDEX "kv_store_6f39db24_key_idx30" ON "public"."kv_store_6f39db24" USING "btree" ("key" "text_pattern_ops");



CREATE INDEX "kv_store_6f39db24_key_idx31" ON "public"."kv_store_6f39db24" USING "btree" ("key" "text_pattern_ops");



CREATE INDEX "kv_store_6f39db24_key_idx32" ON "public"."kv_store_6f39db24" USING "btree" ("key" "text_pattern_ops");



CREATE INDEX "kv_store_6f39db24_key_idx4" ON "public"."kv_store_6f39db24" USING "btree" ("key" "text_pattern_ops");



CREATE INDEX "kv_store_6f39db24_key_idx5" ON "public"."kv_store_6f39db24" USING "btree" ("key" "text_pattern_ops");



CREATE INDEX "kv_store_6f39db24_key_idx6" ON "public"."kv_store_6f39db24" USING "btree" ("key" "text_pattern_ops");



CREATE INDEX "kv_store_6f39db24_key_idx7" ON "public"."kv_store_6f39db24" USING "btree" ("key" "text_pattern_ops");



CREATE INDEX "kv_store_6f39db24_key_idx8" ON "public"."kv_store_6f39db24" USING "btree" ("key" "text_pattern_ops");



CREATE INDEX "kv_store_6f39db24_key_idx9" ON "public"."kv_store_6f39db24" USING "btree" ("key" "text_pattern_ops");



CREATE OR REPLACE TRIGGER "contact_submissions_updated_at" BEFORE UPDATE ON "public"."contact_form_submissions" FOR EACH ROW EXECUTE FUNCTION "public"."update_contact_submission_updated_at"();



CREATE OR REPLACE TRIGGER "roles_updated_at_trigger" BEFORE UPDATE ON "public"."roles" FOR EACH ROW EXECUTE FUNCTION "public"."update_roles_updated_at"();



CREATE OR REPLACE TRIGGER "trg_auto_complete_form_tasks_on_owner_update" AFTER UPDATE ON "public"."owners" FOR EACH ROW EXECUTE FUNCTION "public"."auto_complete_form_tasks_on_owner_update"();



CREATE OR REPLACE TRIGGER "trg_auto_complete_tasks_on_doc_insert" AFTER INSERT ON "public"."doc_registry" FOR EACH ROW EXECUTE FUNCTION "public"."auto_complete_tasks_on_doc_insert"();



CREATE OR REPLACE TRIGGER "trg_auto_flow_version" BEFORE UPDATE OF "draft_definition" ON "public"."auto_flows" FOR EACH ROW EXECUTE FUNCTION "public"."auto_save_flow_version"();



CREATE OR REPLACE TRIGGER "trg_auto_flows_updated" BEFORE UPDATE ON "public"."auto_flows" FOR EACH ROW EXECUTE FUNCTION "public"."auto_update_timestamp"();



CREATE OR REPLACE TRIGGER "trg_auto_resolve_owner_id" BEFORE INSERT ON "public"."doc_registry" FOR EACH ROW EXECUTE FUNCTION "public"."auto_resolve_owner_id_on_doc_insert"();



CREATE OR REPLACE TRIGGER "trg_auto_runs_updated" BEFORE UPDATE ON "public"."auto_runs" FOR EACH ROW EXECUTE FUNCTION "public"."auto_update_timestamp"();



CREATE OR REPLACE TRIGGER "trg_auto_unblock_on_subtask_complete" AFTER UPDATE OF "is_completed" ON "public"."proc_subtasks" FOR EACH ROW EXECUTE FUNCTION "public"."auto_unblock_on_subtask_complete"();



CREATE OR REPLACE TRIGGER "trg_auto_unblock_on_task_complete" AFTER UPDATE OF "status" ON "public"."proc_tasks" FOR EACH ROW EXECUTE FUNCTION "public"."auto_unblock_on_task_complete"();



CREATE OR REPLACE TRIGGER "trg_conta_corrente_limits_updated_at" BEFORE UPDATE ON "public"."conta_corrente_limits" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "trg_doc_registry_updated_at" BEFORE UPDATE ON "public"."doc_registry" FOR EACH ROW EXECUTE FUNCTION "public"."update_doc_registry_updated_at"();



CREATE OR REPLACE TRIGGER "trg_generate_dev_property_slug" BEFORE INSERT OR UPDATE OF "title" ON "public"."dev_properties" FOR EACH ROW EXECUTE FUNCTION "public"."generate_dev_property_slug"('title');



CREATE OR REPLACE TRIGGER "trg_generate_proc_ref" BEFORE INSERT ON "public"."proc_instances" FOR EACH ROW EXECUTE FUNCTION "public"."generate_proc_ref"();



CREATE OR REPLACE TRIGGER "trg_marketing_catalog_updated_at" BEFORE UPDATE ON "public"."marketing_catalog" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "trg_marketing_orders_updated_at" BEFORE UPDATE ON "public"."marketing_orders" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "trg_marketing_packs_updated_at" BEFORE UPDATE ON "public"."marketing_packs" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "trg_tpl_variables_updated_at" BEFORE UPDATE ON "public"."tpl_variables" FOR EACH ROW EXECUTE FUNCTION "public"."update_tpl_variables_updated_at"();



CREATE OR REPLACE TRIGGER "update_marketing_catalog_addons_updated_at" BEFORE UPDATE ON "public"."marketing_catalog_addons" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_property_listings_updated_at" BEFORE UPDATE ON "public"."property_listings" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_users_updated_at" BEFORE UPDATE ON "public"."users" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



ALTER TABLE ONLY "public"."auto_delivery_log"
    ADD CONSTRAINT "auto_delivery_log_flow_id_fkey" FOREIGN KEY ("flow_id") REFERENCES "public"."auto_flows"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."auto_delivery_log"
    ADD CONSTRAINT "auto_delivery_log_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "public"."auto_runs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."auto_delivery_log"
    ADD CONSTRAINT "auto_delivery_log_step_run_id_fkey" FOREIGN KEY ("step_run_id") REFERENCES "public"."auto_step_runs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."auto_flow_versions"
    ADD CONSTRAINT "auto_flow_versions_changed_by_fkey" FOREIGN KEY ("changed_by") REFERENCES "public"."dev_users"("id");



ALTER TABLE ONLY "public"."auto_flow_versions"
    ADD CONSTRAINT "auto_flow_versions_flow_id_fkey" FOREIGN KEY ("flow_id") REFERENCES "public"."auto_flows"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."auto_flows"
    ADD CONSTRAINT "auto_flows_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."dev_users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."auto_flows"
    ADD CONSTRAINT "auto_flows_published_by_fkey" FOREIGN KEY ("published_by") REFERENCES "public"."dev_users"("id");



ALTER TABLE ONLY "public"."auto_flows"
    ADD CONSTRAINT "auto_flows_wpp_instance_id_fkey" FOREIGN KEY ("wpp_instance_id") REFERENCES "public"."auto_wpp_instances"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."auto_runs"
    ADD CONSTRAINT "auto_runs_flow_id_fkey" FOREIGN KEY ("flow_id") REFERENCES "public"."auto_flows"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."auto_runs"
    ADD CONSTRAINT "auto_runs_trigger_id_fkey" FOREIGN KEY ("trigger_id") REFERENCES "public"."auto_triggers"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."auto_step_runs"
    ADD CONSTRAINT "auto_step_runs_flow_id_fkey" FOREIGN KEY ("flow_id") REFERENCES "public"."auto_flows"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."auto_step_runs"
    ADD CONSTRAINT "auto_step_runs_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "public"."auto_runs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."auto_triggers"
    ADD CONSTRAINT "auto_triggers_flow_id_fkey" FOREIGN KEY ("flow_id") REFERENCES "public"."auto_flows"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."auto_wpp_instances"
    ADD CONSTRAINT "auto_wpp_instances_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."dev_users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."auto_wpp_templates"
    ADD CONSTRAINT "auto_wpp_templates_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."dev_users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."consultant_documents"
    ADD CONSTRAINT "consultant_documents_consultant_id_fkey" FOREIGN KEY ("consultant_id") REFERENCES "public"."dev_users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."consultant_documents"
    ADD CONSTRAINT "consultant_documents_doc_type_id_fkey" FOREIGN KEY ("doc_type_id") REFERENCES "public"."doc_types"("id");



ALTER TABLE ONLY "public"."consultant_documents"
    ADD CONSTRAINT "consultant_documents_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "public"."dev_users"("id");



ALTER TABLE ONLY "public"."conta_corrente_limits"
    ADD CONSTRAINT "conta_corrente_limits_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "public"."dev_users"("id");



ALTER TABLE ONLY "public"."conta_corrente_transactions"
    ADD CONSTRAINT "conta_corrente_transactions_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "public"."dev_users"("id");



ALTER TABLE ONLY "public"."conta_corrente_transactions"
    ADD CONSTRAINT "conta_corrente_transactions_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."dev_users"("id");



ALTER TABLE ONLY "public"."dev_consultant_private_data"
    ADD CONSTRAINT "dev_consultant_private_data_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."dev_users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."dev_consultant_profiles"
    ADD CONSTRAINT "dev_consultant_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."dev_users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."dev_properties"
    ADD CONSTRAINT "dev_properties_consultant_id_fkey" FOREIGN KEY ("consultant_id") REFERENCES "public"."dev_users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."dev_property_internal"
    ADD CONSTRAINT "dev_property_internal_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."dev_properties"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."dev_property_media"
    ADD CONSTRAINT "dev_property_media_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."dev_properties"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."dev_property_specifications"
    ADD CONSTRAINT "dev_property_specifications_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."dev_properties"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."dev_users"
    ADD CONSTRAINT "dev_users_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."doc_registry"
    ADD CONSTRAINT "doc_registry_doc_type_id_fkey" FOREIGN KEY ("doc_type_id") REFERENCES "public"."doc_types"("id");



ALTER TABLE ONLY "public"."doc_registry"
    ADD CONSTRAINT "doc_registry_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "public"."owners"("id");



ALTER TABLE ONLY "public"."doc_registry"
    ADD CONSTRAINT "doc_registry_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."dev_properties"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."doc_registry"
    ADD CONSTRAINT "doc_registry_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "public"."dev_users"("id");



ALTER TABLE ONLY "public"."email_senders"
    ADD CONSTRAINT "email_senders_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."dev_users"("id");



ALTER TABLE ONLY "public"."lead_attachments"
    ADD CONSTRAINT "lead_attachments_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."leads"
    ADD CONSTRAINT "leads_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "public"."dev_users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."log_audit"
    ADD CONSTRAINT "log_audit_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."dev_users"("id");



ALTER TABLE ONLY "public"."log_emails"
    ADD CONSTRAINT "log_emails_parent_email_id_fkey" FOREIGN KEY ("parent_email_id") REFERENCES "public"."log_emails"("id");



ALTER TABLE ONLY "public"."log_emails"
    ADD CONSTRAINT "log_emails_proc_subtask_id_fkey" FOREIGN KEY ("proc_subtask_id") REFERENCES "public"."proc_subtasks"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."log_emails"
    ADD CONSTRAINT "log_emails_proc_task_id_fkey" FOREIGN KEY ("proc_task_id") REFERENCES "public"."proc_tasks"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."marketing_catalog_addons"
    ADD CONSTRAINT "marketing_catalog_addons_parent_service_id_fkey" FOREIGN KEY ("parent_service_id") REFERENCES "public"."marketing_catalog"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."marketing_order_deliverables"
    ADD CONSTRAINT "marketing_order_deliverables_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."marketing_orders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."marketing_order_deliverables"
    ADD CONSTRAINT "marketing_order_deliverables_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "public"."dev_users"("id");



ALTER TABLE ONLY "public"."marketing_order_items"
    ADD CONSTRAINT "marketing_order_items_catalog_item_id_fkey" FOREIGN KEY ("catalog_item_id") REFERENCES "public"."marketing_catalog"("id");



ALTER TABLE ONLY "public"."marketing_order_items"
    ADD CONSTRAINT "marketing_order_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."marketing_orders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."marketing_order_items"
    ADD CONSTRAINT "marketing_order_items_pack_id_fkey" FOREIGN KEY ("pack_id") REFERENCES "public"."marketing_packs"("id");



ALTER TABLE ONLY "public"."marketing_orders"
    ADD CONSTRAINT "marketing_orders_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "public"."dev_users"("id");



ALTER TABLE ONLY "public"."marketing_orders"
    ADD CONSTRAINT "marketing_orders_assigned_to_fkey" FOREIGN KEY ("assigned_to") REFERENCES "public"."dev_users"("id");



ALTER TABLE ONLY "public"."marketing_orders"
    ADD CONSTRAINT "marketing_orders_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."dev_properties"("id");



ALTER TABLE ONLY "public"."marketing_pack_items"
    ADD CONSTRAINT "marketing_pack_items_catalog_item_id_fkey" FOREIGN KEY ("catalog_item_id") REFERENCES "public"."marketing_catalog"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."marketing_pack_items"
    ADD CONSTRAINT "marketing_pack_items_pack_id_fkey" FOREIGN KEY ("pack_id") REFERENCES "public"."marketing_packs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."negocios"
    ADD CONSTRAINT "negocios_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_recipient_id_fkey" FOREIGN KEY ("recipient_id") REFERENCES "public"."dev_users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "public"."dev_users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."owner_beneficiaries"
    ADD CONSTRAINT "owner_beneficiaries_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "public"."owners"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."proc_alert_log"
    ADD CONSTRAINT "proc_alert_log_proc_instance_id_fkey" FOREIGN KEY ("proc_instance_id") REFERENCES "public"."proc_instances"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."proc_alert_log"
    ADD CONSTRAINT "proc_alert_log_recipient_id_fkey" FOREIGN KEY ("recipient_id") REFERENCES "public"."dev_users"("id");



ALTER TABLE ONLY "public"."proc_chat_attachments"
    ADD CONSTRAINT "proc_chat_attachments_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "public"."proc_chat_messages"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."proc_chat_attachments"
    ADD CONSTRAINT "proc_chat_attachments_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "public"."dev_users"("id");



ALTER TABLE ONLY "public"."proc_chat_messages"
    ADD CONSTRAINT "proc_chat_messages_parent_message_id_fkey" FOREIGN KEY ("parent_message_id") REFERENCES "public"."proc_chat_messages"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."proc_chat_messages"
    ADD CONSTRAINT "proc_chat_messages_proc_instance_id_fkey" FOREIGN KEY ("proc_instance_id") REFERENCES "public"."proc_instances"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."proc_chat_messages"
    ADD CONSTRAINT "proc_chat_messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "public"."dev_users"("id");



ALTER TABLE ONLY "public"."proc_chat_reactions"
    ADD CONSTRAINT "proc_chat_reactions_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "public"."proc_chat_messages"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."proc_chat_reactions"
    ADD CONSTRAINT "proc_chat_reactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."dev_users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."proc_chat_read_receipts"
    ADD CONSTRAINT "proc_chat_read_receipts_last_read_message_id_fkey" FOREIGN KEY ("last_read_message_id") REFERENCES "public"."proc_chat_messages"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."proc_chat_read_receipts"
    ADD CONSTRAINT "proc_chat_read_receipts_proc_instance_id_fkey" FOREIGN KEY ("proc_instance_id") REFERENCES "public"."proc_instances"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."proc_chat_read_receipts"
    ADD CONSTRAINT "proc_chat_read_receipts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."dev_users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."proc_instances"
    ADD CONSTRAINT "proc_instances_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "public"."dev_users"("id");



ALTER TABLE ONLY "public"."proc_instances"
    ADD CONSTRAINT "proc_instances_current_stage_id_fkey" FOREIGN KEY ("current_stage_id") REFERENCES "public"."tpl_stages"("id");



ALTER TABLE ONLY "public"."proc_instances"
    ADD CONSTRAINT "proc_instances_deleted_by_fkey" FOREIGN KEY ("deleted_by") REFERENCES "public"."dev_users"("id");



ALTER TABLE ONLY "public"."proc_instances"
    ADD CONSTRAINT "proc_instances_negocio_id_fkey" FOREIGN KEY ("negocio_id") REFERENCES "public"."negocios"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."proc_instances"
    ADD CONSTRAINT "proc_instances_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."dev_properties"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."proc_instances"
    ADD CONSTRAINT "proc_instances_rejected_by_fkey" FOREIGN KEY ("rejected_by") REFERENCES "public"."dev_users"("id");



ALTER TABLE ONLY "public"."proc_instances"
    ADD CONSTRAINT "proc_instances_requested_by_fkey" FOREIGN KEY ("requested_by") REFERENCES "public"."dev_users"("id");



ALTER TABLE ONLY "public"."proc_instances"
    ADD CONSTRAINT "proc_instances_returned_by_fkey" FOREIGN KEY ("returned_by") REFERENCES "public"."dev_users"("id");



ALTER TABLE ONLY "public"."proc_instances"
    ADD CONSTRAINT "proc_instances_tpl_process_id_fkey" FOREIGN KEY ("tpl_process_id") REFERENCES "public"."tpl_processes"("id");



ALTER TABLE ONLY "public"."proc_subtasks"
    ADD CONSTRAINT "proc_subtasks_assigned_to_fkey" FOREIGN KEY ("assigned_to") REFERENCES "public"."dev_users"("id");



ALTER TABLE ONLY "public"."proc_subtasks"
    ADD CONSTRAINT "proc_subtasks_completed_by_fkey" FOREIGN KEY ("completed_by") REFERENCES "public"."dev_users"("id");



ALTER TABLE ONLY "public"."proc_subtasks"
    ADD CONSTRAINT "proc_subtasks_dependency_proc_subtask_id_fkey" FOREIGN KEY ("dependency_proc_subtask_id") REFERENCES "public"."proc_subtasks"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."proc_subtasks"
    ADD CONSTRAINT "proc_subtasks_dependency_proc_task_id_fkey" FOREIGN KEY ("dependency_proc_task_id") REFERENCES "public"."proc_tasks"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."proc_subtasks"
    ADD CONSTRAINT "proc_subtasks_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "public"."owners"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."proc_subtasks"
    ADD CONSTRAINT "proc_subtasks_proc_task_id_fkey" FOREIGN KEY ("proc_task_id") REFERENCES "public"."proc_tasks"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."proc_subtasks"
    ADD CONSTRAINT "proc_subtasks_tpl_subtask_id_fkey" FOREIGN KEY ("tpl_subtask_id") REFERENCES "public"."tpl_subtasks"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."proc_task_activities"
    ADD CONSTRAINT "proc_task_activities_proc_task_id_fkey" FOREIGN KEY ("proc_task_id") REFERENCES "public"."proc_tasks"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."proc_task_activities"
    ADD CONSTRAINT "proc_task_activities_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."dev_users"("id");



ALTER TABLE ONLY "public"."proc_task_comments"
    ADD CONSTRAINT "proc_task_comments_proc_task_id_fkey" FOREIGN KEY ("proc_task_id") REFERENCES "public"."proc_tasks"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."proc_task_comments"
    ADD CONSTRAINT "proc_task_comments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."dev_users"("id");



ALTER TABLE ONLY "public"."proc_tasks"
    ADD CONSTRAINT "proc_tasks_assigned_to_fkey" FOREIGN KEY ("assigned_to") REFERENCES "public"."dev_users"("id");



ALTER TABLE ONLY "public"."proc_tasks"
    ADD CONSTRAINT "proc_tasks_bypassed_by_fkey" FOREIGN KEY ("bypassed_by") REFERENCES "public"."dev_users"("id");



ALTER TABLE ONLY "public"."proc_tasks"
    ADD CONSTRAINT "proc_tasks_dependency_proc_task_id_fkey" FOREIGN KEY ("dependency_proc_task_id") REFERENCES "public"."proc_tasks"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."proc_tasks"
    ADD CONSTRAINT "proc_tasks_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "public"."owners"("id");



ALTER TABLE ONLY "public"."proc_tasks"
    ADD CONSTRAINT "proc_tasks_proc_instance_id_fkey" FOREIGN KEY ("proc_instance_id") REFERENCES "public"."proc_instances"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."proc_tasks"
    ADD CONSTRAINT "proc_tasks_tpl_task_id_fkey" FOREIGN KEY ("tpl_task_id") REFERENCES "public"."tpl_tasks"("id");



ALTER TABLE ONLY "public"."property_listings"
    ADD CONSTRAINT "property_listings_consultant_id_fkey" FOREIGN KEY ("consultant_id") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."property_owners"
    ADD CONSTRAINT "property_owners_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "public"."owners"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."property_owners"
    ADD CONSTRAINT "property_owners_owner_role_id_fkey" FOREIGN KEY ("owner_role_id") REFERENCES "public"."owner_role_types"("id");



ALTER TABLE ONLY "public"."property_owners"
    ADD CONSTRAINT "property_owners_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."dev_properties"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tpl_doc_library"
    ADD CONSTRAINT "tpl_doc_library_doc_type_id_fkey" FOREIGN KEY ("doc_type_id") REFERENCES "public"."doc_types"("id");



ALTER TABLE ONLY "public"."tpl_email_library"
    ADD CONSTRAINT "tpl_email_library_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."dev_users"("id");



ALTER TABLE ONLY "public"."tpl_form_templates"
    ADD CONSTRAINT "tpl_form_templates_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."dev_users"("id");



ALTER TABLE ONLY "public"."tpl_stages"
    ADD CONSTRAINT "tpl_stages_tpl_process_id_fkey" FOREIGN KEY ("tpl_process_id") REFERENCES "public"."tpl_processes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tpl_subtasks"
    ADD CONSTRAINT "tpl_subtasks_dependency_subtask_id_fkey" FOREIGN KEY ("dependency_subtask_id") REFERENCES "public"."tpl_subtasks"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."tpl_subtasks"
    ADD CONSTRAINT "tpl_subtasks_dependency_task_id_fkey" FOREIGN KEY ("dependency_task_id") REFERENCES "public"."tpl_tasks"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."tpl_subtasks"
    ADD CONSTRAINT "tpl_subtasks_tpl_task_id_fkey" FOREIGN KEY ("tpl_task_id") REFERENCES "public"."tpl_tasks"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tpl_tasks"
    ADD CONSTRAINT "tpl_tasks_tpl_stage_id_fkey" FOREIGN KEY ("tpl_stage_id") REFERENCES "public"."tpl_stages"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_contracts"
    ADD CONSTRAINT "user_contracts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_assigned_by_fkey" FOREIGN KEY ("assigned_by") REFERENCES "public"."dev_users"("id");



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."dev_users"("id") ON DELETE CASCADE;



CREATE POLICY "Admins can manage email senders" ON "public"."email_senders" TO "service_role" WITH CHECK (true);



CREATE POLICY "Allow authenticated all on proc_subtasks" ON "public"."proc_subtasks" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Allow authenticated all on tpl_subtasks" ON "public"."tpl_subtasks" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Allow authenticated read on contact_form_submissions" ON "public"."contact_form_submissions" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Allow authenticated select on proc_subtasks" ON "public"."proc_subtasks" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Allow authenticated select on tpl_subtasks" ON "public"."tpl_subtasks" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Allow authenticated update on contact_form_submissions" ON "public"."contact_form_submissions" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Allow public insert on contact_form_submissions" ON "public"."contact_form_submissions" FOR INSERT TO "anon" WITH CHECK (true);



CREATE POLICY "Allow read access to user_roles" ON "public"."user_roles" FOR SELECT USING (true);



CREATE POLICY "Allow read for all authenticated" ON "public"."owner_role_types" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Authenticated users can insert activities" ON "public"."proc_task_activities" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Authenticated users can insert comments" ON "public"."proc_task_comments" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Authenticated users can read activities" ON "public"."proc_task_activities" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Authenticated users can read alert logs" ON "public"."proc_alert_log" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Authenticated users can read attachments" ON "public"."proc_chat_attachments" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Authenticated users can read chat messages" ON "public"."proc_chat_messages" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Authenticated users can read comments" ON "public"."proc_task_comments" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Authenticated users can read email senders" ON "public"."email_senders" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Authenticated users can read log_emails" ON "public"."log_emails" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Authenticated users can read reactions" ON "public"."proc_chat_reactions" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Enable delete for authenticated" ON "public"."user_roles" FOR DELETE USING (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Enable insert for authenticated" ON "public"."user_roles" FOR INSERT WITH CHECK (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Enable update for authenticated" ON "public"."user_roles" FOR UPDATE USING (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Service can insert alert logs" ON "public"."proc_alert_log" FOR INSERT TO "service_role" WITH CHECK (true);



CREATE POLICY "Service can insert notifications" ON "public"."notifications" FOR INSERT TO "service_role" WITH CHECK (true);



CREATE POLICY "Users can delete own notifications" ON "public"."notifications" FOR DELETE TO "authenticated" USING (("recipient_id" = "auth"."uid"()));



CREATE POLICY "Users can delete their own reactions" ON "public"."proc_chat_reactions" FOR DELETE TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert their own attachments" ON "public"."proc_chat_attachments" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "uploaded_by"));



CREATE POLICY "Users can insert their own messages" ON "public"."proc_chat_messages" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "sender_id"));



CREATE POLICY "Users can insert their own reactions" ON "public"."proc_chat_reactions" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert their own receipts" ON "public"."proc_chat_read_receipts" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can read their own receipts" ON "public"."proc_chat_read_receipts" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update own notifications" ON "public"."notifications" FOR UPDATE TO "authenticated" USING (("recipient_id" = "auth"."uid"())) WITH CHECK (("recipient_id" = "auth"."uid"()));



CREATE POLICY "Users can update their own comments" ON "public"."proc_task_comments" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own messages" ON "public"."proc_chat_messages" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "sender_id"));



CREATE POLICY "Users can update their own receipts" ON "public"."proc_chat_read_receipts" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own notifications" ON "public"."notifications" FOR SELECT TO "authenticated" USING (("recipient_id" = "auth"."uid"()));



CREATE POLICY "authenticated_read_active" ON "public"."tpl_form_templates" FOR SELECT TO "authenticated" USING (("is_active" = true));



ALTER TABLE "public"."contact_form_submissions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."email_senders" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."kv_store_6f39db24" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."log_emails" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."notifications" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."owner_role_types" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."proc_alert_log" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."proc_chat_attachments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."proc_chat_messages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."proc_chat_reactions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."proc_chat_read_receipts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."proc_subtasks" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."proc_task_activities" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."proc_task_comments" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "service_role_all" ON "public"."tpl_form_templates" TO "service_role" USING (true) WITH CHECK (true);



ALTER TABLE "public"."tpl_form_templates" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tpl_subtasks" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tpl_variables" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "tpl_variables_all_service" ON "public"."tpl_variables" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "tpl_variables_select" ON "public"."tpl_variables" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."user_roles" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";






ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."auto_runs";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."auto_step_runs";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."auto_webhook_captures";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."log_emails";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."notifications";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."proc_chat_attachments";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."proc_chat_messages";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."proc_chat_reactions";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."proc_chat_read_receipts";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."proc_task_comments";






GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";

















































































































































































GRANT ALL ON FUNCTION "public"."_populate_subtasks"("p_proc_task_id" "uuid", "p_tpl_task_id" "uuid", "p_property_id" "uuid", "p_parent_owner_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."_populate_subtasks"("p_proc_task_id" "uuid", "p_tpl_task_id" "uuid", "p_property_id" "uuid", "p_parent_owner_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_populate_subtasks"("p_proc_task_id" "uuid", "p_tpl_task_id" "uuid", "p_property_id" "uuid", "p_parent_owner_id" "uuid") TO "service_role";



GRANT ALL ON TABLE "public"."auto_step_runs" TO "anon";
GRANT ALL ON TABLE "public"."auto_step_runs" TO "authenticated";
GRANT ALL ON TABLE "public"."auto_step_runs" TO "service_role";



GRANT ALL ON FUNCTION "public"."auto_claim_steps"("batch_size" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."auto_claim_steps"("batch_size" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."auto_claim_steps"("batch_size" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."auto_complete_form_tasks_on_owner_update"() TO "anon";
GRANT ALL ON FUNCTION "public"."auto_complete_form_tasks_on_owner_update"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."auto_complete_form_tasks_on_owner_update"() TO "service_role";



GRANT ALL ON FUNCTION "public"."auto_complete_tasks_on_doc_insert"() TO "anon";
GRANT ALL ON FUNCTION "public"."auto_complete_tasks_on_doc_insert"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."auto_complete_tasks_on_doc_insert"() TO "service_role";



GRANT ALL ON FUNCTION "public"."auto_get_table_columns"("p_table" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."auto_get_table_columns"("p_table" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."auto_get_table_columns"("p_table" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."auto_reset_stuck_steps"() TO "anon";
GRANT ALL ON FUNCTION "public"."auto_reset_stuck_steps"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."auto_reset_stuck_steps"() TO "service_role";



GRANT ALL ON FUNCTION "public"."auto_resolve_owner_id_on_doc_insert"() TO "anon";
GRANT ALL ON FUNCTION "public"."auto_resolve_owner_id_on_doc_insert"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."auto_resolve_owner_id_on_doc_insert"() TO "service_role";



GRANT ALL ON FUNCTION "public"."auto_save_flow_version"() TO "anon";
GRANT ALL ON FUNCTION "public"."auto_save_flow_version"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."auto_save_flow_version"() TO "service_role";



GRANT ALL ON FUNCTION "public"."auto_unblock_on_subtask_complete"() TO "anon";
GRANT ALL ON FUNCTION "public"."auto_unblock_on_subtask_complete"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."auto_unblock_on_subtask_complete"() TO "service_role";



GRANT ALL ON FUNCTION "public"."auto_unblock_on_task_complete"() TO "anon";
GRANT ALL ON FUNCTION "public"."auto_unblock_on_task_complete"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."auto_unblock_on_task_complete"() TO "service_role";



GRANT ALL ON FUNCTION "public"."auto_update_run_counts"("p_run_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."auto_update_run_counts"("p_run_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."auto_update_run_counts"("p_run_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."auto_update_timestamp"() TO "anon";
GRANT ALL ON FUNCTION "public"."auto_update_timestamp"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."auto_update_timestamp"() TO "service_role";



GRANT ALL ON FUNCTION "public"."check_overdue_and_unblock_alerts"() TO "anon";
GRANT ALL ON FUNCTION "public"."check_overdue_and_unblock_alerts"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_overdue_and_unblock_alerts"() TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_dev_property_slug"() TO "anon";
GRANT ALL ON FUNCTION "public"."generate_dev_property_slug"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_dev_property_slug"() TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_proc_ref"() TO "anon";
GRANT ALL ON FUNCTION "public"."generate_proc_ref"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_proc_ref"() TO "service_role";



GRANT ALL ON FUNCTION "public"."populate_process_tasks"() TO "anon";
GRANT ALL ON FUNCTION "public"."populate_process_tasks"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."populate_process_tasks"() TO "service_role";



GRANT ALL ON FUNCTION "public"."populate_process_tasks"("p_instance_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."populate_process_tasks"("p_instance_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."populate_process_tasks"("p_instance_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."recalculate_process_progress"("p_proc_instance_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."recalculate_process_progress"("p_proc_instance_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."recalculate_process_progress"("p_proc_instance_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."resolve_process_dependencies"("p_instance_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."resolve_process_dependencies"("p_instance_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."resolve_process_dependencies"("p_instance_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."unaccent"("text") TO "postgres";
GRANT ALL ON FUNCTION "public"."unaccent"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."unaccent"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."unaccent"("text") TO "service_role";



GRANT ALL ON FUNCTION "public"."unaccent"("regdictionary", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."unaccent"("regdictionary", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."unaccent"("regdictionary", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."unaccent"("regdictionary", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."unaccent_init"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."unaccent_init"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."unaccent_init"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."unaccent_init"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."unaccent_lexize"("internal", "internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."unaccent_lexize"("internal", "internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."unaccent_lexize"("internal", "internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."unaccent_lexize"("internal", "internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."update_contact_submission_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_contact_submission_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_contact_submission_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_doc_registry_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_doc_registry_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_doc_registry_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_leads_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_leads_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_leads_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_roles_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_roles_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_roles_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_tpl_variables_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_tpl_variables_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_tpl_variables_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "service_role";
























GRANT ALL ON TABLE "public"."auto_delivery_log" TO "anon";
GRANT ALL ON TABLE "public"."auto_delivery_log" TO "authenticated";
GRANT ALL ON TABLE "public"."auto_delivery_log" TO "service_role";



GRANT ALL ON TABLE "public"."auto_flow_versions" TO "anon";
GRANT ALL ON TABLE "public"."auto_flow_versions" TO "authenticated";
GRANT ALL ON TABLE "public"."auto_flow_versions" TO "service_role";



GRANT ALL ON TABLE "public"."auto_flows" TO "anon";
GRANT ALL ON TABLE "public"."auto_flows" TO "authenticated";
GRANT ALL ON TABLE "public"."auto_flows" TO "service_role";



GRANT ALL ON TABLE "public"."auto_runs" TO "anon";
GRANT ALL ON TABLE "public"."auto_runs" TO "authenticated";
GRANT ALL ON TABLE "public"."auto_runs" TO "service_role";



GRANT ALL ON TABLE "public"."auto_triggers" TO "anon";
GRANT ALL ON TABLE "public"."auto_triggers" TO "authenticated";
GRANT ALL ON TABLE "public"."auto_triggers" TO "service_role";



GRANT ALL ON TABLE "public"."auto_webhook_captures" TO "anon";
GRANT ALL ON TABLE "public"."auto_webhook_captures" TO "authenticated";
GRANT ALL ON TABLE "public"."auto_webhook_captures" TO "service_role";



GRANT ALL ON TABLE "public"."auto_wpp_instances" TO "anon";
GRANT ALL ON TABLE "public"."auto_wpp_instances" TO "authenticated";
GRANT ALL ON TABLE "public"."auto_wpp_instances" TO "service_role";



GRANT ALL ON TABLE "public"."auto_wpp_templates" TO "anon";
GRANT ALL ON TABLE "public"."auto_wpp_templates" TO "authenticated";
GRANT ALL ON TABLE "public"."auto_wpp_templates" TO "service_role";



GRANT ALL ON TABLE "public"."consultant_documents" TO "anon";
GRANT ALL ON TABLE "public"."consultant_documents" TO "authenticated";
GRANT ALL ON TABLE "public"."consultant_documents" TO "service_role";



GRANT ALL ON TABLE "public"."conta_corrente_limits" TO "anon";
GRANT ALL ON TABLE "public"."conta_corrente_limits" TO "authenticated";
GRANT ALL ON TABLE "public"."conta_corrente_limits" TO "service_role";



GRANT ALL ON TABLE "public"."conta_corrente_transactions" TO "anon";
GRANT ALL ON TABLE "public"."conta_corrente_transactions" TO "authenticated";
GRANT ALL ON TABLE "public"."conta_corrente_transactions" TO "service_role";



GRANT ALL ON TABLE "public"."contact_form_submissions" TO "anon";
GRANT ALL ON TABLE "public"."contact_form_submissions" TO "authenticated";
GRANT ALL ON TABLE "public"."contact_form_submissions" TO "service_role";



GRANT ALL ON TABLE "public"."dev_consultant_private_data" TO "anon";
GRANT ALL ON TABLE "public"."dev_consultant_private_data" TO "authenticated";
GRANT ALL ON TABLE "public"."dev_consultant_private_data" TO "service_role";



GRANT ALL ON TABLE "public"."dev_consultant_profiles" TO "anon";
GRANT ALL ON TABLE "public"."dev_consultant_profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."dev_consultant_profiles" TO "service_role";



GRANT ALL ON TABLE "public"."dev_properties" TO "anon";
GRANT ALL ON TABLE "public"."dev_properties" TO "authenticated";
GRANT ALL ON TABLE "public"."dev_properties" TO "service_role";



GRANT ALL ON TABLE "public"."dev_property_internal" TO "anon";
GRANT ALL ON TABLE "public"."dev_property_internal" TO "authenticated";
GRANT ALL ON TABLE "public"."dev_property_internal" TO "service_role";



GRANT ALL ON TABLE "public"."dev_property_media" TO "anon";
GRANT ALL ON TABLE "public"."dev_property_media" TO "authenticated";
GRANT ALL ON TABLE "public"."dev_property_media" TO "service_role";



GRANT ALL ON TABLE "public"."dev_property_specifications" TO "anon";
GRANT ALL ON TABLE "public"."dev_property_specifications" TO "authenticated";
GRANT ALL ON TABLE "public"."dev_property_specifications" TO "service_role";



GRANT ALL ON TABLE "public"."dev_users" TO "anon";
GRANT ALL ON TABLE "public"."dev_users" TO "authenticated";
GRANT ALL ON TABLE "public"."dev_users" TO "service_role";



GRANT ALL ON TABLE "public"."doc_registry" TO "anon";
GRANT ALL ON TABLE "public"."doc_registry" TO "authenticated";
GRANT ALL ON TABLE "public"."doc_registry" TO "service_role";



GRANT ALL ON TABLE "public"."doc_types" TO "anon";
GRANT ALL ON TABLE "public"."doc_types" TO "authenticated";
GRANT ALL ON TABLE "public"."doc_types" TO "service_role";



GRANT ALL ON TABLE "public"."email_senders" TO "anon";
GRANT ALL ON TABLE "public"."email_senders" TO "authenticated";
GRANT ALL ON TABLE "public"."email_senders" TO "service_role";



GRANT ALL ON TABLE "public"."embarcacoes" TO "anon";
GRANT ALL ON TABLE "public"."embarcacoes" TO "authenticated";
GRANT ALL ON TABLE "public"."embarcacoes" TO "service_role";



GRANT ALL ON TABLE "public"."kv_store_6f39db24" TO "anon";
GRANT ALL ON TABLE "public"."kv_store_6f39db24" TO "authenticated";
GRANT ALL ON TABLE "public"."kv_store_6f39db24" TO "service_role";



GRANT ALL ON TABLE "public"."lead_attachments" TO "anon";
GRANT ALL ON TABLE "public"."lead_attachments" TO "authenticated";
GRANT ALL ON TABLE "public"."lead_attachments" TO "service_role";



GRANT ALL ON TABLE "public"."leads" TO "anon";
GRANT ALL ON TABLE "public"."leads" TO "authenticated";
GRANT ALL ON TABLE "public"."leads" TO "service_role";



GRANT ALL ON TABLE "public"."log_audit" TO "anon";
GRANT ALL ON TABLE "public"."log_audit" TO "authenticated";
GRANT ALL ON TABLE "public"."log_audit" TO "service_role";



GRANT ALL ON TABLE "public"."log_emails" TO "anon";
GRANT ALL ON TABLE "public"."log_emails" TO "authenticated";
GRANT ALL ON TABLE "public"."log_emails" TO "service_role";



GRANT ALL ON TABLE "public"."marketing_catalog" TO "anon";
GRANT ALL ON TABLE "public"."marketing_catalog" TO "authenticated";
GRANT ALL ON TABLE "public"."marketing_catalog" TO "service_role";



GRANT ALL ON TABLE "public"."marketing_catalog_addons" TO "anon";
GRANT ALL ON TABLE "public"."marketing_catalog_addons" TO "authenticated";
GRANT ALL ON TABLE "public"."marketing_catalog_addons" TO "service_role";



GRANT ALL ON TABLE "public"."marketing_order_deliverables" TO "anon";
GRANT ALL ON TABLE "public"."marketing_order_deliverables" TO "authenticated";
GRANT ALL ON TABLE "public"."marketing_order_deliverables" TO "service_role";



GRANT ALL ON TABLE "public"."marketing_order_items" TO "anon";
GRANT ALL ON TABLE "public"."marketing_order_items" TO "authenticated";
GRANT ALL ON TABLE "public"."marketing_order_items" TO "service_role";



GRANT ALL ON TABLE "public"."marketing_orders" TO "anon";
GRANT ALL ON TABLE "public"."marketing_orders" TO "authenticated";
GRANT ALL ON TABLE "public"."marketing_orders" TO "service_role";



GRANT ALL ON TABLE "public"."marketing_pack_items" TO "anon";
GRANT ALL ON TABLE "public"."marketing_pack_items" TO "authenticated";
GRANT ALL ON TABLE "public"."marketing_pack_items" TO "service_role";



GRANT ALL ON TABLE "public"."marketing_packs" TO "anon";
GRANT ALL ON TABLE "public"."marketing_packs" TO "authenticated";
GRANT ALL ON TABLE "public"."marketing_packs" TO "service_role";



GRANT ALL ON TABLE "public"."negocios" TO "anon";
GRANT ALL ON TABLE "public"."negocios" TO "authenticated";
GRANT ALL ON TABLE "public"."negocios" TO "service_role";



GRANT ALL ON TABLE "public"."notifications" TO "anon";
GRANT ALL ON TABLE "public"."notifications" TO "authenticated";
GRANT ALL ON TABLE "public"."notifications" TO "service_role";



GRANT ALL ON TABLE "public"."owner_beneficiaries" TO "anon";
GRANT ALL ON TABLE "public"."owner_beneficiaries" TO "authenticated";
GRANT ALL ON TABLE "public"."owner_beneficiaries" TO "service_role";



GRANT ALL ON TABLE "public"."owner_role_types" TO "anon";
GRANT ALL ON TABLE "public"."owner_role_types" TO "authenticated";
GRANT ALL ON TABLE "public"."owner_role_types" TO "service_role";



GRANT ALL ON TABLE "public"."owners" TO "anon";
GRANT ALL ON TABLE "public"."owners" TO "authenticated";
GRANT ALL ON TABLE "public"."owners" TO "service_role";



GRANT ALL ON TABLE "public"."proc_alert_log" TO "anon";
GRANT ALL ON TABLE "public"."proc_alert_log" TO "authenticated";
GRANT ALL ON TABLE "public"."proc_alert_log" TO "service_role";



GRANT ALL ON TABLE "public"."proc_chat_attachments" TO "anon";
GRANT ALL ON TABLE "public"."proc_chat_attachments" TO "authenticated";
GRANT ALL ON TABLE "public"."proc_chat_attachments" TO "service_role";



GRANT ALL ON TABLE "public"."proc_chat_messages" TO "anon";
GRANT ALL ON TABLE "public"."proc_chat_messages" TO "authenticated";
GRANT ALL ON TABLE "public"."proc_chat_messages" TO "service_role";



GRANT ALL ON TABLE "public"."proc_chat_reactions" TO "anon";
GRANT ALL ON TABLE "public"."proc_chat_reactions" TO "authenticated";
GRANT ALL ON TABLE "public"."proc_chat_reactions" TO "service_role";



GRANT ALL ON TABLE "public"."proc_chat_read_receipts" TO "anon";
GRANT ALL ON TABLE "public"."proc_chat_read_receipts" TO "authenticated";
GRANT ALL ON TABLE "public"."proc_chat_read_receipts" TO "service_role";



GRANT ALL ON TABLE "public"."proc_instances" TO "anon";
GRANT ALL ON TABLE "public"."proc_instances" TO "authenticated";
GRANT ALL ON TABLE "public"."proc_instances" TO "service_role";



GRANT ALL ON SEQUENCE "public"."proc_ref_seq_global" TO "anon";
GRANT ALL ON SEQUENCE "public"."proc_ref_seq_global" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."proc_ref_seq_global" TO "service_role";



GRANT ALL ON TABLE "public"."proc_subtasks" TO "anon";
GRANT ALL ON TABLE "public"."proc_subtasks" TO "authenticated";
GRANT ALL ON TABLE "public"."proc_subtasks" TO "service_role";



GRANT ALL ON TABLE "public"."proc_task_activities" TO "anon";
GRANT ALL ON TABLE "public"."proc_task_activities" TO "authenticated";
GRANT ALL ON TABLE "public"."proc_task_activities" TO "service_role";



GRANT ALL ON TABLE "public"."proc_task_comments" TO "anon";
GRANT ALL ON TABLE "public"."proc_task_comments" TO "authenticated";
GRANT ALL ON TABLE "public"."proc_task_comments" TO "service_role";



GRANT ALL ON TABLE "public"."proc_tasks" TO "anon";
GRANT ALL ON TABLE "public"."proc_tasks" TO "authenticated";
GRANT ALL ON TABLE "public"."proc_tasks" TO "service_role";



GRANT ALL ON TABLE "public"."property_listings" TO "anon";
GRANT ALL ON TABLE "public"."property_listings" TO "authenticated";
GRANT ALL ON TABLE "public"."property_listings" TO "service_role";



GRANT ALL ON TABLE "public"."property_owners" TO "anon";
GRANT ALL ON TABLE "public"."property_owners" TO "authenticated";
GRANT ALL ON TABLE "public"."property_owners" TO "service_role";



GRANT ALL ON TABLE "public"."ref_counters" TO "anon";
GRANT ALL ON TABLE "public"."ref_counters" TO "authenticated";
GRANT ALL ON TABLE "public"."ref_counters" TO "service_role";



GRANT ALL ON TABLE "public"."roles" TO "anon";
GRANT ALL ON TABLE "public"."roles" TO "authenticated";
GRANT ALL ON TABLE "public"."roles" TO "service_role";



GRANT ALL ON TABLE "public"."tpl_doc_library" TO "anon";
GRANT ALL ON TABLE "public"."tpl_doc_library" TO "authenticated";
GRANT ALL ON TABLE "public"."tpl_doc_library" TO "service_role";



GRANT ALL ON TABLE "public"."tpl_email_library" TO "anon";
GRANT ALL ON TABLE "public"."tpl_email_library" TO "authenticated";
GRANT ALL ON TABLE "public"."tpl_email_library" TO "service_role";



GRANT ALL ON TABLE "public"."tpl_form_templates" TO "anon";
GRANT ALL ON TABLE "public"."tpl_form_templates" TO "authenticated";
GRANT ALL ON TABLE "public"."tpl_form_templates" TO "service_role";



GRANT ALL ON TABLE "public"."tpl_processes" TO "anon";
GRANT ALL ON TABLE "public"."tpl_processes" TO "authenticated";
GRANT ALL ON TABLE "public"."tpl_processes" TO "service_role";



GRANT ALL ON TABLE "public"."tpl_stages" TO "anon";
GRANT ALL ON TABLE "public"."tpl_stages" TO "authenticated";
GRANT ALL ON TABLE "public"."tpl_stages" TO "service_role";



GRANT ALL ON TABLE "public"."tpl_subtasks" TO "anon";
GRANT ALL ON TABLE "public"."tpl_subtasks" TO "authenticated";
GRANT ALL ON TABLE "public"."tpl_subtasks" TO "service_role";



GRANT ALL ON TABLE "public"."tpl_tasks" TO "anon";
GRANT ALL ON TABLE "public"."tpl_tasks" TO "authenticated";
GRANT ALL ON TABLE "public"."tpl_tasks" TO "service_role";



GRANT ALL ON TABLE "public"."tpl_variables" TO "anon";
GRANT ALL ON TABLE "public"."tpl_variables" TO "authenticated";
GRANT ALL ON TABLE "public"."tpl_variables" TO "service_role";



GRANT ALL ON TABLE "public"."user_contracts" TO "anon";
GRANT ALL ON TABLE "public"."user_contracts" TO "authenticated";
GRANT ALL ON TABLE "public"."user_contracts" TO "service_role";



GRANT ALL ON TABLE "public"."user_roles" TO "anon";
GRANT ALL ON TABLE "public"."user_roles" TO "authenticated";
GRANT ALL ON TABLE "public"."user_roles" TO "service_role";



GRANT ALL ON TABLE "public"."users" TO "anon";
GRANT ALL ON TABLE "public"."users" TO "authenticated";
GRANT ALL ON TABLE "public"."users" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";































drop extension if exists "pg_net";

create extension if not exists "pg_net" with schema "public";


