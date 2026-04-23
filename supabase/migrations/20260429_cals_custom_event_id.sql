-- ==================================================================
-- MIGRATION: contact_automation_lead_settings — per-lead overrides
-- para eventos custom (commemorative)
-- ==================================================================
-- ⚠️ BROKER REVIEW REQUIRED
--
-- Extende `contact_automation_lead_settings` com:
--   * `custom_event_id` (FK CASCADE → `custom_commemorative_events.id`)
--   * `event_type` passa a aceitar valor `'custom_event'`
--   * unique (lead_id, event_type, COALESCE(custom_event_id, uuid_nil))
--   * CHECK que força event_type='custom_event' ⇔ custom_event_id IS NOT NULL
--
-- ADITIVA: rows existentes (custom_event_id = NULL) mantêm-se válidas
-- para eventos fixos (aniversario_contacto, natal, ano_novo).
--
-- NOTA sobre CONCURRENTLY: o harness Supabase aplica migrations dentro
-- de uma transacção, o que impede `CREATE INDEX CONCURRENTLY`. Com
-- a tabela a ter ~1 row em produção, o lock window é negligível.
-- Se a tabela crescer antes deste rollout, rebuild o índice manualmente
-- fora de transacção.
--
-- REVERT (pela ordem):
--   ALTER TABLE contact_automation_lead_settings
--     DROP CONSTRAINT contact_automation_lead_settings_event_kind_check;
--   DROP INDEX IF EXISTS idx_cals_lead_event_custom;
--   DROP INDEX IF EXISTS contact_automation_lead_settings_unique_idx;
--   ALTER TABLE contact_automation_lead_settings
--     ADD CONSTRAINT contact_automation_lead_settings_lead_id_event_type_key
--     UNIQUE (lead_id, event_type);
--   ALTER TABLE contact_automation_lead_settings
--     DROP COLUMN custom_event_id;
--   ALTER TABLE contact_automation_lead_settings
--     DROP CONSTRAINT contact_automation_lead_settings_event_type_check;
--   ALTER TABLE contact_automation_lead_settings
--     ADD CONSTRAINT contact_automation_lead_settings_event_type_check
--     CHECK (event_type = ANY (ARRAY['aniversario_contacto','natal','ano_novo']));
-- ==================================================================

-- 1. Expandir CHECK de event_type para incluir 'custom_event'.
ALTER TABLE contact_automation_lead_settings
  DROP CONSTRAINT IF EXISTS contact_automation_lead_settings_event_type_check;

ALTER TABLE contact_automation_lead_settings
  ADD CONSTRAINT contact_automation_lead_settings_event_type_check
  CHECK (event_type = ANY (ARRAY['aniversario_contacto','natal','ano_novo','custom_event']));

-- 2. Adicionar coluna custom_event_id com FK CASCADE.
ALTER TABLE contact_automation_lead_settings
  ADD COLUMN IF NOT EXISTS custom_event_id UUID NULL
    REFERENCES custom_commemorative_events(id) ON DELETE CASCADE;

-- 3. Forçar invariante: event_type='custom_event' ⇔ custom_event_id IS NOT NULL.
ALTER TABLE contact_automation_lead_settings
  DROP CONSTRAINT IF EXISTS contact_automation_lead_settings_event_kind_check;

ALTER TABLE contact_automation_lead_settings
  ADD CONSTRAINT contact_automation_lead_settings_event_kind_check
  CHECK (
    (event_type = 'custom_event' AND custom_event_id IS NOT NULL)
    OR (event_type <> 'custom_event' AND custom_event_id IS NULL)
  );

-- 4. Rebuild do unique: scope efectivo (lead_id, event_type, custom_event_id).
--    COALESCE(custom_event_id, uuid_nil) porque Postgres trata NULL como
--    distinto em UNIQUE por defeito, o que quebraria o scope de fixos.
ALTER TABLE contact_automation_lead_settings
  DROP CONSTRAINT IF EXISTS contact_automation_lead_settings_lead_id_event_type_key;

DROP INDEX IF EXISTS contact_automation_lead_settings_unique_idx;

CREATE UNIQUE INDEX contact_automation_lead_settings_unique_idx
  ON contact_automation_lead_settings (
    lead_id,
    event_type,
    COALESCE(custom_event_id, '00000000-0000-0000-0000-000000000000'::uuid)
  );

-- 5. Índice de lookup para queries do spawner/retry.
CREATE INDEX IF NOT EXISTS idx_cals_lead_event_custom
  ON contact_automation_lead_settings (lead_id, event_type, custom_event_id);
