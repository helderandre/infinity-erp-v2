-- Marketing recursos — Drive-like file/folder browser for company logos &
-- shared assets. Used by the new /dashboard/marketing/recursos page.
--
-- Behaviour:
--   * Single self-referencing tree (parent_id) so consultants can organise
--     resources in nested folders.
--   * Files live on Cloudflare R2 (public bucket) so the rendered URL can be
--     used directly inside emails / presentations.
--   * RLS: any authenticated user can read; only users with `marketing` (or
--     `settings`) permission can mutate. Authorization is enforced server-side
--     via requirePermission() in the API routes — RLS here is permissive read
--     so server-rendered presentations can still resolve the public URLs.
--
-- Revert:
--   DROP TABLE IF EXISTS marketing_resources CASCADE;

CREATE TABLE IF NOT EXISTS marketing_resources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id UUID REFERENCES marketing_resources(id) ON DELETE CASCADE,
  is_folder BOOLEAN NOT NULL DEFAULT FALSE,
  name TEXT NOT NULL,
  -- File-only columns (NULL for folders)
  file_path TEXT,
  file_url TEXT,
  mime_type TEXT,
  file_size BIGINT,
  -- Bookkeeping
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_by UUID REFERENCES dev_users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT marketing_resources_folder_or_file CHECK (
    (is_folder = TRUE  AND file_path IS NULL AND file_url IS NULL)
    OR
    (is_folder = FALSE AND file_path IS NOT NULL AND file_url IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_marketing_resources_parent ON marketing_resources(parent_id);
CREATE INDEX IF NOT EXISTS idx_marketing_resources_folder ON marketing_resources(is_folder);

-- updated_at trigger
CREATE OR REPLACE FUNCTION marketing_resources_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_marketing_resources_updated_at ON marketing_resources;
CREATE TRIGGER trg_marketing_resources_updated_at
  BEFORE UPDATE ON marketing_resources
  FOR EACH ROW EXECUTE FUNCTION marketing_resources_set_updated_at();

-- RLS
ALTER TABLE marketing_resources ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS marketing_resources_select_authenticated ON marketing_resources;
CREATE POLICY marketing_resources_select_authenticated
  ON marketing_resources
  FOR SELECT
  TO authenticated
  USING (TRUE);

-- Mutations are gated by requirePermission('marketing') on the server side.
-- RLS-side: allow inserts/updates/deletes from authenticated users; the API
-- layer enforces the actual role check.
DROP POLICY IF EXISTS marketing_resources_mutate_authenticated ON marketing_resources;
CREATE POLICY marketing_resources_mutate_authenticated
  ON marketing_resources
  FOR ALL
  TO authenticated
  USING (TRUE)
  WITH CHECK (TRUE);

COMMENT ON TABLE marketing_resources IS
  'Drive-like file/folder hierarchy for shared marketing assets (logos, brand kits). Files reference public R2 keys.';
