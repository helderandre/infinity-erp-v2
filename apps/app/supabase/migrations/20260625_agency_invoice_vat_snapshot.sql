-- ─────────────────────────────────────────────────────────────────────────────
-- Agency invoice IVA — configurable + snapshotted per invoice
-- ─────────────────────────────────────────────────────────────────────────────
-- Context: the client fatura (fatura de comissão da agência) total =
--   valor (líquido) + IVA. Until now the IVA rate was HARDCODED to 23% across the
--   Moloni flow (issue/finalize/receipt/credit-note). This:
--
--   1. Adds `deal_payments.agency_invoice_vat_pct` — the IVA rate (percentage,
--      e.g. 23) used when THIS invoice was issued. Snapshotted at issue time so
--      changing the financial-definitions IVA later applies ONLY to future
--      invoices — already-issued ones keep their own rate (and their stored
--      `agency_invoice_amount_gross`). Mirrors how commission/margin euro amounts
--      are already frozen onto `deal_payments` at deal creation.
--
--   2. Promotes the existing setting `temp_agency_settings.vat_rate_services`
--      (already = '23', stored as a percentage) to be the canonical "IVA da
--      fatura ao cliente (mediação)" knob read by the Moloni flow. We only
--      clarify its description here; the value is left untouched.
--
-- ⚠ Apply BEFORE deploy — the Moloni server actions + mapa-gestao/mapa-row GETs
--   start SELECTing `agency_invoice_vat_pct`.
--
-- Revert:
--   ALTER TABLE deal_payments DROP COLUMN IF EXISTS agency_invoice_vat_pct;
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE deal_payments
  ADD COLUMN IF NOT EXISTS agency_invoice_vat_pct numeric;

COMMENT ON COLUMN deal_payments.agency_invoice_vat_pct IS
  'IVA (%) aplicado nesta fatura de comissão da agência, snapshot no momento da emissão. NULL = ainda não emitida (usa a definição financeira corrente).';

-- Backfill: preserve the historical IVA of already-issued invoices.
-- Derive from net/gross when both are present (handles any non-23 legacy rate),
-- otherwise default to 23. Only touches rows that already have an invoice.
UPDATE deal_payments
SET agency_invoice_vat_pct = CASE
    WHEN agency_invoice_amount_net > 0 AND agency_invoice_amount_gross > 0
      THEN round((agency_invoice_amount_gross / agency_invoice_amount_net - 1) * 100, 2)
    ELSE 23
  END
WHERE agency_invoice_vat_pct IS NULL
  AND (moloni_document_id IS NOT NULL OR agency_invoice_amount_gross IS NOT NULL);

-- Clarify the canonical agency-invoice IVA setting (value unchanged).
UPDATE temp_agency_settings
SET description = 'Taxa de IVA (%) aplicada à fatura de comissão ao cliente. Aplica-se a faturas futuras — as já emitidas mantêm a taxa com que foram emitidas.'
WHERE key = 'vat_rate_services';
