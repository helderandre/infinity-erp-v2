-- ============================================================================
-- Moloni integration (faturação)
--
-- Connects the ERP to the Moloni v1 API so the agency commission invoices on
-- `deal_payments` can be emitted as real fiscal documents (reported to the AT).
--
-- Adds:
--   1. moloni_tokens           — single-row OAuth token store (password grant +
--                                auto-refresh). Service-role only.
--   2. moloni_idempotency_keys — guards every fiscal-document call so a retry /
--                                double-click never emits twice. Service-role only.
--   3. moloni_* columns on deal_payments — link a payment's agency invoice back
--      to its Moloni document (draft 0 / closed 1), customer, and PDF.
--
-- RLS is ENABLED with NO policies on both new tables: only the service-role
-- client (server-side `lib/moloni/*`) ever touches them — anon/authenticated
-- get zero access. The existing advisor flags RLS-disabled as critical, so
-- enabling (even policy-less) keeps tokens fully locked down.
--
-- ADITIVA. Revert at the bottom.
-- ============================================================================

-- ──────────────────────────────────────────────────────────────────
-- 1. moloni_tokens
-- ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.moloni_tokens (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id    integer NOT NULL UNIQUE,
  access_token  text NOT NULL,
  refresh_token text NOT NULL,
  expires_at    timestamptz NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.moloni_tokens ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.moloni_tokens IS
  'Moloni OAuth tokens (one row per company). Service-role only — RLS enabled with no policies.';

-- ──────────────────────────────────────────────────────────────────
-- 2. moloni_idempotency_keys
-- ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.moloni_idempotency_keys (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key         text NOT NULL UNIQUE,
  op          text NOT NULL,
  input_hash  text NOT NULL,
  status      text NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending', 'completed', 'failed')),
  result      jsonb,
  error       text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.moloni_idempotency_keys ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.moloni_idempotency_keys IS
  'Idempotency log for Moloni fiscal-document operations. Service-role only.';

-- ──────────────────────────────────────────────────────────────────
-- 3. deal_payments — Moloni linkage columns (additive, nullable)
-- ──────────────────────────────────────────────────────────────────
ALTER TABLE public.deal_payments
  ADD COLUMN IF NOT EXISTS moloni_document_id   integer,
  ADD COLUMN IF NOT EXISTS moloni_document_type text,        -- 'invoice'
  ADD COLUMN IF NOT EXISTS moloni_status        integer,     -- 0=draft, 1=closed/AT, 2=cancelled
  ADD COLUMN IF NOT EXISTS moloni_customer_id   integer,
  ADD COLUMN IF NOT EXISTS moloni_pdf_url       text,
  ADD COLUMN IF NOT EXISTS moloni_synced_at     timestamptz,
  ADD COLUMN IF NOT EXISTS moloni_error         text;

COMMENT ON COLUMN public.deal_payments.moloni_document_id IS
  'Moloni document_id of the agency invoice for this payment (draft or closed).';
COMMENT ON COLUMN public.deal_payments.moloni_status IS
  'Moloni document status: 0=draft (deletable), 1=closed (reported to AT, irreversible), 2=cancelled.';

-- Partial index to find unfinalized drafts quickly.
CREATE INDEX IF NOT EXISTS idx_deal_payments_moloni_open
  ON public.deal_payments (moloni_status)
  WHERE moloni_document_id IS NOT NULL AND moloni_status = 0;

-- ============================================================================
-- REVERT
-- ============================================================================
-- DROP INDEX IF EXISTS public.idx_deal_payments_moloni_open;
-- ALTER TABLE public.deal_payments
--   DROP COLUMN IF EXISTS moloni_document_id,
--   DROP COLUMN IF EXISTS moloni_document_type,
--   DROP COLUMN IF EXISTS moloni_status,
--   DROP COLUMN IF EXISTS moloni_customer_id,
--   DROP COLUMN IF EXISTS moloni_pdf_url,
--   DROP COLUMN IF EXISTS moloni_synced_at,
--   DROP COLUMN IF EXISTS moloni_error;
-- DROP TABLE IF EXISTS public.moloni_idempotency_keys;
-- DROP TABLE IF EXISTS public.moloni_tokens;
