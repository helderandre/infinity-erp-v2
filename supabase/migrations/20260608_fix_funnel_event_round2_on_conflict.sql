-- ─────────────────────────────────────────────────────────────────────────
-- Fix: round 2 funnel-event triggers must repeat the partial-index WHERE
-- clause in ON CONFLICT, same as 20260604.
--
-- The unique index `idx_funnel_events_source_dedup` is PARTIAL:
--   ON agent_funnel_events (source_ref_type, source_ref_id, side, stage)
--   WHERE source_ref_type IS NOT NULL AND source_ref_id IS NOT NULL
--
-- Postgres can only infer a partial index from `ON CONFLICT (cols)` if the
-- statement repeats the same WHERE predicate. The three functions added in
-- 20260605 (visita / proposta / angariacao) omitted it, so any UPDATE that
-- flips a watched column raises:
--   42P10: there is no unique or exclusion constraint matching the
--          ON CONFLICT specification
--
-- Repro: approving a PROC-ANG-* (UPDATE proc_instances SET
-- current_status='active') fires trg_funnel_angariacao_on_proc_active and
-- the whole UPDATE fails with the message above bubbling out of
-- autoActivateProcess. Same latent bug exists in the visit / proposal
-- hooks but they weren't surfaced yet.
--
-- Fix: CREATE OR REPLACE the 3 functions adding the WHERE predicate to the
-- ON CONFLICT clause. Triggers stay bound to the same function name; no
-- DROP TRIGGER needed.
-- ─────────────────────────────────────────────────────────────────────────

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
    ON CONFLICT (source_ref_type, source_ref_id, side, stage)
    WHERE source_ref_type IS NOT NULL AND source_ref_id IS NOT NULL
    DO NOTHING;
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
    ON CONFLICT (source_ref_type, source_ref_id, side, stage)
    WHERE source_ref_type IS NOT NULL AND source_ref_id IS NOT NULL
    DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;


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
    ON CONFLICT (source_ref_type, source_ref_id, side, stage)
    WHERE source_ref_type IS NOT NULL AND source_ref_id IS NOT NULL
    DO NOTHING;
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
    ON CONFLICT (source_ref_type, source_ref_id, side, stage)
    WHERE source_ref_type IS NOT NULL AND source_ref_id IS NOT NULL
    DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;


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
  ON CONFLICT (source_ref_type, source_ref_id, side, stage)
  WHERE source_ref_type IS NOT NULL AND source_ref_id IS NOT NULL
  DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
