-- ============================================================================
-- Migration: 20260522_owner_submission_review_flow.sql
-- Author: helderandre + Claude (add-owner-submission-review-flow)
-- Date: 2026-05-22
--
-- WHAT THIS DOES:
--   Adiciona infra para o ERP receber notificações + push quando o app cliente
--   (`infinity-cliente`) regista submissões em `doc_registry` (uploads e
--   assinatura do CMI) e captura audit trail dos UPDATEs em `owners` para
--   colunas-whitelist (estado civil, naturalidade, morada — singular + rep.
--   legal).
--
--   1. Coluna `notifications.push_dispatched bool DEFAULT false` + index parcial
--      para o cron Node `/api/cron/dispatch-pending-push` poder enviar push
--      depois (web-push não pode correr em PL/pgSQL).
--   2. Tabela `owner_field_audit` (audit trail por edição de campo).
--   3. Função + trigger `audit_owner_field_change` que dispara em UPDATE de 6
--      colunas-whitelist em `owners`. Insere audit row + activity (se
--      subtask_id resolúvel) + notification rate-limited (5min por
--      subtask_id+field_name, ou owner_id+field_name se subtask_id NULL).
--   4. Função + trigger `notify_consultant_owner_submission` que dispara em
--      INSERT em `doc_registry` quando metadata.uploaded_via é 'owner_*'.
--      Cria notification + activity para o consultor responsável (assigned_to
--      da proc_task pai).
--
-- CONTRATO COM APP CLIENTE (`infinity-cliente`):
--   - Inserts em `doc_registry`:
--     * metadata.uploaded_via IN ('owner_angariacao_checklist','owner_app','owner_smart_batch_upload')
--     * metadata.proc_task_id (uuid) — necessário para resolver assigned_to
--     * metadata.subtask_id (uuid) — necessário para o link no action_url
--     * metadata.signature_method = 'canvas_png_stamped' identifica CMI assinado
--     * metadata.signed_from_subtask_id identifica a subtask geracao_cmi original
--   - UPDATEs em `owners`:
--     * Opcionalmente: SET LOCAL app.current_subtask_id = '<uuid>' antes do
--       UPDATE para que o trigger correlacione o audit com a subtask.
--     * Opcionalmente: SET LOCAL app.edited_via = 'owner_app' (default 'unknown').
--     * auth.uid() é capturada automaticamente quando há JWT.
--
-- CONTRATO COM CRON DE PUSH (`/api/cron/dispatch-pending-push`):
--   - Cron Node (Coolify Scheduled Task, 1min) varre:
--       SELECT id, recipient_id, ...
--       FROM notifications
--       WHERE push_dispatched IS NOT TRUE
--         AND notification_type IN ('owner_doc_submitted','owner_cmi_signed','owner_field_edited')
--         AND created_at > now() - interval '24 hours'
--       LIMIT 100
--   - Para cada row: chama sendPushToUser(recipient_id, payload),
--     UPDATE notifications SET push_dispatched=true.
--
-- REVERT (em ordem inversa):
--   DROP TRIGGER IF EXISTS trg_doc_registry_owner_submission_notify ON public.doc_registry;
--   DROP FUNCTION IF EXISTS public.notify_consultant_owner_submission(uuid);
--   DROP TRIGGER IF EXISTS trg_owners_field_audit ON public.owners;
--   DROP FUNCTION IF EXISTS public.audit_owner_field_change();
--   DROP TABLE IF EXISTS public.owner_field_audit;
--   DROP INDEX IF EXISTS public.idx_notifications_push_pending;
--   ALTER TABLE public.notifications DROP COLUMN IF EXISTS push_dispatched;
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. notifications.push_dispatched + index parcial
-- ----------------------------------------------------------------------------
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS push_dispatched boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_notifications_push_pending
  ON public.notifications (created_at)
  WHERE push_dispatched IS NOT TRUE;

COMMENT ON COLUMN public.notifications.push_dispatched IS
  'TRUE depois do cron Node /api/cron/dispatch-pending-push enviar Web Push para esta notificação. Notifs criadas via handler TS marcam true imediatamente.';

-- ----------------------------------------------------------------------------
-- 2. owner_field_audit (tabela)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.owner_field_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES public.owners(id) ON DELETE CASCADE,
  field_name text NOT NULL,
  old_value text,
  new_value text,
  edited_by_auth_user_id uuid,
  edited_via text NOT NULL DEFAULT 'unknown',
  subtask_id uuid,
  proc_task_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_owner_field_audit_owner_created
  ON public.owner_field_audit (owner_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_owner_field_audit_subtask_field_created
  ON public.owner_field_audit (subtask_id, field_name, created_at DESC)
  WHERE subtask_id IS NOT NULL;

COMMENT ON TABLE public.owner_field_audit IS
  'Audit trail de UPDATEs em owners para colunas-whitelist (naturality, address, marital_status, legal_rep_*). Alimentado pelo trigger trg_owners_field_audit.';

-- ----------------------------------------------------------------------------
-- 3. audit_owner_field_change() — trigger de UPDATE em owners
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.audit_owner_field_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_edited_by uuid;
  v_edited_via text;
  v_subtask_id uuid;
  v_proc_task_id uuid;
  v_consultant_id uuid;
  v_property_id uuid;
  v_owner_name text;
  v_recent_count integer;
  v_old_json jsonb;
  v_new_json jsonb;
  v_field text;
  v_old_val text;
  v_new_val text;
  v_label text;
  v_action_url text;
  pt_labels jsonb := jsonb_build_object(
    'naturality', 'Naturalidade',
    'address', 'Morada',
    'marital_status', 'Estado civil',
    'legal_rep_naturality', 'Naturalidade (Rep. legal)',
    'legal_rep_address', 'Morada (Rep. legal)',
    'legal_rep_marital_status', 'Estado civil (Rep. legal)'
  );
BEGIN
  -- Auth context (NULL-safe)
  BEGIN
    v_edited_by := auth.uid();
  EXCEPTION WHEN OTHERS THEN
    v_edited_by := NULL;
  END;

  v_edited_via := COALESCE(NULLIF(current_setting('app.edited_via', true), ''), 'unknown');
  BEGIN
    v_subtask_id := NULLIF(current_setting('app.current_subtask_id', true), '')::uuid;
  EXCEPTION WHEN OTHERS THEN
    v_subtask_id := NULL;
  END;

  IF v_subtask_id IS NOT NULL THEN
    SELECT pst.proc_task_id, pt.assigned_to, pi.property_id
      INTO v_proc_task_id, v_consultant_id, v_property_id
    FROM public.proc_subtasks pst
    JOIN public.proc_tasks pt ON pt.id = pst.proc_task_id
    LEFT JOIN public.proc_instances pi ON pi.id = pt.proc_instance_id
    WHERE pst.id = v_subtask_id;
  END IF;

  v_owner_name := COALESCE(NEW.name, 'Proprietário');
  v_old_json := row_to_json(OLD)::jsonb;
  v_new_json := row_to_json(NEW)::jsonb;

  FOR v_field IN
    SELECT unnest(ARRAY[
      'naturality', 'address', 'marital_status',
      'legal_rep_naturality', 'legal_rep_address', 'legal_rep_marital_status'
    ])
  LOOP
    v_old_val := v_old_json->>v_field;
    v_new_val := v_new_json->>v_field;

    -- Skip se não mudou
    IF v_old_val IS NOT DISTINCT FROM v_new_val THEN
      CONTINUE;
    END IF;

    -- 1) Audit row (sempre)
    INSERT INTO public.owner_field_audit (
      owner_id, field_name, old_value, new_value,
      edited_by_auth_user_id, edited_via, subtask_id, proc_task_id
    ) VALUES (
      NEW.id, v_field, v_old_val, v_new_val,
      v_edited_by, v_edited_via, v_subtask_id, v_proc_task_id
    );

    -- 2) Activity em proc_task_activities (só se proc_task_id resolúvel)
    IF v_proc_task_id IS NOT NULL THEN
      INSERT INTO public.proc_task_activities (
        proc_task_id, user_id, activity_type, description, metadata
      ) VALUES (
        v_proc_task_id,
        v_edited_by,
        'owner_field_edited',
        v_owner_name || ' editou ' || (pt_labels->>v_field),
        jsonb_build_object(
          'owner_id', NEW.id,
          'field_name', v_field,
          'subtask_id', v_subtask_id,
          'edited_via', v_edited_via,
          'old_value', v_old_val,
          'new_value', v_new_val
        )
      );
    END IF;

    -- 3) Notification rate-limited (só se temos consultor para notificar
    --    E o editor não é o próprio consultor)
    IF v_consultant_id IS NOT NULL AND (v_edited_by IS NULL OR v_edited_by IS DISTINCT FROM v_consultant_id) THEN
      -- Rate-limit lookup: 5min por (subtask_id, field_name) ou (owner_id, field_name) se subtask_id NULL
      IF v_subtask_id IS NOT NULL THEN
        SELECT count(*) INTO v_recent_count
        FROM public.notifications
        WHERE notification_type = 'owner_field_edited'
          AND entity_type = 'proc_task'
          AND entity_id = v_proc_task_id
          AND (metadata->>'field_name') = v_field
          AND (metadata->>'subtask_id') = v_subtask_id::text
          AND created_at > now() - interval '5 minutes';
      ELSE
        SELECT count(*) INTO v_recent_count
        FROM public.notifications
        WHERE notification_type = 'owner_field_edited'
          AND entity_type = 'proc_task'
          AND entity_id = v_proc_task_id
          AND (metadata->>'field_name') = v_field
          AND (metadata->>'owner_id') = NEW.id::text
          AND created_at > now() - interval '5 minutes';
      END IF;

      IF v_recent_count = 0 THEN
        v_label := pt_labels->>v_field;
        v_action_url := CASE
          WHEN v_property_id IS NOT NULL AND v_subtask_id IS NOT NULL
            THEN '/dashboard/imoveis/' || v_property_id::text ||
                 '?tab=processos&subtask=' || v_subtask_id::text
          WHEN v_property_id IS NOT NULL
            THEN '/dashboard/imoveis/' || v_property_id::text || '?tab=processos'
          ELSE '/dashboard/proprietarios/' || NEW.id::text
        END;

        INSERT INTO public.notifications (
          recipient_id, sender_id, notification_type,
          entity_type, entity_id, title, body, action_url,
          metadata, push_dispatched
        ) VALUES (
          v_consultant_id,
          v_edited_by,
          'owner_field_edited',
          'proc_task',
          v_proc_task_id,
          v_owner_name || ' editou ' || v_label,
          v_label || ': ' || COALESCE(NULLIF(v_old_val, ''), '(vazio)') ||
            ' → ' || COALESCE(NULLIF(v_new_val, ''), '(vazio)'),
          v_action_url,
          jsonb_build_object(
            'owner_id', NEW.id,
            'field_name', v_field,
            'subtask_id', v_subtask_id,
            'edited_via', v_edited_via
          ),
          false  -- cron despacha push
        );
      END IF;
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.audit_owner_field_change() IS
  'Trigger function: AFTER UPDATE de owners. Para cada coluna-whitelist alterada, insere audit row + activity (se subtask_id resolúvel) + notification rate-limited (5min). NULL-safe para auth.uid() e settings em falta.';

-- Trigger
DROP TRIGGER IF EXISTS trg_owners_field_audit ON public.owners;
CREATE TRIGGER trg_owners_field_audit
  AFTER UPDATE OF naturality, address, marital_status,
                  legal_rep_naturality, legal_rep_address, legal_rep_marital_status
  ON public.owners
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_owner_field_change();

-- ----------------------------------------------------------------------------
-- 4. notify_consultant_owner_submission() — trigger de INSERT em doc_registry
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.notify_consultant_owner_submission()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uploaded_via text;
  v_signature_method text;
  v_proc_task_id uuid;
  v_subtask_id uuid;
  v_owner_id uuid;
  v_consultant_id uuid;
  v_property_id uuid;
  v_owner_name text;
  v_doc_type_name text;
  v_notification_type text;
  v_existing_count integer;
  v_action_url text;
  v_title text;
  v_body text;
BEGIN
  v_uploaded_via := NEW.metadata->>'uploaded_via';

  -- Filtro defensivo (já temos WHEN clause no trigger, mas guard em depth)
  IF v_uploaded_via NOT IN ('owner_angariacao_checklist', 'owner_app', 'owner_smart_batch_upload') THEN
    RETURN NEW;
  END IF;

  v_signature_method := NEW.metadata->>'signature_method';

  -- Resolve proc_task_id da metadata
  BEGIN
    v_proc_task_id := NULLIF(NEW.metadata->>'proc_task_id', '')::uuid;
  EXCEPTION WHEN OTHERS THEN
    v_proc_task_id := NULL;
  END;

  BEGIN
    v_subtask_id := NULLIF(NEW.metadata->>'subtask_id', '')::uuid;
  EXCEPTION WHEN OTHERS THEN
    v_subtask_id := NULL;
  END;

  v_owner_id := NEW.owner_id;
  IF v_owner_id IS NULL THEN
    BEGIN
      v_owner_id := NULLIF(NEW.metadata->>'owner_id', '')::uuid;
    EXCEPTION WHEN OTHERS THEN
      v_owner_id := NULL;
    END;
  END IF;

  -- Resolve consultor (assigned_to da proc_task) + property_id
  IF v_proc_task_id IS NOT NULL THEN
    SELECT pt.assigned_to, pi.property_id
      INTO v_consultant_id, v_property_id
    FROM public.proc_tasks pt
    LEFT JOIN public.proc_instances pi ON pi.id = pt.proc_instance_id
    WHERE pt.id = v_proc_task_id;
  END IF;

  -- Owner name (best-effort)
  IF v_owner_id IS NOT NULL THEN
    SELECT name INTO v_owner_name FROM public.owners WHERE id = v_owner_id;
  END IF;
  v_owner_name := COALESCE(v_owner_name, 'Proprietário');

  -- Doc type name (best-effort)
  IF NEW.doc_type_id IS NOT NULL THEN
    SELECT name INTO v_doc_type_name FROM public.doc_types WHERE id = NEW.doc_type_id;
  END IF;
  v_doc_type_name := COALESCE(v_doc_type_name, 'um documento');

  -- Discrimina tipo de notificação
  IF v_signature_method = 'canvas_png_stamped' THEN
    v_notification_type := 'owner_cmi_signed';
    v_title := v_owner_name || ' assinou o CMI';
    v_body := 'Assinatura recebida — pronta para revisão.';
  ELSE
    v_notification_type := 'owner_doc_submitted';
    v_title := v_owner_name || ' enviou ' || v_doc_type_name;
    v_body := 'Documento aguarda revisão.';
  END IF;

  -- Sempre regista activity (mesmo sem consultor para notificar)
  IF v_proc_task_id IS NOT NULL THEN
    -- Idempotência: 1 activity por doc_id + tipo
    SELECT count(*) INTO v_existing_count
    FROM public.proc_task_activities
    WHERE proc_task_id = v_proc_task_id
      AND activity_type = v_notification_type
      AND (metadata->>'doc_id') = NEW.id::text;

    IF v_existing_count = 0 THEN
      INSERT INTO public.proc_task_activities (
        proc_task_id, user_id, activity_type, description, metadata
      ) VALUES (
        v_proc_task_id,
        NULL,  -- não há consultor a actuar; é evento do sistema
        v_notification_type,
        v_title,
        jsonb_build_object(
          'doc_id', NEW.id,
          'subtask_id', v_subtask_id,
          'owner_id', v_owner_id,
          'uploaded_via', v_uploaded_via,
          'signature_method', v_signature_method,
          'doc_type_id', NEW.doc_type_id,
          'doc_type_name', v_doc_type_name
        )
      );
    END IF;
  END IF;

  -- Notification só se há consultor
  IF v_consultant_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Idempotência: 1 notification por doc_id (entity_id) + tipo
  SELECT count(*) INTO v_existing_count
  FROM public.notifications
  WHERE notification_type = v_notification_type
    AND entity_type = 'proc_task'
    AND (metadata->>'doc_id') = NEW.id::text;

  IF v_existing_count > 0 THEN
    RETURN NEW;
  END IF;

  v_action_url := CASE
    WHEN v_property_id IS NOT NULL AND v_subtask_id IS NOT NULL
      THEN '/dashboard/imoveis/' || v_property_id::text ||
           '?tab=processos&subtask=' || v_subtask_id::text
    WHEN v_property_id IS NOT NULL
      THEN '/dashboard/imoveis/' || v_property_id::text || '?tab=processos'
    ELSE '/dashboard/processos'
  END;

  INSERT INTO public.notifications (
    recipient_id, sender_id, notification_type,
    entity_type, entity_id, title, body, action_url,
    metadata, push_dispatched
  ) VALUES (
    v_consultant_id,
    NULL,  -- sem sender (é o sistema/owner)
    v_notification_type,
    'proc_task',
    v_proc_task_id,
    v_title,
    v_body,
    v_action_url,
    jsonb_build_object(
      'doc_id', NEW.id,
      'subtask_id', v_subtask_id,
      'proc_instance_id', (SELECT proc_instance_id FROM public.proc_tasks WHERE id = v_proc_task_id),
      'owner_id', v_owner_id,
      'uploaded_via', v_uploaded_via,
      'signature_method', v_signature_method,
      'doc_type_id', NEW.doc_type_id,
      'doc_type_name', v_doc_type_name
    ),
    false  -- cron despacha push
  );

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.notify_consultant_owner_submission() IS
  'Trigger function: AFTER INSERT em doc_registry. Quando metadata.uploaded_via é owner_*, cria activity + notification para o consultor (assigned_to da proc_task). Discrimina owner_cmi_signed por metadata.signature_method. Idempotente por doc_id.';

DROP TRIGGER IF EXISTS trg_doc_registry_owner_submission_notify ON public.doc_registry;
CREATE TRIGGER trg_doc_registry_owner_submission_notify
  AFTER INSERT ON public.doc_registry
  FOR EACH ROW
  WHEN (
    NEW.metadata->>'uploaded_via' IN ('owner_angariacao_checklist', 'owner_app', 'owner_smart_batch_upload')
  )
  EXECUTE FUNCTION public.notify_consultant_owner_submission();

-- ============================================================================
-- Smoke-test queries (correr manualmente após migration):
--
-- -- Verificar coluna + index em notifications:
-- \d+ public.notifications
--
-- -- Verificar tabela + índices em owner_field_audit:
-- \d+ public.owner_field_audit
--
-- -- Listar triggers em owners:
-- SELECT trigger_name, event_manipulation FROM information_schema.triggers
-- WHERE event_object_table='owners';
--
-- -- Listar triggers em doc_registry:
-- SELECT trigger_name, event_manipulation FROM information_schema.triggers
-- WHERE event_object_table='doc_registry';
-- ============================================================================
