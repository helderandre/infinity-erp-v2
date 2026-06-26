-- Fecho de Negócio (PROC-NEG rebuild) — persist client KYC + partner-agency NIF
--
-- Part of openspec/changes/rebuild-fecho-process (design.md §5).
-- Additive + idempotent. NO backfill (0 live PROC-NEG instances — memory `proc-neg-greenfield`).
--
-- Why:
--   - `deals.partner_agency_nif` — recipient NIF for the Moloni fatura emitted to the
--     partner agency in `deal_type='angariacao_externa'` (the only scenario where we
--     invoice a colega instead of the proprietário). See deriveFaturaTarget.
--   - `deal_clients.{nif,is_main_contact,kyc}` — today PUT /api/deals/[id] persists only
--     person_type/name/email/phone and DROPS the rich KYC the DealForm step-2 collects
--     (nationality, marital_status, id_doc_*, is_pep, funds_origin[], beneficiaries[],
--     company fields, …). The per-buyer compliance doc steps + faturação recipient need it.
--     `nif`/`is_main_contact` are promoted to scalar columns for easy querying; the full
--     rich object lives in `kyc jsonb`.
--
-- REVERT:
--   ALTER TABLE public.deals DROP COLUMN IF EXISTS partner_agency_nif;
--   ALTER TABLE public.deal_clients
--     DROP COLUMN IF EXISTS nif,
--     DROP COLUMN IF EXISTS is_main_contact,
--     DROP COLUMN IF EXISTS kyc;

ALTER TABLE public.deals
  ADD COLUMN IF NOT EXISTS partner_agency_nif text;

ALTER TABLE public.deal_clients
  ADD COLUMN IF NOT EXISTS nif text,
  ADD COLUMN IF NOT EXISTS is_main_contact boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS kyc jsonb;

COMMENT ON COLUMN public.deals.partner_agency_nif IS
  'NIF da agência parceira (angariacao_externa) — destinatário da fatura Moloni da nossa parte.';
COMMENT ON COLUMN public.deal_clients.nif IS
  'NIF do cliente (comprador) — usado para faturação e KYC.';
COMMENT ON COLUMN public.deal_clients.is_main_contact IS
  'Contacto principal do negócio (1 por deal). Default false.';
COMMENT ON COLUMN public.deal_clients.kyc IS
  'Objecto KYC completo do cliente recolhido no DealForm step 2 (nationality, naturality, '
  'marital_status, address, id_doc_*, is_pep, pep_position, funds_origin[], profession, '
  'company_object/legal_nature/cae_code/rcbe_code, beneficiaries[], etc.).';
