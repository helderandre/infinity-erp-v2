-- =============================================================================
-- Assignment rules: Meta ad/adset targeting + property linkage on entries
-- =============================================================================
-- Lets the gestora write rules of the form
--   "leads from Meta ad X → consultor Y, propriedade Z"
-- so that an inbound lead lands as a `leads_entries` row already attribuído
-- ao consultor certo e ligado ao imóvel certo. A qualificação para `negocios`
-- continua manual (consultor decide promover quando faz sentido).
--
-- Matching specificity is encoded by `priority` (manual). Convention:
--   ad-level rules     → priority 300+
--   adset-level rules  → priority 200..299
--   campaign-level     → priority 100..199
--   source-level       → priority 0..99
--
-- Aditiva. Revert:
--   ALTER TABLE leads_assignment_rules
--     DROP COLUMN IF EXISTS ad_id_match,
--     DROP COLUMN IF EXISTS adset_id_match,
--     DROP COLUMN IF EXISTS property_id,
--     DROP COLUMN IF EXISTS property_external_ref;
--   ALTER TABLE leads_entries
--     DROP COLUMN IF EXISTS property_id,
--     DROP COLUMN IF EXISTS property_external_ref;
--   DROP INDEX IF EXISTS idx_leads_assignment_rules_ad_id;
--   DROP INDEX IF EXISTS idx_leads_assignment_rules_adset_id;
--   DROP INDEX IF EXISTS idx_leads_entries_property;
--   DROP INDEX IF EXISTS idx_leads_entries_property_ref;
-- =============================================================================

ALTER TABLE leads_assignment_rules
  ADD COLUMN IF NOT EXISTS ad_id_match           TEXT,
  ADD COLUMN IF NOT EXISTS adset_id_match        TEXT,
  ADD COLUMN IF NOT EXISTS property_id           UUID REFERENCES dev_properties(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS property_external_ref TEXT;

CREATE INDEX IF NOT EXISTS idx_leads_assignment_rules_ad_id
  ON leads_assignment_rules(ad_id_match)
  WHERE ad_id_match IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_leads_assignment_rules_adset_id
  ON leads_assignment_rules(adset_id_match)
  WHERE adset_id_match IS NOT NULL;

COMMENT ON COLUMN leads_assignment_rules.ad_id_match IS
  'Meta ad_id (exact match). Highest specificity — set priority accordingly.';
COMMENT ON COLUMN leads_assignment_rules.adset_id_match IS
  'Meta adset_id (exact match). Used when no ad-level rule matches.';
COMMENT ON COLUMN leads_assignment_rules.property_external_ref IS
  'Canonical, human-readable handle do imóvel (ex.: PROP-2024-0123). Coluna primária para display/lookup; property_id é a denormalização para FK joins. Mantidos em sincronia pela API ao gravar.';
COMMENT ON COLUMN leads_assignment_rules.property_id IS
  'FK denormalizada a partir de property_external_ref. Resolvida na API ao gravar — nunca editar isoladamente.';

ALTER TABLE leads_entries
  ADD COLUMN IF NOT EXISTS property_id           UUID REFERENCES dev_properties(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS property_external_ref TEXT;

CREATE INDEX IF NOT EXISTS idx_leads_entries_property
  ON leads_entries(property_id)
  WHERE property_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_leads_entries_property_ref
  ON leads_entries(property_external_ref)
  WHERE property_external_ref IS NOT NULL;

COMMENT ON COLUMN leads_entries.property_external_ref IS
  'Handle do imóvel associado à entrada (assignment rule, form_data, voz, bulk import). Coluna primária — promove a JSON key form_data->>property_external_ref a coluna real.';
COMMENT ON COLUMN leads_entries.property_id IS
  'FK denormalizada a partir de property_external_ref. Conveniência para joins; mantida em sincronia pela camada de ingestão.';
