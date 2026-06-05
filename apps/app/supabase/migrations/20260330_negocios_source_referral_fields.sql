-- =============================================================================
-- Migration: Add source/lead origin + referral fields to negocios
-- Also link temp_deals to negocios via negocio_id
-- =============================================================================

-- 1. Source/origin fields (where this business opportunity came from)
ALTER TABLE negocios ADD COLUMN IF NOT EXISTS origem text;
ALTER TABLE negocios ADD COLUMN IF NOT EXISTS origem_detalhe text;
ALTER TABLE negocios ADD COLUMN IF NOT EXISTS origem_mensagem text;

-- 2. Referral fields
ALTER TABLE negocios ADD COLUMN IF NOT EXISTS has_referral boolean DEFAULT false;
ALTER TABLE negocios ADD COLUMN IF NOT EXISTS referral_pct numeric;
ALTER TABLE negocios ADD COLUMN IF NOT EXISTS referral_type text; -- 'interna' | 'externa'
ALTER TABLE negocios ADD COLUMN IF NOT EXISTS referral_side text; -- 'angariacao' | 'comprador'
ALTER TABLE negocios ADD COLUMN IF NOT EXISTS referral_info text; -- free text notes

-- Referral recipient: internal consultant OR external person
ALTER TABLE negocios ADD COLUMN IF NOT EXISTS referral_consultant_id uuid REFERENCES dev_users(id);
ALTER TABLE negocios ADD COLUMN IF NOT EXISTS referral_external_name text;
ALTER TABLE negocios ADD COLUMN IF NOT EXISTS referral_external_phone text;
ALTER TABLE negocios ADD COLUMN IF NOT EXISTS referral_external_email text;
ALTER TABLE negocios ADD COLUMN IF NOT EXISTS referral_external_agency text;

-- 3. Link deals to negocios
ALTER TABLE deals ADD COLUMN IF NOT EXISTS negocio_id uuid REFERENCES negocios(id);

-- 4. Referral fields on leads_entries (captured at intake, copied to negócio on creation)
ALTER TABLE leads_entries ADD COLUMN IF NOT EXISTS has_referral boolean DEFAULT false;
ALTER TABLE leads_entries ADD COLUMN IF NOT EXISTS referral_consultant_id uuid REFERENCES dev_users(id);
ALTER TABLE leads_entries ADD COLUMN IF NOT EXISTS referral_external_name text;
ALTER TABLE leads_entries ADD COLUMN IF NOT EXISTS referral_external_phone text;
ALTER TABLE leads_entries ADD COLUMN IF NOT EXISTS referral_external_email text;
ALTER TABLE leads_entries ADD COLUMN IF NOT EXISTS referral_external_agency text;
ALTER TABLE leads_entries ADD COLUMN IF NOT EXISTS referral_pct numeric;
