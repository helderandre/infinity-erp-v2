-- ============================================================================
-- 20260513_funnel_events_and_targets.sql
--
-- Adds the data spine for the new "Objetivos" two-funnel view (compradores +
-- vendedores) without touching existing tables.
--
--   1. funnel_manual_events  — manually-registered events (when the system
--                              didn't catch a stage transition).
--   2. funnel_target_overrides — per-stage manual overrides on top of the
--                                annual goal in temp_consultant_goals.
--   3. funnel_events (view)  — UNION ALL of all 13 stage detections (6 buyer
--                              + 7 seller) plus manual events. Single read
--                              source for the API.
--
-- Stage keys (must stay stable — referenced from app code & registry):
--
--   Buyer (funnel_type='buyer'):
--     contactos      — new buyer-tipo negocio created
--     pesquisa       — at least one property sent on the dossier
--     visita         — visit booked / completed (consultant_id side)
--     proposta       — proposal created on a buyer-tipo negocio
--     cpcv           — deal in active/submitted with cpcv_pct>0 OR contract_signing_date set
--     escritura      — deal with deal_date in the past (signed)
--
--   Seller (funnel_type='seller'):
--     contactos       — new seller-tipo negocio created
--     pre_angariacao  — proc_instances angariacao with tpl_process_id IS NULL
--     estudo_mercado  — negocio_market_studies row created
--     angariacao      — proc_instances angariacao approved (approved_at IS NOT NULL)
--     visita          — visit on seller_consultant_id side
--     proposta        — proposal on seller-tipo negocio
--     cpcv / escritura — same proxies as buyer (deal_type ∈ {venda,pleno,pleno_agencia})
--
-- Buyer/seller classification of negocios:
--   buyer  ⇔ tipo IN ('Compra', 'Compra e Venda', 'Arrendatário')
--   seller ⇔ tipo IN ('Venda', 'Compra e Venda', 'Arrendador')
--   Note: 'Compra e Venda' counts on BOTH funnels (consultant represents both
--   sides of the same opportunity).
--
-- Deal classification:
--   deal_type='venda'         → seller funnel only
--   deal_type='pleno' / 'pleno_agencia' → both funnels (one event each)
--
-- Revert:
--   DROP VIEW IF EXISTS public.funnel_events;
--   DROP TABLE IF EXISTS public.funnel_target_overrides;
--   DROP TABLE IF EXISTS public.funnel_manual_events;
-- ============================================================================

-- ── 1. Manual events table ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.funnel_manual_events (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  consultant_id   uuid NOT NULL REFERENCES public.dev_users(id) ON DELETE CASCADE,
  funnel_type     text NOT NULL CHECK (funnel_type IN ('buyer','seller')),
  stage_key       text NOT NULL CHECK (stage_key IN (
    'contactos','pesquisa','visita','proposta','cpcv','escritura',
    'pre_angariacao','estudo_mercado','angariacao'
  )),
  occurred_at     timestamptz NOT NULL,
  notes           text,
  -- Optional links to provide context without enforcing FK to mixed entity types
  ref_lead_id     uuid,
  ref_negocio_id  uuid,
  ref_property_id uuid,
  created_by      uuid REFERENCES public.dev_users(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_funnel_manual_events_lookup
  ON public.funnel_manual_events (consultant_id, funnel_type, stage_key, occurred_at DESC);

ALTER TABLE public.funnel_manual_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS funnel_manual_events_read ON public.funnel_manual_events;
CREATE POLICY funnel_manual_events_read
  ON public.funnel_manual_events
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS funnel_manual_events_write ON public.funnel_manual_events;
CREATE POLICY funnel_manual_events_write
  ON public.funnel_manual_events
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

COMMENT ON TABLE public.funnel_manual_events IS
  'Eventos de funil registados manualmente quando o sistema não os detectou. Aparecem na view funnel_events com source=''manual''.';


-- ── 2. Target overrides table ──────────────────────────────────────────────
-- Per-stage overrides on top of the annual goal in temp_consultant_goals.
-- A row exists only when the gestor has explicitly fixed a stage target.
-- When absent, the API falls back to the conversion-rate cascade.
CREATE TABLE IF NOT EXISTS public.funnel_target_overrides (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  consultant_id uuid NOT NULL REFERENCES public.dev_users(id) ON DELETE CASCADE,
  year          integer NOT NULL,
  funnel_type   text NOT NULL CHECK (funnel_type IN ('buyer','seller')),
  stage_key     text NOT NULL,
  period        text NOT NULL CHECK (period IN ('daily','weekly','monthly','annual')),
  target_value  numeric NOT NULL,
  notes         text,
  created_by    uuid REFERENCES public.dev_users(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (consultant_id, year, funnel_type, stage_key, period)
);

CREATE INDEX IF NOT EXISTS idx_funnel_target_overrides_lookup
  ON public.funnel_target_overrides (consultant_id, year, funnel_type);

ALTER TABLE public.funnel_target_overrides ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS funnel_target_overrides_read ON public.funnel_target_overrides;
CREATE POLICY funnel_target_overrides_read
  ON public.funnel_target_overrides
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS funnel_target_overrides_write ON public.funnel_target_overrides;
CREATE POLICY funnel_target_overrides_write
  ON public.funnel_target_overrides
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

COMMENT ON TABLE public.funnel_target_overrides IS
  'Overrides manuais por etapa em cima do objectivo anual. Uma linha existe apenas quando o gestor fixou um valor explícito.';


-- ── 3. funnel_events view ──────────────────────────────────────────────────
-- Unifies all 13 stage detections + manual events behind one queryable surface.
-- Every consumer (API, dashboards) reads from here and never from the raw
-- tables. Adding/changing a detection rule = editing this view only.
CREATE OR REPLACE VIEW public.funnel_events AS
-- ===== BUYER FUNNEL =====

-- contactos (buyer): new buyer-tipo negocio created
SELECT
  ('neg-' || n.id::text)                    AS event_id,
  'system'::text                            AS source,
  n.assigned_consultant_id                  AS consultant_id,
  'buyer'::text                             AS funnel_type,
  'contactos'::text                         AS stage_key,
  n.created_at                              AS occurred_at,
  n.id                                      AS ref_id,
  'negocio'::text                           AS ref_type
FROM public.negocios n
WHERE n.assigned_consultant_id IS NOT NULL
  AND n.created_at IS NOT NULL
  AND n.tipo IN ('Compra','Compra e Venda','Arrendatário')

UNION ALL

-- pesquisa (buyer): property sent to client (negocio_properties.sent_at)
SELECT
  ('np-' || np.id::text),
  'system',
  n.assigned_consultant_id,
  'buyer',
  'pesquisa',
  np.sent_at,
  np.id,
  'negocio_property'
FROM public.negocio_properties np
JOIN public.negocios n ON n.id = np.negocio_id
WHERE np.sent_at IS NOT NULL
  AND n.assigned_consultant_id IS NOT NULL

UNION ALL

-- visita (buyer side): visit booked, consultant_id side
SELECT
  ('v-buyer-' || v.id::text),
  'system',
  v.consultant_id,
  'buyer',
  'visita',
  ((v.visit_date::timestamp + v.visit_time::time) AT TIME ZONE 'Europe/Lisbon'),
  v.id,
  'visit'
FROM public.visits v
WHERE v.consultant_id IS NOT NULL
  AND v.status <> 'cancelled'

UNION ALL

-- proposta (buyer): proposal on a buyer-tipo negocio
SELECT
  ('prop-buyer-' || p.id::text),
  'system',
  n.assigned_consultant_id,
  'buyer',
  'proposta',
  p.created_at,
  p.id,
  'negocio_proposal'
FROM public.negocio_proposals p
JOIN public.negocios n ON n.id = p.negocio_id
WHERE n.assigned_consultant_id IS NOT NULL
  AND n.tipo IN ('Compra','Compra e Venda','Arrendatário')

UNION ALL

-- cpcv (buyer): deal with cpcv_pct>0 OR contract_signing_date set, deal_type signals buyer side
SELECT
  ('deal-cpcv-buyer-' || d.id::text),
  'system',
  d.consultant_id,
  'buyer',
  'cpcv',
  COALESCE(d.contract_signing_date::timestamptz, d.created_at),
  d.id,
  'deal'
FROM public.deals d
WHERE d.consultant_id IS NOT NULL
  AND d.deal_type IN ('pleno','pleno_agencia')
  AND (d.cpcv_pct IS NOT NULL AND d.cpcv_pct > 0 OR d.contract_signing_date IS NOT NULL)

UNION ALL

-- escritura (buyer): deal_date reached
SELECT
  ('deal-esc-buyer-' || d.id::text),
  'system',
  d.consultant_id,
  'buyer',
  'escritura',
  d.deal_date::timestamptz,
  d.id,
  'deal'
FROM public.deals d
WHERE d.consultant_id IS NOT NULL
  AND d.deal_type IN ('pleno','pleno_agencia')
  AND d.deal_date <= CURRENT_DATE

-- ===== SELLER FUNNEL =====

UNION ALL

-- contactos (seller)
SELECT
  ('neg-seller-' || n.id::text),
  'system',
  n.assigned_consultant_id,
  'seller',
  'contactos',
  n.created_at,
  n.id,
  'negocio'
FROM public.negocios n
WHERE n.assigned_consultant_id IS NOT NULL
  AND n.created_at IS NOT NULL
  AND n.tipo IN ('Venda','Compra e Venda','Arrendador')

UNION ALL

-- pre_angariacao: proc_instances angariacao with tpl_process_id IS NULL
SELECT
  ('proc-pre-' || pi.id::text),
  'system',
  COALESCE(n.assigned_consultant_id, dp.consultant_id),
  'seller',
  'pre_angariacao',
  pi.started_at,
  pi.id,
  'proc_instance'
FROM public.proc_instances pi
LEFT JOIN public.negocios n ON n.id = pi.negocio_id
LEFT JOIN public.dev_properties dp ON dp.id = pi.property_id
WHERE pi.process_type = 'angariacao'
  AND pi.tpl_process_id IS NULL
  AND pi.started_at IS NOT NULL
  AND TRIM(COALESCE(pi.current_status, '')) NOT IN ('deleted')
  AND COALESCE(n.assigned_consultant_id, dp.consultant_id) IS NOT NULL

UNION ALL

-- estudo_mercado
SELECT
  ('study-' || ms.id::text),
  'system',
  n.assigned_consultant_id,
  'seller',
  'estudo_mercado',
  ms.created_at,
  ms.id,
  'market_study'
FROM public.negocio_market_studies ms
JOIN public.negocios n ON n.id = ms.negocio_id
WHERE n.assigned_consultant_id IS NOT NULL

UNION ALL

-- angariacao approved
SELECT
  ('proc-ang-' || pi.id::text),
  'system',
  COALESCE(n.assigned_consultant_id, dp.consultant_id),
  'seller',
  'angariacao',
  pi.approved_at,
  pi.id,
  'proc_instance'
FROM public.proc_instances pi
LEFT JOIN public.negocios n ON n.id = pi.negocio_id
LEFT JOIN public.dev_properties dp ON dp.id = pi.property_id
WHERE pi.process_type = 'angariacao'
  AND pi.approved_at IS NOT NULL
  AND TRIM(COALESCE(pi.current_status, '')) NOT IN ('deleted')
  AND COALESCE(n.assigned_consultant_id, dp.consultant_id) IS NOT NULL

UNION ALL

-- visita (seller side)
SELECT
  ('v-seller-' || v.id::text),
  'system',
  v.seller_consultant_id,
  'seller',
  'visita',
  ((v.visit_date::timestamp + v.visit_time::time) AT TIME ZONE 'Europe/Lisbon'),
  v.id,
  'visit'
FROM public.visits v
WHERE v.seller_consultant_id IS NOT NULL
  AND v.status <> 'cancelled'

UNION ALL

-- proposta (seller)
SELECT
  ('prop-seller-' || p.id::text),
  'system',
  n.assigned_consultant_id,
  'seller',
  'proposta',
  p.created_at,
  p.id,
  'negocio_proposal'
FROM public.negocio_proposals p
JOIN public.negocios n ON n.id = p.negocio_id
WHERE n.assigned_consultant_id IS NOT NULL
  AND n.tipo IN ('Venda','Compra e Venda','Arrendador')

UNION ALL

-- cpcv (seller): all deal_types count
SELECT
  ('deal-cpcv-seller-' || d.id::text),
  'system',
  d.consultant_id,
  'seller',
  'cpcv',
  COALESCE(d.contract_signing_date::timestamptz, d.created_at),
  d.id,
  'deal'
FROM public.deals d
WHERE d.consultant_id IS NOT NULL
  AND d.deal_type IN ('venda','pleno','pleno_agencia')
  AND (d.cpcv_pct IS NOT NULL AND d.cpcv_pct > 0 OR d.contract_signing_date IS NOT NULL)

UNION ALL

-- escritura (seller)
SELECT
  ('deal-esc-seller-' || d.id::text),
  'system',
  d.consultant_id,
  'seller',
  'escritura',
  d.deal_date::timestamptz,
  d.id,
  'deal'
FROM public.deals d
WHERE d.consultant_id IS NOT NULL
  AND d.deal_type IN ('venda','pleno','pleno_agencia')
  AND d.deal_date <= CURRENT_DATE

-- ===== MANUAL EVENTS =====

UNION ALL

SELECT
  ('manual-' || fme.id::text),
  'manual',
  fme.consultant_id,
  fme.funnel_type,
  fme.stage_key,
  fme.occurred_at,
  fme.id,
  'manual'
FROM public.funnel_manual_events fme;

COMMENT ON VIEW public.funnel_events IS
  'Vista unificada de todos os eventos de funil (compradores + vendedores) com origem system/manual. Fonte única para a API /api/goals/funnel.';
