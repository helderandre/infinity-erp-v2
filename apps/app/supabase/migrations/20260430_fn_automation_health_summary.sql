-- ==================================================================
-- MIGRATION: get_automation_health_summary()
-- ==================================================================
-- Função que agrega 30 dias de contact_automation_runs por consultor
-- e event_key, devolvendo uma linha por evento com:
--   * last_run_at / last_run_status
--   * runs_last_30d: { sent, failed, skipped, pending }
--   * failed_unresolved: até 5 leads com status='failed' cujo par
--     (lead_id, event_key) não tem run posterior com status='sent'
--   * failed_unresolved_count: total (pode exceder os 5)
--
-- `event_key` é 'aniversario_contacto' | 'natal' | 'ano_novo' | 'custom:<uuid>'
-- Scope de consultor resolvido sempre via leads.agent_id:
--   * virtual / custom_event → r.lead_id → leads.agent_id
--   * manual                 → contact_automations.contact_id → leads.agent_id
--   (COALESCE escolhe lead_id se presente, senão contact_id)
--
-- A função é SECURITY INVOKER (default) — não contorna RLS. Como é
-- invocada via admin client no route handler após validação de auth,
-- não há risco de leak.
--
-- ADITIVA: apenas cria a função. Zero alterações a tabelas.
--
-- REVERT:
--   DROP FUNCTION IF EXISTS public.get_automation_health_summary(uuid);
-- ==================================================================

CREATE OR REPLACE FUNCTION public.get_automation_health_summary(p_consultant_id uuid)
RETURNS TABLE (
  event_key text,
  last_run_at timestamptz,
  last_run_status text,
  sent_30d bigint,
  failed_30d bigint,
  skipped_30d bigint,
  pending_30d bigint,
  failed_unresolved jsonb,
  failed_unresolved_count bigint
)
LANGUAGE sql
STABLE
AS $$
  WITH recent_runs AS (
    SELECT
      r.id,
      r.status,
      r.sent_at,
      r.scheduled_for,
      r.created_at,
      r.error,
      r.skip_reason,
      COALESCE(r.lead_id, ca.contact_id) AS lead_id,
      r.event_type,
      r.custom_event_id,
      r.kind,
      l.agent_id AS consultant_id,
      COALESCE('custom:' || r.custom_event_id::text, r.event_type) AS event_key
    FROM contact_automation_runs r
    LEFT JOIN contact_automations ca
      ON ca.id = r.contact_automation_id
    LEFT JOIN leads l
      ON l.id = COALESCE(r.lead_id, ca.contact_id)
    WHERE r.created_at > now() - interval '30 days'
  ),
  scoped AS (
    SELECT * FROM recent_runs WHERE consultant_id = p_consultant_id
  ),
  -- Para cada (event_key, lead_id) mantemos apenas o run falhado mais
  -- recente + flag "tem sent posterior?". Se has_later_sent=true,
  -- a falha foi resolvida por retry e é excluída.
  lead_event_latest_failed AS (
    SELECT
      s.event_key,
      s.lead_id,
      s.id AS run_id,
      COALESCE(s.error, s.skip_reason) AS error_raw,
      EXISTS (
        SELECT 1 FROM scoped s2
        WHERE s2.event_key = s.event_key
          AND s2.lead_id = s.lead_id
          AND s2.status = 'sent'
          AND COALESCE(s2.sent_at, s2.scheduled_for) > COALESCE(s.sent_at, s.scheduled_for)
      ) AS has_later_sent,
      ROW_NUMBER() OVER (
        PARTITION BY s.event_key, s.lead_id
        ORDER BY COALESCE(s.sent_at, s.scheduled_for) DESC
      ) AS rn_per_lead
    FROM scoped s
    WHERE s.status = 'failed' AND s.lead_id IS NOT NULL
  ),
  unresolved AS (
    SELECT event_key, lead_id, run_id, error_raw
    FROM lead_event_latest_failed
    WHERE rn_per_lead = 1 AND NOT has_later_sent
  ),
  unresolved_ranked AS (
    SELECT
      u.event_key,
      u.lead_id,
      u.run_id,
      u.error_raw,
      leads.nome AS lead_name,
      ROW_NUMBER() OVER (
        PARTITION BY u.event_key
        ORDER BY leads.nome NULLS LAST, u.run_id
      ) AS rnk
    FROM unresolved u
    LEFT JOIN leads ON leads.id = u.lead_id
  ),
  unresolved_top5 AS (
    SELECT
      event_key,
      jsonb_agg(
        jsonb_build_object(
          'run_id', run_id,
          'lead_id', lead_id,
          'lead_name', lead_name,
          'error_short', CASE
            WHEN error_raw IS NULL THEN NULL
            WHEN length(error_raw) <= 80 THEN error_raw
            ELSE substring(error_raw FROM 1 FOR 80)
          END
        )
        ORDER BY rnk
      ) FILTER (WHERE rnk <= 5) AS failed_unresolved,
      count(*) AS failed_unresolved_count
    FROM unresolved_ranked
    GROUP BY event_key
  ),
  last_runs AS (
    SELECT DISTINCT ON (event_key)
      event_key,
      COALESCE(sent_at, scheduled_for) AS last_run_at,
      status AS last_run_status
    FROM scoped
    ORDER BY event_key, COALESCE(sent_at, scheduled_for) DESC
  ),
  aggregated AS (
    SELECT
      event_key,
      count(*) FILTER (WHERE status = 'sent')    AS sent_30d,
      count(*) FILTER (WHERE status = 'failed')  AS failed_30d,
      count(*) FILTER (WHERE status = 'skipped') AS skipped_30d,
      count(*) FILTER (WHERE status = 'pending') AS pending_30d
    FROM scoped
    GROUP BY event_key
  )
  SELECT
    a.event_key,
    lr.last_run_at,
    lr.last_run_status,
    a.sent_30d,
    a.failed_30d,
    a.skipped_30d,
    a.pending_30d,
    COALESCE(u.failed_unresolved, '[]'::jsonb) AS failed_unresolved,
    COALESCE(u.failed_unresolved_count, 0)      AS failed_unresolved_count
  FROM aggregated a
  LEFT JOIN last_runs       lr ON lr.event_key = a.event_key
  LEFT JOIN unresolved_top5 u  ON u.event_key  = a.event_key;
$$;

COMMENT ON FUNCTION public.get_automation_health_summary(uuid)
IS 'Agrega últimos 30 dias de contact_automation_runs por (consultant_id, event_key). Alimenta os cards do hub de automatismos.';
