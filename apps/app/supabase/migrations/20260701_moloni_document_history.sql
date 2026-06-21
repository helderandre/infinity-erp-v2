-- ============================================================================
-- Moloni document history (ledger) + re-emission support
--
-- Enables the correction cycle on a single deal_payment: fatura → nota de
-- crédito → NOVA fatura → … repeatable, without losing history.
--
--   • deal_payment_moloni_documents — append-only ledger: one row per Moloni
--     fiscal document ever emitted for a payment (invoice / creditnote /
--     receipt), with number, status, amounts, PDF and the link to the invoice
--     it targets. The deal_payments.moloni_* columns keep pointing at the
--     CURRENT active document (for the existing UI); this table is the full
--     audit trail.
--   • deal_payments.moloni_reissue_count — bumped on each re-emission so the
--     our_reference is unique per cycle (otherwise the finalize dedupe guard
--     would adopt the previous, already-credited invoice).
--
-- RLS enabled with NO policies → service-role only (accessed via admin client
-- behind requirePermission('financial')), like moloni_tokens.
-- ADITIVA. Revert at the bottom.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.deal_payment_moloni_documents (
  id                         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_payment_id            uuid NOT NULL REFERENCES public.deal_payments(id) ON DELETE CASCADE,
  kind                       text NOT NULL CHECK (kind IN ('invoice', 'creditnote', 'receipt')),
  moloni_document_id         integer NOT NULL,
  moloni_status              integer,            -- 0 draft, 1 closed/AT, 2 cancelled/credited
  number                     text,
  recipient                  text,
  recipient_nif              text,
  amount_net                 numeric,
  amount_gross               numeric,
  pdf_r2_url                 text,
  pdf_r2_path                text,
  related_moloni_document_id integer,            -- creditnote/receipt → the invoice it targets
  reissue_seq                integer NOT NULL DEFAULT 0,
  is_current                 boolean NOT NULL DEFAULT true,
  notes                      text,
  created_by                 uuid,
  created_at                 timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dpmd_payment
  ON public.deal_payment_moloni_documents (deal_payment_id, created_at DESC);

ALTER TABLE public.deal_payment_moloni_documents ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.deal_payment_moloni_documents IS
  'Append-only ledger of every Moloni fiscal document (invoice/creditnote/receipt) per deal_payment. Service-role only.';

ALTER TABLE public.deal_payments
  ADD COLUMN IF NOT EXISTS moloni_reissue_count integer NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.deal_payments.moloni_reissue_count IS
  'Number of times the agency invoice was re-emitted (after credit note/cancel). Drives the unique our_reference per cycle.';

-- ============================================================================
-- REVERT
-- ============================================================================
-- ALTER TABLE public.deal_payments DROP COLUMN IF EXISTS moloni_reissue_count;
-- DROP TABLE IF EXISTS public.deal_payment_moloni_documents;
