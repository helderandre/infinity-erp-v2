-- ============================================================================
-- Meta attribution + referral on assignment rules
--
-- Habilita o "layer de atribuição" das campanhas/anúncios Meta (Análise Meta):
-- gestão pina uma regra de assignment a um Meta campaign_id/ad_id e, opcionalmente,
-- declara um referral (consultor beneficiário + %) que é carimbado em cada lead
-- gerado por essa campanha/anúncio.
--
-- Contexto:
--   - leads_assignment_rules já tem ad_id_match / adset_id_match (text, Meta IDs)
--     e campaign_id_match (UUID -> leads_campaigns). Para a Análise Meta keyar
--     directamente pelos IDs Meta (sem depender de leads_campaigns), adicionamos
--     campaign_external_id_match (text = Meta campaign_id).
--   - Precedência mantém-se via priority: ad-level > adset-level > campaign-level
--     (convenção: o painel de UI atribui priority mais alto às regras de ad).
--   - O referral carimbado na regra flui: leads_entries.referral_* (já existem,
--     migration 20260330) -> negocios.referral_* (herdado em /api/crm/negocios) ->
--     Referências page + deal_referrals. Aqui só damos à regra os defaults.
--
-- NOTA sobre referral_basis: o cálculo de comissão a jusante (kanban / negocios)
-- usa hoje SÓ referral_pct (percentagem). 'agency_commission' é o comportamento
-- actual. 'sale_value' e 'fixed' ficam guardados para suporte futuro no motor de
-- comissões — carimbados mas ainda não computados a jusante.
--
-- Aditiva. Revert no fim do ficheiro.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Colunas Meta + referral em leads_assignment_rules
-- ----------------------------------------------------------------------------
ALTER TABLE leads_assignment_rules
  ADD COLUMN IF NOT EXISTS campaign_external_id_match TEXT,
  ADD COLUMN IF NOT EXISTS has_referral            BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS referral_consultant_id  UUID REFERENCES dev_users(id),
  ADD COLUMN IF NOT EXISTS referral_pct            NUMERIC,
  ADD COLUMN IF NOT EXISTS referral_basis          TEXT NOT NULL DEFAULT 'agency_commission',
  ADD COLUMN IF NOT EXISTS referral_fixed_amount   NUMERIC;

-- Basis válidas (default cobre o comportamento actual: % da comissão da agência)
ALTER TABLE leads_assignment_rules
  DROP CONSTRAINT IF EXISTS leads_assignment_rules_referral_basis_chk;
ALTER TABLE leads_assignment_rules
  ADD CONSTRAINT leads_assignment_rules_referral_basis_chk
  CHECK (referral_basis IN ('agency_commission', 'sale_value', 'fixed'));

-- referral_pct entre 0 e 100 quando presente
ALTER TABLE leads_assignment_rules
  DROP CONSTRAINT IF EXISTS leads_assignment_rules_referral_pct_chk;
ALTER TABLE leads_assignment_rules
  ADD CONSTRAINT leads_assignment_rules_referral_pct_chk
  CHECK (referral_pct IS NULL OR (referral_pct >= 0 AND referral_pct <= 100));

CREATE INDEX IF NOT EXISTS idx_leads_assignment_rules_campaign_external_id
  ON leads_assignment_rules(campaign_external_id_match)
  WHERE campaign_external_id_match IS NOT NULL;

COMMENT ON COLUMN leads_assignment_rules.campaign_external_id_match IS
  'Meta campaign_id (text). Matched contra form_data.meta_campaign_id do lead. Campaign-level attribution sem depender de leads_campaigns.';
COMMENT ON COLUMN leads_assignment_rules.referral_consultant_id IS
  'Consultor beneficiário do referral (interno). Carimbado em leads_entries.referral_consultant_id no ingest.';
COMMENT ON COLUMN leads_assignment_rules.referral_basis IS
  'Base da comissão: agency_commission (default, % da comissão) | sale_value | fixed. Só agency_commission é computado a jusante por agora.';

-- ----------------------------------------------------------------------------
-- 2. Índice de idempotência para o bridge Mube -> ingestLead
--    O bridge salta o ingest se já existir um leads_entries com este leadgen_id
--    (guardado em form_data.leadgen_id). Sem isto, re-entregas do webhook Mube
--    criariam entries duplicados.
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_leads_entries_leadgen_id
  ON leads_entries((form_data->>'leadgen_id'))
  WHERE form_data->>'leadgen_id' IS NOT NULL;

-- ============================================================================
-- REVERT
-- ----------------------------------------------------------------------------
-- DROP INDEX IF EXISTS idx_leads_entries_leadgen_id;
-- DROP INDEX IF EXISTS idx_leads_assignment_rules_campaign_external_id;
-- ALTER TABLE leads_assignment_rules
--   DROP CONSTRAINT IF EXISTS leads_assignment_rules_referral_pct_chk,
--   DROP CONSTRAINT IF EXISTS leads_assignment_rules_referral_basis_chk,
--   DROP COLUMN IF EXISTS referral_fixed_amount,
--   DROP COLUMN IF EXISTS referral_basis,
--   DROP COLUMN IF EXISTS referral_pct,
--   DROP COLUMN IF EXISTS referral_consultant_id,
--   DROP COLUMN IF EXISTS has_referral,
--   DROP COLUMN IF EXISTS campaign_external_id_match;
-- ============================================================================
