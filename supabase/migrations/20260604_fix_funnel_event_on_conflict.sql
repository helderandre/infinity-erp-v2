-- ─────────────────────────────────────────────────────────────────────────
-- Fix: ON CONFLICT in fn_funnel_event_* triggers must match the
-- partial unique index on agent_funnel_events.
--
-- Index `idx_funnel_events_source_dedup` is on
--   (source_ref_type, source_ref_id, side, stage)
--   WHERE source_ref_type IS NOT NULL AND source_ref_id IS NOT NULL
--
-- The original 20260603 trigger migration referenced only 3 columns and
-- omitted the WHERE clause. As soon as a negócio inherited
-- assigned_consultant_id (which the trg_negocios_default_consultant
-- BEFORE-INSERT trigger does whenever the lead has agent_id set), the
-- AFTER-INSERT funnel trigger raised
--   42P10: there is no unique or exclusion constraint matching the
--          ON CONFLICT specification
-- and the negócio insert was rolled back. Symptom: contact-dialog reported
-- success (the lead committed) but the negócio never landed.
--
-- Same mismatch existed in two sibling triggers (deal_payment / deal),
-- silently dropping cpcv- and fecho-funnel events.
-- ─────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.fn_funnel_event_on_negocio_insert()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
  v_side TEXT;
  v_stage TEXT;
BEGIN
  IF NEW.assigned_consultant_id IS NULL THEN RETURN NEW; END IF;

  v_side := public._funnel_side_from_tipo(NEW.tipo);
  IF v_side IS NULL THEN RETURN NEW; END IF;

  v_stage := CASE WHEN v_side = 'vendedor' THEN 'pre_angariacao' ELSE 'pesquisa' END;

  INSERT INTO public.agent_funnel_events (
    agent_id, side, stage, occurred_at, count,
    source, source_ref_type, source_ref_id
  ) VALUES (
    NEW.assigned_consultant_id, v_side, v_stage,
    COALESCE(NEW.created_at, now()),
    1, 'auto:negocio', 'negocio', NEW.id
  )
  ON CONFLICT (source_ref_type, source_ref_id, side, stage)
  WHERE source_ref_type IS NOT NULL AND source_ref_id IS NOT NULL
  DO NOTHING;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.fn_funnel_cpcv_on_payment_signed()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
  v_consultant_id UUID;
  v_negocio_id UUID;
  v_tipo TEXT;
  v_side TEXT;
BEGIN
  IF NEW.payment_moment <> 'cpcv' THEN RETURN NEW; END IF;
  IF NEW.is_signed IS NOT TRUE THEN RETURN NEW; END IF;
  IF OLD.is_signed IS TRUE THEN RETURN NEW; END IF;

  SELECT d.consultant_id, d.negocio_id INTO v_consultant_id, v_negocio_id
  FROM public.deals d WHERE d.id = NEW.deal_id;

  IF v_consultant_id IS NULL OR v_negocio_id IS NULL THEN RETURN NEW; END IF;

  SELECT tipo INTO v_tipo FROM public.negocios WHERE id = v_negocio_id;
  v_side := public._funnel_side_from_tipo(v_tipo);
  IF v_side IS NULL THEN RETURN NEW; END IF;

  INSERT INTO public.agent_funnel_events (
    agent_id, side, stage, occurred_at, count,
    source, source_ref_type, source_ref_id
  ) VALUES (
    v_consultant_id, v_side, 'cpcv',
    COALESCE(NEW.signed_date::timestamptz, now()),
    1, 'auto:deal_payment', 'deal_payment', NEW.id
  )
  ON CONFLICT (source_ref_type, source_ref_id, side, stage)
  WHERE source_ref_type IS NOT NULL AND source_ref_id IS NOT NULL
  DO NOTHING;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.fn_funnel_fecho_on_deal_completed()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
  v_tipo TEXT;
  v_side TEXT;
BEGIN
  IF NEW.status <> 'completed' THEN RETURN NEW; END IF;
  IF OLD.status = 'completed' THEN RETURN NEW; END IF;
  IF NEW.consultant_id IS NULL OR NEW.negocio_id IS NULL THEN RETURN NEW; END IF;

  SELECT tipo INTO v_tipo FROM public.negocios WHERE id = NEW.negocio_id;
  v_side := public._funnel_side_from_tipo(v_tipo);
  IF v_side IS NULL THEN RETURN NEW; END IF;

  INSERT INTO public.agent_funnel_events (
    agent_id, side, stage, occurred_at, count,
    source, source_ref_type, source_ref_id
  ) VALUES (
    NEW.consultant_id, v_side, 'fecho', now(),
    1, 'auto:deal', 'deal', NEW.id
  )
  ON CONFLICT (source_ref_type, source_ref_id, side, stage)
  WHERE source_ref_type IS NOT NULL AND source_ref_id IS NOT NULL
  DO NOTHING;

  RETURN NEW;
END;
$function$;
