-- ============================================================================
-- 20260514_funnel_data_quality_fixes.sql
--
-- Resolve 3 critical data-quality gaps that distort the new "Objetivos"
-- two-funnel metrics:
--
--   1. negocios.assigned_consultant_id often NULL (28/54). Backfill from
--      leads.agent_id where possible (~7 rows recoverable). Add a BEFORE
--      INSERT trigger that auto-fills future rows.
--
--   2. deals.negocio_id always NULL (10/10). Auto-link via accepted
--      negocio_proposals (proposals.deal_id → deals.id). Backfill is a no-op
--      today (no historical proposals reference a deal) but the trigger
--      ensures every future deal-from-proposal is correctly linked.
--
--   3. deals lacks explicit "CPCV signed" / "Escritura signed" timestamps.
--      Add cpcv_signed_at + escritura_signed_at (nullable). Update the
--      funnel_events view to prefer these real events over the current
--      proxies (cpcv_pct>0 / deal_date<=today).
--
-- Revert:
--   DROP TRIGGER IF EXISTS trg_negocios_default_consultant ON public.negocios;
--   DROP FUNCTION IF EXISTS public.negocios_default_consultant();
--   DROP TRIGGER IF EXISTS trg_proposal_link_deal ON public.negocio_proposals;
--   DROP FUNCTION IF EXISTS public.proposal_link_deal_to_negocio();
--   ALTER TABLE public.deals DROP COLUMN IF EXISTS cpcv_signed_at;
--   ALTER TABLE public.deals DROP COLUMN IF EXISTS escritura_signed_at;
--   (then re-run the funnel_events view from 20260513_funnel_events_and_targets.sql
--   to revert detection rules.)
-- ============================================================================

-- ── 1. Backfill negocios.assigned_consultant_id ────────────────────────────
UPDATE public.negocios n
SET assigned_consultant_id = l.agent_id
FROM public.leads l
WHERE n.lead_id = l.id
  AND n.assigned_consultant_id IS NULL
  AND l.agent_id IS NOT NULL;

-- BEFORE INSERT/UPDATE trigger: copy lead.agent_id when consultant is null
CREATE OR REPLACE FUNCTION public.negocios_default_consultant()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.assigned_consultant_id IS NULL AND NEW.lead_id IS NOT NULL THEN
    SELECT agent_id INTO NEW.assigned_consultant_id
    FROM public.leads
    WHERE id = NEW.lead_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_negocios_default_consultant ON public.negocios;
CREATE TRIGGER trg_negocios_default_consultant
  BEFORE INSERT OR UPDATE OF lead_id, assigned_consultant_id
  ON public.negocios
  FOR EACH ROW
  EXECUTE FUNCTION public.negocios_default_consultant();


-- ── 2. Link deals to negocios via accepted proposals ───────────────────────
-- When a proposal is accepted (its deal_id is populated), copy the
-- proposal's negocio_id back to the deal so the funnel can classify it.
CREATE OR REPLACE FUNCTION public.proposal_link_deal_to_negocio()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.deal_id IS NOT NULL
     AND (OLD.deal_id IS NULL OR OLD.deal_id <> NEW.deal_id) THEN
    UPDATE public.deals
    SET negocio_id = NEW.negocio_id
    WHERE id = NEW.deal_id
      AND negocio_id IS NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_proposal_link_deal ON public.negocio_proposals;
CREATE TRIGGER trg_proposal_link_deal
  AFTER INSERT OR UPDATE OF deal_id
  ON public.negocio_proposals
  FOR EACH ROW
  EXECUTE FUNCTION public.proposal_link_deal_to_negocio();

-- One-shot backfill from existing proposals that already have deal_id set
UPDATE public.deals d
SET negocio_id = p.negocio_id
FROM public.negocio_proposals p
WHERE p.deal_id = d.id
  AND d.negocio_id IS NULL
  AND p.negocio_id IS NOT NULL;


-- ── 3. Real CPCV / Escritura timestamps on deals ───────────────────────────
ALTER TABLE public.deals
  ADD COLUMN IF NOT EXISTS cpcv_signed_at      timestamptz,
  ADD COLUMN IF NOT EXISTS escritura_signed_at timestamptz;

COMMENT ON COLUMN public.deals.cpcv_signed_at IS
  'Quando o CPCV foi efectivamente assinado. Preencher pelo gestor processual quando o documento é registado. Usado pelo funil de Objetivos como evento real, em vez do proxy (cpcv_pct>0).';
COMMENT ON COLUMN public.deals.escritura_signed_at IS
  'Quando a escritura foi efectivamente realizada. Usado pelo funil de Objetivos como evento real, em vez do proxy (deal_date<=hoje).';


-- ── 4. Refresh funnel_events view to prefer real timestamps ────────────────
CREATE OR REPLACE VIEW public.funnel_events AS
-- ===== BUYER FUNNEL =====
SELECT
  ('neg-' || n.id::text) AS event_id,
  'system'::text AS source,
  n.assigned_consultant_id AS consultant_id,
  'buyer'::text AS funnel_type,
  'contactos'::text AS stage_key,
  n.created_at AS occurred_at,
  n.id AS ref_id,
  'negocio'::text AS ref_type
FROM public.negocios n
WHERE n.assigned_consultant_id IS NOT NULL
  AND n.created_at IS NOT NULL
  AND n.tipo IN ('Compra','Compra e Venda','Arrendatário')

UNION ALL
SELECT ('np-' || np.id::text), 'system', n.assigned_consultant_id, 'buyer', 'pesquisa',
  np.sent_at, np.id, 'negocio_property'
FROM public.negocio_properties np
JOIN public.negocios n ON n.id = np.negocio_id
WHERE np.sent_at IS NOT NULL AND n.assigned_consultant_id IS NOT NULL

UNION ALL
SELECT ('v-buyer-' || v.id::text), 'system', v.consultant_id, 'buyer', 'visita',
  ((v.visit_date::timestamp + v.visit_time::time) AT TIME ZONE 'Europe/Lisbon'),
  v.id, 'visit'
FROM public.visits v
WHERE v.consultant_id IS NOT NULL AND v.status <> 'cancelled'

UNION ALL
SELECT ('prop-buyer-' || p.id::text), 'system', n.assigned_consultant_id, 'buyer', 'proposta',
  p.created_at, p.id, 'negocio_proposal'
FROM public.negocio_proposals p
JOIN public.negocios n ON n.id = p.negocio_id
WHERE n.assigned_consultant_id IS NOT NULL
  AND n.tipo IN ('Compra','Compra e Venda','Arrendatário')

UNION ALL
-- CPCV (buyer): prefer real timestamp; fall back to proxy
SELECT ('deal-cpcv-buyer-' || d.id::text), 'system', d.consultant_id, 'buyer', 'cpcv',
  COALESCE(
    d.cpcv_signed_at,
    d.contract_signing_date::timestamptz,
    d.created_at
  ),
  d.id, 'deal'
FROM public.deals d
WHERE d.consultant_id IS NOT NULL
  AND d.deal_type IN ('pleno','pleno_agencia')
  AND (
    d.cpcv_signed_at IS NOT NULL
    OR (d.cpcv_pct IS NOT NULL AND d.cpcv_pct > 0)
    OR d.contract_signing_date IS NOT NULL
  )

UNION ALL
-- Escritura (buyer): prefer real timestamp; fall back to deal_date<=today
SELECT ('deal-esc-buyer-' || d.id::text), 'system', d.consultant_id, 'buyer', 'escritura',
  COALESCE(d.escritura_signed_at, d.deal_date::timestamptz),
  d.id, 'deal'
FROM public.deals d
WHERE d.consultant_id IS NOT NULL
  AND d.deal_type IN ('pleno','pleno_agencia')
  AND (
    d.escritura_signed_at IS NOT NULL
    OR d.deal_date <= CURRENT_DATE
  )

-- ===== SELLER FUNNEL =====

UNION ALL
SELECT ('neg-seller-' || n.id::text), 'system', n.assigned_consultant_id, 'seller', 'contactos',
  n.created_at, n.id, 'negocio'
FROM public.negocios n
WHERE n.assigned_consultant_id IS NOT NULL
  AND n.created_at IS NOT NULL
  AND n.tipo IN ('Venda','Compra e Venda','Arrendador')

UNION ALL
SELECT ('proc-pre-' || pi.id::text), 'system', COALESCE(n.assigned_consultant_id, dp.consultant_id),
  'seller', 'pre_angariacao', pi.started_at, pi.id, 'proc_instance'
FROM public.proc_instances pi
LEFT JOIN public.negocios n ON n.id = pi.negocio_id
LEFT JOIN public.dev_properties dp ON dp.id = pi.property_id
WHERE pi.process_type = 'angariacao' AND pi.tpl_process_id IS NULL
  AND pi.started_at IS NOT NULL
  AND TRIM(COALESCE(pi.current_status, '')) NOT IN ('deleted')
  AND COALESCE(n.assigned_consultant_id, dp.consultant_id) IS NOT NULL

UNION ALL
SELECT ('study-' || ms.id::text), 'system', n.assigned_consultant_id, 'seller', 'estudo_mercado',
  ms.created_at, ms.id, 'market_study'
FROM public.negocio_market_studies ms
JOIN public.negocios n ON n.id = ms.negocio_id
WHERE n.assigned_consultant_id IS NOT NULL

UNION ALL
SELECT ('proc-ang-' || pi.id::text), 'system', COALESCE(n.assigned_consultant_id, dp.consultant_id),
  'seller', 'angariacao', pi.approved_at, pi.id, 'proc_instance'
FROM public.proc_instances pi
LEFT JOIN public.negocios n ON n.id = pi.negocio_id
LEFT JOIN public.dev_properties dp ON dp.id = pi.property_id
WHERE pi.process_type = 'angariacao' AND pi.approved_at IS NOT NULL
  AND TRIM(COALESCE(pi.current_status, '')) NOT IN ('deleted')
  AND COALESCE(n.assigned_consultant_id, dp.consultant_id) IS NOT NULL

UNION ALL
SELECT ('v-seller-' || v.id::text), 'system', v.seller_consultant_id, 'seller', 'visita',
  ((v.visit_date::timestamp + v.visit_time::time) AT TIME ZONE 'Europe/Lisbon'),
  v.id, 'visit'
FROM public.visits v
WHERE v.seller_consultant_id IS NOT NULL AND v.status <> 'cancelled'

UNION ALL
SELECT ('prop-seller-' || p.id::text), 'system', n.assigned_consultant_id, 'seller', 'proposta',
  p.created_at, p.id, 'negocio_proposal'
FROM public.negocio_proposals p
JOIN public.negocios n ON n.id = p.negocio_id
WHERE n.assigned_consultant_id IS NOT NULL
  AND n.tipo IN ('Venda','Compra e Venda','Arrendador')

UNION ALL
-- CPCV (seller): prefer real timestamp; fall back to proxy
SELECT ('deal-cpcv-seller-' || d.id::text), 'system', d.consultant_id, 'seller', 'cpcv',
  COALESCE(
    d.cpcv_signed_at,
    d.contract_signing_date::timestamptz,
    d.created_at
  ),
  d.id, 'deal'
FROM public.deals d
WHERE d.consultant_id IS NOT NULL
  AND d.deal_type IN ('venda','pleno','pleno_agencia')
  AND (
    d.cpcv_signed_at IS NOT NULL
    OR (d.cpcv_pct IS NOT NULL AND d.cpcv_pct > 0)
    OR d.contract_signing_date IS NOT NULL
  )

UNION ALL
-- Escritura (seller)
SELECT ('deal-esc-seller-' || d.id::text), 'system', d.consultant_id, 'seller', 'escritura',
  COALESCE(d.escritura_signed_at, d.deal_date::timestamptz),
  d.id, 'deal'
FROM public.deals d
WHERE d.consultant_id IS NOT NULL
  AND d.deal_type IN ('venda','pleno','pleno_agencia')
  AND (
    d.escritura_signed_at IS NOT NULL
    OR d.deal_date <= CURRENT_DATE
  )

-- ===== MANUAL =====
UNION ALL
SELECT ('manual-' || fme.id::text), 'manual', fme.consultant_id, fme.funnel_type,
  fme.stage_key, fme.occurred_at, fme.id, 'manual'
FROM public.funnel_manual_events fme;
