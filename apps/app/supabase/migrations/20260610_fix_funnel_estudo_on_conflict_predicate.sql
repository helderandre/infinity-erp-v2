-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: Fix — "Marcar como enviado" em estudos de mercado rebentava
-- Date: 2026-06-10
--
-- Bug: fn_funnel_estudo_on_market_study_sent usava
--   ON CONFLICT (source_ref_type, source_ref_id, side, stage) DO NOTHING
-- mas o único índice único correspondente em agent_funnel_events
-- (idx_funnel_events_source_dedup) é PARCIAL (WHERE source_ref_type IS NOT
-- NULL AND source_ref_id IS NOT NULL). Sem repetir o predicado, o Postgres
-- não consegue inferir o arbiter e aborta com 42P10 ("there is no unique or
-- exclusion constraint matching the ON CONFLICT specification") — o que
-- fazia falhar QUALQUER UPDATE de negocio_market_studies que flipasse
-- sent_at (UI: "Erro ao marcar como enviado").
--
-- As restantes 6 funções fn_funnel_* já incluíam o predicado — esta era a
-- única em falta. Revert: reaplicar 20260605_funnel_estudo_on_market_study_sent.sql.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.fn_funnel_estudo_on_market_study_sent()
RETURNS TRIGGER AS $$
DECLARE
  v_consultant UUID;
  v_tipo TEXT;
BEGIN
  IF NEW.sent_at IS NULL THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.sent_at IS NOT NULL THEN RETURN NEW; END IF;

  SELECT n.assigned_consultant_id, n.tipo
    INTO v_consultant, v_tipo
  FROM public.negocios n WHERE n.id = NEW.negocio_id;

  IF v_consultant IS NULL THEN RETURN NEW; END IF;
  IF v_tipo NOT IN ('Vendedor', 'Senhorio') THEN RETURN NEW; END IF;

  INSERT INTO public.agent_funnel_events (
    agent_id, side, stage, occurred_at, count,
    source, source_ref_type, source_ref_id
  ) VALUES (
    v_consultant, 'vendedor', 'estudo', NEW.sent_at,
    1, 'auto:market_study', 'market_study', NEW.id
  )
  ON CONFLICT (source_ref_type, source_ref_id, side, stage)
  WHERE source_ref_type IS NOT NULL AND source_ref_id IS NOT NULL
  DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
