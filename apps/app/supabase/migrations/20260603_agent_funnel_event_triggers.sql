-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: triggers that populate agent_funnel_events from existing tables
-- Date: 2026-06-03
--
-- Three hooks:
--   1. deal_payments.is_signed flips true (payment_moment='cpcv') → 'cpcv'
--   2. deals.status flips to 'completed'                         → 'fecho'
--   3. negocios INSERT                                            → 'pre_angariacao' (vendedor) or 'pesquisa' (comprador)
--
-- Each event is idempotent via the unique index on (source_ref_type,
-- source_ref_id, stage). Re-firing the trigger will not create duplicates.
--
-- Side mapping (negocios.tipo):
--   Vendedor, Senhorio   → 'vendedor'
--   Comprador, Arrendatário → 'comprador'
--   Outro                 → skipped (not counted in either funnel)
-- ─────────────────────────────────────────────────────────────────────────────

-- Helper: derive ('vendedor' | 'comprador' | NULL) from a negocio.tipo string
CREATE OR REPLACE FUNCTION public._funnel_side_from_tipo(p_tipo TEXT)
RETURNS TEXT AS $$
BEGIN
  IF p_tipo IN ('Vendedor', 'Senhorio') THEN RETURN 'vendedor';
  ELSIF p_tipo IN ('Comprador', 'Arrendatário') THEN RETURN 'comprador';
  ELSE RETURN NULL;
  END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ─── Hook 1: CPCV signed ─────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.fn_funnel_cpcv_on_payment_signed()
RETURNS TRIGGER AS $$
DECLARE
  v_consultant_id UUID;
  v_negocio_id UUID;
  v_tipo TEXT;
  v_side TEXT;
BEGIN
  -- Only fire for payment_moment='cpcv' flipping to is_signed=true
  IF NEW.payment_moment <> 'cpcv' THEN RETURN NEW; END IF;
  IF NEW.is_signed IS NOT TRUE THEN RETURN NEW; END IF;
  IF OLD.is_signed IS TRUE THEN RETURN NEW; END IF; -- already counted

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
  ON CONFLICT (source_ref_type, source_ref_id, stage) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_funnel_cpcv_on_payment_signed ON public.deal_payments;
CREATE TRIGGER trg_funnel_cpcv_on_payment_signed
  AFTER UPDATE ON public.deal_payments
  FOR EACH ROW
  WHEN (NEW.is_signed IS TRUE AND OLD.is_signed IS DISTINCT FROM TRUE)
  EXECUTE FUNCTION public.fn_funnel_cpcv_on_payment_signed();

-- ─── Hook 2: Deal completed (= fecho) ────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.fn_funnel_fecho_on_deal_completed()
RETURNS TRIGGER AS $$
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
  ON CONFLICT (source_ref_type, source_ref_id, stage) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_funnel_fecho_on_deal_completed ON public.deals;
CREATE TRIGGER trg_funnel_fecho_on_deal_completed
  AFTER UPDATE ON public.deals
  FOR EACH ROW
  WHEN (NEW.status = 'completed' AND OLD.status IS DISTINCT FROM 'completed')
  EXECUTE FUNCTION public.fn_funnel_fecho_on_deal_completed();

-- ─── Hook 3: Negocio created ─────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.fn_funnel_event_on_negocio_insert()
RETURNS TRIGGER AS $$
DECLARE
  v_side TEXT;
  v_stage TEXT;
BEGIN
  IF NEW.assigned_consultant_id IS NULL THEN RETURN NEW; END IF;

  v_side := public._funnel_side_from_tipo(NEW.tipo);
  IF v_side IS NULL THEN RETURN NEW; END IF;

  -- Vendedor side: a new opportunity is an early-stage 'pre_angariacao'
  -- Comprador side: a new opportunity is a 'pesquisa' (active buyer)
  v_stage := CASE WHEN v_side = 'vendedor' THEN 'pre_angariacao' ELSE 'pesquisa' END;

  INSERT INTO public.agent_funnel_events (
    agent_id, side, stage, occurred_at, count,
    source, source_ref_type, source_ref_id
  ) VALUES (
    NEW.assigned_consultant_id, v_side, v_stage,
    COALESCE(NEW.created_at, now()),
    1, 'auto:negocio', 'negocio', NEW.id
  )
  ON CONFLICT (source_ref_type, source_ref_id, stage) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_funnel_event_on_negocio_insert ON public.negocios;
CREATE TRIGGER trg_funnel_event_on_negocio_insert
  AFTER INSERT ON public.negocios
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_funnel_event_on_negocio_insert();
