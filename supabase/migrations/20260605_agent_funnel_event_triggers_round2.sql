-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: round 2 of agent_funnel_events auto-hooks
-- Date: 2026-06-05
--
-- Adds three new triggers + widens the dedup index to include `side`
-- (visits log two events from a single source row — one per side).
--
-- Triggers:
--   1. visits.status flips into ('completed' | 'proposal') → log 'visita'
--      for both consultant_id (comprador) and seller_consultant_id (vendedor)
--      when present and distinct.
--   2. negocio_proposals INSERT → log 'proposta' for the proposing agent
--      (side from negocios.tipo) plus the listing-side agent (vendedor) when
--      different and the negocio is buyer-side.
--   3. proc_instances.current_status flips to 'active' for
--      process_type='angariacao' → log 'angariacao' for the property's
--      consultant on the vendedor side, with occurred_at = approved_at.
-- ─────────────────────────────────────────────────────────────────────────────

-- Widen idempotency index to include `side`
DROP INDEX IF EXISTS public.idx_funnel_events_source_dedup;
CREATE UNIQUE INDEX IF NOT EXISTS idx_funnel_events_source_dedup
  ON public.agent_funnel_events(source_ref_type, source_ref_id, side, stage)
  WHERE source_ref_type IS NOT NULL AND source_ref_id IS NOT NULL;

-- ─── Hook 4: visit "happened" → 'visita' (both sides if applicable) ─────────

CREATE OR REPLACE FUNCTION public.fn_funnel_visita_on_visit_done()
RETURNS TRIGGER AS $$
DECLARE
  v_occurred_at TIMESTAMPTZ;
BEGIN
  IF NEW.status NOT IN ('completed', 'proposal') THEN RETURN NEW; END IF;
  IF OLD.status IN ('completed', 'proposal') THEN RETURN NEW; END IF;

  v_occurred_at := COALESCE(
    (NEW.visit_date::timestamptz + COALESCE(NEW.visit_time, '00:00')::interval),
    NEW.updated_at,
    now()
  );

  IF NEW.consultant_id IS NOT NULL THEN
    INSERT INTO public.agent_funnel_events (
      agent_id, side, stage, occurred_at, count,
      source, source_ref_type, source_ref_id
    ) VALUES (
      NEW.consultant_id, 'comprador', 'visita', v_occurred_at,
      1, 'auto:visit', 'visit', NEW.id
    )
    ON CONFLICT (source_ref_type, source_ref_id, side, stage) DO NOTHING;
  END IF;

  IF NEW.seller_consultant_id IS NOT NULL
     AND NEW.seller_consultant_id IS DISTINCT FROM NEW.consultant_id THEN
    INSERT INTO public.agent_funnel_events (
      agent_id, side, stage, occurred_at, count,
      source, source_ref_type, source_ref_id
    ) VALUES (
      NEW.seller_consultant_id, 'vendedor', 'visita', v_occurred_at,
      1, 'auto:visit', 'visit', NEW.id
    )
    ON CONFLICT (source_ref_type, source_ref_id, side, stage) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_funnel_visita_on_visit_done ON public.visits;
CREATE TRIGGER trg_funnel_visita_on_visit_done
  AFTER UPDATE ON public.visits
  FOR EACH ROW
  WHEN (NEW.status IN ('completed', 'proposal') AND OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION public.fn_funnel_visita_on_visit_done();

-- ─── Hook 5: negocio_proposals INSERT → 'proposta' ──────────────────────────

CREATE OR REPLACE FUNCTION public.fn_funnel_proposta_on_negocio_proposal_insert()
RETURNS TRIGGER AS $$
DECLARE
  v_negocio_consultant UUID;
  v_negocio_tipo TEXT;
  v_negocio_side TEXT;
  v_listing_consultant UUID;
BEGIN
  SELECT n.assigned_consultant_id, n.tipo INTO v_negocio_consultant, v_negocio_tipo
  FROM public.negocios n WHERE n.id = NEW.negocio_id;

  IF NEW.property_id IS NOT NULL THEN
    SELECT p.consultant_id INTO v_listing_consultant
    FROM public.dev_properties p WHERE p.id = NEW.property_id;
  END IF;

  v_negocio_side := public._funnel_side_from_tipo(v_negocio_tipo);

  IF v_negocio_consultant IS NOT NULL AND v_negocio_side IS NOT NULL THEN
    INSERT INTO public.agent_funnel_events (
      agent_id, side, stage, occurred_at, count,
      source, source_ref_type, source_ref_id
    ) VALUES (
      v_negocio_consultant, v_negocio_side, 'proposta',
      COALESCE(NEW.created_at, now()),
      1, 'auto:negocio_proposal', 'negocio_proposal', NEW.id
    )
    ON CONFLICT (source_ref_type, source_ref_id, side, stage) DO NOTHING;
  END IF;

  IF v_listing_consultant IS NOT NULL
     AND v_listing_consultant IS DISTINCT FROM v_negocio_consultant
     AND v_negocio_side = 'comprador' THEN
    INSERT INTO public.agent_funnel_events (
      agent_id, side, stage, occurred_at, count,
      source, source_ref_type, source_ref_id
    ) VALUES (
      v_listing_consultant, 'vendedor', 'proposta',
      COALESCE(NEW.created_at, now()),
      1, 'auto:negocio_proposal', 'negocio_proposal', NEW.id
    )
    ON CONFLICT (source_ref_type, source_ref_id, side, stage) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_funnel_proposta_on_negocio_proposal_insert ON public.negocio_proposals;
CREATE TRIGGER trg_funnel_proposta_on_negocio_proposal_insert
  AFTER INSERT ON public.negocio_proposals
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_funnel_proposta_on_negocio_proposal_insert();

-- ─── Hook 6: angariação proc_instance goes active → 'angariacao' ────────────

CREATE OR REPLACE FUNCTION public.fn_funnel_angariacao_on_proc_active()
RETURNS TRIGGER AS $$
DECLARE
  v_consultant UUID;
BEGIN
  IF NEW.process_type <> 'angariacao' THEN RETURN NEW; END IF;
  IF NEW.current_status <> 'active' THEN RETURN NEW; END IF;
  IF OLD.current_status = 'active' THEN RETURN NEW; END IF;
  IF NEW.property_id IS NULL THEN RETURN NEW; END IF;

  SELECT consultant_id INTO v_consultant
  FROM public.dev_properties WHERE id = NEW.property_id;
  IF v_consultant IS NULL THEN RETURN NEW; END IF;

  INSERT INTO public.agent_funnel_events (
    agent_id, side, stage, occurred_at, count,
    source, source_ref_type, source_ref_id
  ) VALUES (
    v_consultant, 'vendedor', 'angariacao',
    COALESCE(NEW.approved_at, NEW.started_at, now()),
    1, 'auto:proc_instance', 'proc_instance', NEW.id
  )
  ON CONFLICT (source_ref_type, source_ref_id, side, stage) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_funnel_angariacao_on_proc_active ON public.proc_instances;
CREATE TRIGGER trg_funnel_angariacao_on_proc_active
  AFTER UPDATE ON public.proc_instances
  FOR EACH ROW
  WHEN (NEW.process_type = 'angariacao' AND NEW.current_status = 'active' AND OLD.current_status IS DISTINCT FROM 'active')
  EXECUTE FUNCTION public.fn_funnel_angariacao_on_proc_active();
