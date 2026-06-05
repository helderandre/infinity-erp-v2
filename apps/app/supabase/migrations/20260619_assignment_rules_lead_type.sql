-- ============================================================================
-- Lead type defaults on assignment rules (Meta campaign/ad attribution)
--
-- A campanha/anúncio Meta pode declarar o tipo de lead que gera:
--   lead_business_type — Venda | Arrendamento | Trespasse
--   lead_sector        — perspectiva: real_estate_buy (Comprador) | _sell (Vendedor)
--                        | _rent (Arrendatário) | _landlord (Senhorio)
-- No ingest, estes são carimbados em leads_entries.business_type / .sector, e a
-- QualifyEntryDialog pré-preenche a qualificação (com opção de alterar).
-- Aditiva, nullable. Revert no fim.
-- ============================================================================

ALTER TABLE leads_assignment_rules
  ADD COLUMN IF NOT EXISTS lead_sector        TEXT,
  ADD COLUMN IF NOT EXISTS lead_business_type TEXT;

ALTER TABLE leads_assignment_rules
  DROP CONSTRAINT IF EXISTS leads_assignment_rules_lead_sector_chk;
ALTER TABLE leads_assignment_rules
  ADD CONSTRAINT leads_assignment_rules_lead_sector_chk
  CHECK (lead_sector IS NULL OR lead_sector IN (
    'real_estate_buy', 'real_estate_sell', 'real_estate_rent', 'real_estate_landlord'
  ));

ALTER TABLE leads_assignment_rules
  DROP CONSTRAINT IF EXISTS leads_assignment_rules_lead_business_type_chk;
ALTER TABLE leads_assignment_rules
  ADD CONSTRAINT leads_assignment_rules_lead_business_type_chk
  CHECK (lead_business_type IS NULL OR lead_business_type IN (
    'Venda', 'Arrendamento', 'Trespasse'
  ));

-- ============================================================================
-- REVERT
-- ALTER TABLE leads_assignment_rules
--   DROP CONSTRAINT IF EXISTS leads_assignment_rules_lead_business_type_chk,
--   DROP CONSTRAINT IF EXISTS leads_assignment_rules_lead_sector_chk,
--   DROP COLUMN IF EXISTS lead_business_type,
--   DROP COLUMN IF EXISTS lead_sector;
-- ============================================================================
