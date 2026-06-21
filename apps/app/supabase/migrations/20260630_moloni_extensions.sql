-- ============================================================================
-- Moloni extensions: credit notes, receipts, email send, permanent PDF archive
--
-- Builds on 20260629_moloni_integration.sql. Additive columns on deal_payments:
--   • Credit note (nota de crédito): id + number + issued_at
--   • Receipt (recibo / marcar como pago): id + issued_at
--   • Email send: sent_at + sent_to
--   • Permanent PDF archive in R2: r2 path + r2 url (moloni_pdf_url stays the
--     ephemeral Moloni link; these are the durable copy stored on our side)
--
-- moloni_status semantics extended: 2 = credited/cancelled (reversed).
-- ADITIVA. Revert at the bottom.
-- ============================================================================

ALTER TABLE public.deal_payments
  ADD COLUMN IF NOT EXISTS moloni_creditnote_id        integer,
  ADD COLUMN IF NOT EXISTS moloni_creditnote_number    text,
  ADD COLUMN IF NOT EXISTS moloni_creditnote_issued_at timestamptz,
  ADD COLUMN IF NOT EXISTS moloni_receipt_id           integer,
  ADD COLUMN IF NOT EXISTS moloni_receipt_issued_at    timestamptz,
  ADD COLUMN IF NOT EXISTS moloni_email_sent_at        timestamptz,
  ADD COLUMN IF NOT EXISTS moloni_email_sent_to        text,
  ADD COLUMN IF NOT EXISTS moloni_pdf_r2_path          text,
  ADD COLUMN IF NOT EXISTS moloni_pdf_r2_url           text;

COMMENT ON COLUMN public.deal_payments.moloni_creditnote_id IS
  'Moloni document_id of the credit note that reverses the agency invoice (sets moloni_status=2).';
COMMENT ON COLUMN public.deal_payments.moloni_receipt_id IS
  'Moloni document_id of the receipt (Recibo) issued against the agency invoice.';
COMMENT ON COLUMN public.deal_payments.moloni_pdf_r2_url IS
  'Durable copy of the finalized invoice PDF stored in our R2 bucket (Moloni link is ephemeral).';

-- ============================================================================
-- REVERT
-- ============================================================================
-- ALTER TABLE public.deal_payments
--   DROP COLUMN IF EXISTS moloni_creditnote_id,
--   DROP COLUMN IF EXISTS moloni_creditnote_number,
--   DROP COLUMN IF EXISTS moloni_creditnote_issued_at,
--   DROP COLUMN IF EXISTS moloni_receipt_id,
--   DROP COLUMN IF EXISTS moloni_receipt_issued_at,
--   DROP COLUMN IF EXISTS moloni_email_sent_at,
--   DROP COLUMN IF EXISTS moloni_email_sent_to,
--   DROP COLUMN IF EXISTS moloni_pdf_r2_path,
--   DROP COLUMN IF EXISTS moloni_pdf_r2_url;
