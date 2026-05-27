-- ============================================================================
-- Ensure the Meta-targeting + property columns exist on leads_assignment_rules
--
-- Fixes: "Could not find the 'ad_id_match' column of 'leads_assignment_rules'
-- in the schema cache" — the original 20260515 migration that introduced these
-- columns may not have been applied in every environment. All ADD ... IF NOT
-- EXISTS, so this is safe to run regardless of prior state, and it forces a
-- PostgREST schema-cache reload at the end.
-- ============================================================================

ALTER TABLE leads_assignment_rules
  ADD COLUMN IF NOT EXISTS ad_id_match               TEXT,
  ADD COLUMN IF NOT EXISTS adset_id_match            TEXT,
  ADD COLUMN IF NOT EXISTS campaign_external_id_match TEXT,
  ADD COLUMN IF NOT EXISTS property_external_ref     TEXT,
  ADD COLUMN IF NOT EXISTS property_id               UUID;

CREATE INDEX IF NOT EXISTS idx_leads_assignment_rules_ad_id
  ON leads_assignment_rules(ad_id_match) WHERE ad_id_match IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_leads_assignment_rules_adset_id
  ON leads_assignment_rules(adset_id_match) WHERE adset_id_match IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_leads_assignment_rules_campaign_external_id
  ON leads_assignment_rules(campaign_external_id_match) WHERE campaign_external_id_match IS NOT NULL;

-- Refresh PostgREST's cached schema so the new columns are queryable immediately.
NOTIFY pgrst, 'reload schema';
