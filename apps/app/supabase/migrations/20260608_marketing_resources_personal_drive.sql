-- Marketing recursos — extend with per-consultant personal drive.
--
-- Adds two columns + a CHECK constraint so the same tree-structure table
-- can host both the existing global asset library (scope='global') and
-- per-consultant personal drives (scope='personal', owner_id=<consultor>).
--
-- Existing rows are migrated with scope='global' (default). The
-- application layer enforces ownership checks for personal-scope rows;
-- RLS stays permissive so server-rendered presentations and shared
-- pages can still resolve URLs of global assets.
--
-- Quota of 500 MB per consultor is enforced at the API layer in
-- /api/marketing/recursos/upload — no DB-side quota constraint is added,
-- so brokers can override or raise the limit later without a migration.
--
-- Revert:
--   ALTER TABLE marketing_resources DROP CONSTRAINT IF EXISTS marketing_resources_scope_owner;
--   DROP INDEX IF EXISTS idx_marketing_resources_owner_scope;
--   ALTER TABLE marketing_resources DROP COLUMN IF EXISTS owner_id;
--   ALTER TABLE marketing_resources DROP COLUMN IF EXISTS scope;

ALTER TABLE marketing_resources
  ADD COLUMN IF NOT EXISTS scope TEXT NOT NULL DEFAULT 'global'
    CHECK (scope IN ('global','personal'));

ALTER TABLE marketing_resources
  ADD COLUMN IF NOT EXISTS owner_id UUID
    REFERENCES dev_users(id) ON DELETE CASCADE;

-- Either scope='global' with no owner, or scope='personal' with an owner.
ALTER TABLE marketing_resources
  DROP CONSTRAINT IF EXISTS marketing_resources_scope_owner;
ALTER TABLE marketing_resources
  ADD CONSTRAINT marketing_resources_scope_owner CHECK (
    (scope = 'global'   AND owner_id IS NULL) OR
    (scope = 'personal' AND owner_id IS NOT NULL)
  );

-- Composite index for the personal-drive listing query
-- (scope='personal' AND owner_id=<me> AND parent_id IS NULL/uuid).
CREATE INDEX IF NOT EXISTS idx_marketing_resources_owner_scope
  ON marketing_resources(scope, owner_id, parent_id);

COMMENT ON COLUMN marketing_resources.scope IS
  'global = company-wide library; personal = per-consultor drive (owner_id required)';
COMMENT ON COLUMN marketing_resources.owner_id IS
  'For scope=personal: dev_users.id of the consultor who owns this folder/file';
