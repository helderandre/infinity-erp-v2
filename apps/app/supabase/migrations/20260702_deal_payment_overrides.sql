-- ════════════════════════════════════════════════════════════════════════════
-- 20260702_deal_payment_overrides.sql
--
-- Padrão "calcular por defeito, editar como um Excel" para o financeiro.
-- Ver spec portável: /overridable-computed-values-portable-spec.md
--
-- Aditiva. Os valores calculados em deal_payments / deal_payment_splits passam a
-- ter colunas *_override (NULL = usar automático). O builder canónico
-- (lib/financial/build-mapa-rows.ts) faz `override ?? automático`, pelo que o
-- override propaga a TODAS as superfícies que partilham o builder: mapa de gestão
-- (grelha + sheet), fecho "pagar às partes", tabs imóvel/negócio, e a derivação da
-- fatura Moloni.
--
-- REVERT:
--   ALTER TABLE public.deal_payments
--     DROP COLUMN IF EXISTS amount_override, DROP COLUMN IF EXISTS network_amount_override,
--     DROP COLUMN IF EXISTS agency_amount_override, DROP COLUMN IF EXISTS partner_amount_override,
--     DROP COLUMN IF EXISTS amounts_locked, DROP COLUMN IF EXISTS override_reason,
--     DROP COLUMN IF EXISTS override_by, DROP COLUMN IF EXISTS override_at;
--   ALTER TABLE public.deal_payment_splits
--     DROP COLUMN IF EXISTS amount_override, DROP COLUMN IF EXISTS split_pct_override,
--     DROP COLUMN IF EXISTS is_manual, DROP COLUMN IF EXISTS is_deleted,
--     DROP COLUMN IF EXISTS manual_label, DROP COLUMN IF EXISTS override_reason,
--     DROP COLUMN IF EXISTS override_by, DROP COLUMN IF EXISTS override_at;
--   ALTER TABLE public.deal_payment_splits ALTER COLUMN agent_id SET NOT NULL; -- só se não houver linhas manuais
--   DROP TABLE IF EXISTS public.deal_payment_overrides;
-- ════════════════════════════════════════════════════════════════════════════

-- ── deal_payments: override por campo monetário + lock + auditoria ──────────
ALTER TABLE public.deal_payments
  ADD COLUMN IF NOT EXISTS amount_override         numeric,
  ADD COLUMN IF NOT EXISTS network_amount_override numeric,
  ADD COLUMN IF NOT EXISTS agency_amount_override  numeric,
  ADD COLUMN IF NOT EXISTS partner_amount_override numeric,
  ADD COLUMN IF NOT EXISTS amounts_locked          boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS override_reason         text,
  ADD COLUMN IF NOT EXISTS override_by             uuid,
  ADD COLUMN IF NOT EXISTS override_at             timestamptz;

COMMENT ON COLUMN public.deal_payments.amount_override         IS 'Override manual do total do momento (NULL = automático).';
COMMENT ON COLUMN public.deal_payments.agency_amount_override  IS 'Override manual da margem da agência (NULL = automático).';
COMMENT ON COLUMN public.deal_payments.amounts_locked          IS 'true = tem edição manual; o recálculo automático salta esta linha.';

-- ── deal_payment_splits: override + criação manual + soft-delete ────────────
ALTER TABLE public.deal_payment_splits
  ADD COLUMN IF NOT EXISTS amount_override    numeric,
  ADD COLUMN IF NOT EXISTS split_pct_override numeric,
  ADD COLUMN IF NOT EXISTS is_manual          boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_deleted         boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS manual_label       text,
  ADD COLUMN IF NOT EXISTS override_reason    text,
  ADD COLUMN IF NOT EXISTS override_by        uuid,
  ADD COLUMN IF NOT EXISTS override_at        timestamptz;

-- Permite criar uma parte manual sem agente real (interveniente externo via manual_label).
ALTER TABLE public.deal_payment_splits ALTER COLUMN agent_id DROP NOT NULL;

COMMENT ON COLUMN public.deal_payment_splits.amount_override IS 'Override manual do valor desta parte (NULL = automático).';
COMMENT ON COLUMN public.deal_payment_splits.is_manual       IS 'Linha criada à mão; o recálculo automático preserva-a.';
COMMENT ON COLUMN public.deal_payment_splits.is_deleted      IS 'Soft-delete; o builder ignora-a mas o histórico mantém-se.';
COMMENT ON COLUMN public.deal_payment_splits.manual_label    IS 'Nome do interveniente quando agent_id é NULL (parte externa).';

-- ── Log append-only de overrides (service-role only: RLS ON, sem policies) ──
CREATE TABLE IF NOT EXISTS public.deal_payment_overrides (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id    uuid,
  payment_id uuid,
  split_id   uuid,
  entity     text NOT NULL,   -- 'payment' | 'split'
  action     text NOT NULL,   -- 'edit'|'create'|'delete'|'restore'|'clear'|'lock'|'recompute'
  field      text,
  old_value  jsonb,
  new_value  jsonb,
  reason     text,
  actor_id   uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_deal_payment_overrides_deal    ON public.deal_payment_overrides(deal_id);
CREATE INDEX IF NOT EXISTS idx_deal_payment_overrides_payment ON public.deal_payment_overrides(payment_id);

ALTER TABLE public.deal_payment_overrides ENABLE ROW LEVEL SECURITY;
