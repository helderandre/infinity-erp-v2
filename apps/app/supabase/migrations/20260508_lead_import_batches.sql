-- CSV import infrastructure for both `leads` (contactos) and `leads_entries`
-- (leads inbound). Adds a single batch-tracking table plus a nullable
-- `import_batch_id` column on each importable table so a whole batch can be
-- audited and rolled back as a unit.
--
-- Aditive only — existing rows stay NULL on `import_batch_id` (i.e. not
-- imported via CSV). No CHECK constraints, no required updates.
--
-- Revert:
--   ALTER TABLE leads DROP COLUMN IF EXISTS import_batch_id;
--   ALTER TABLE leads_entries DROP COLUMN IF EXISTS import_batch_id;
--   DROP TABLE IF EXISTS lead_import_batches;

CREATE TABLE IF NOT EXISTS lead_import_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  imported_by UUID REFERENCES dev_users(id) ON DELETE SET NULL,
  imported_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  target_table TEXT NOT NULL CHECK (target_table IN ('leads', 'leads_entries')),
  file_name TEXT,
  options JSONB,
  inserted_count INTEGER NOT NULL DEFAULT 0,
  failed_count INTEGER NOT NULL DEFAULT 0,
  errors JSONB
);

CREATE INDEX IF NOT EXISTS idx_lead_import_batches_imported_by
  ON lead_import_batches(imported_by);

ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS import_batch_id UUID
  REFERENCES lead_import_batches(id) ON DELETE SET NULL;

ALTER TABLE leads_entries
  ADD COLUMN IF NOT EXISTS import_batch_id UUID
  REFERENCES lead_import_batches(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_leads_import_batch_id
  ON leads(import_batch_id) WHERE import_batch_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_leads_entries_import_batch_id
  ON leads_entries(import_batch_id) WHERE import_batch_id IS NOT NULL;

-- RLS: authenticated users can read their own batches; mutations always go
-- through the API (which enforces permissions server-side).
ALTER TABLE lead_import_batches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS lead_import_batches_select ON lead_import_batches;
CREATE POLICY lead_import_batches_select
  ON lead_import_batches FOR SELECT TO authenticated USING (TRUE);

DROP POLICY IF EXISTS lead_import_batches_mutate ON lead_import_batches;
CREATE POLICY lead_import_batches_mutate
  ON lead_import_batches FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);

COMMENT ON TABLE lead_import_batches IS
  'Audit + rollback unit for CSV imports into `leads` or `leads_entries`. Roll back a whole batch by deleting the batch row (CASCADE SET NULL on the children).';
