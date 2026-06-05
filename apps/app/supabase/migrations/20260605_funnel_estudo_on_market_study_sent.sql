-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: Hook 7 — estudo de mercado as funnel event
-- Date: 2026-06-05
--
-- Source: negocio_market_studies.sent_at flipping NULL → non-NULL.
-- The existing UI in <MarketStudiesCard> already lets the agent mark a study
-- as sent (via email, whatsapp, or "manual"), persisting the timestamp in
-- sent_at. This trigger reads that flip and logs an `estudo` event for the
-- agent on the vendedor side.
--
-- Side: only logged when negocios.tipo IN ('Vendedor', 'Senhorio'). For
-- buyer-side perspectives the estudo is conceptually irrelevant.
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
  ON CONFLICT (source_ref_type, source_ref_id, side, stage) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_funnel_estudo_on_market_study_sent_insert ON public.negocio_market_studies;
CREATE TRIGGER trg_funnel_estudo_on_market_study_sent_insert
  AFTER INSERT ON public.negocio_market_studies
  FOR EACH ROW
  WHEN (NEW.sent_at IS NOT NULL)
  EXECUTE FUNCTION public.fn_funnel_estudo_on_market_study_sent();

DROP TRIGGER IF EXISTS trg_funnel_estudo_on_market_study_sent_update ON public.negocio_market_studies;
CREATE TRIGGER trg_funnel_estudo_on_market_study_sent_update
  AFTER UPDATE ON public.negocio_market_studies
  FOR EACH ROW
  WHEN (NEW.sent_at IS NOT NULL AND OLD.sent_at IS DISTINCT FROM NEW.sent_at)
  EXECUTE FUNCTION public.fn_funnel_estudo_on_market_study_sent();
