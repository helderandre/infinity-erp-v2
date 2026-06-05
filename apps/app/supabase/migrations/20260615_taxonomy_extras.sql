-- =============================================================================
-- Migration: taxonomy_extras
-- User-contributed extensions to hardcoded enum fields. Code keeps the canonical
-- options (lib/constants.ts); this table stores user-added values that appear
-- as additional dropdown options globally. Admins (`settings` permission) can
-- edit/deactivate from /dashboard/definicoes → Taxonomias.
--
-- First scope wired: 'property_type'. Add more scopes as we extend Select fields
-- by simply inserting rows — no schema changes needed.
-- =============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS taxonomy_extras (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scope       TEXT NOT NULL CHECK (scope ~ '^[a-z][a-z0-9_]*$'),
  value       TEXT NOT NULL CHECK (value ~ '^[a-z0-9_-]+$'),
  label       TEXT NOT NULL,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_by  UUID REFERENCES dev_users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT taxonomy_extras_scope_value_unique UNIQUE (scope, value)
);

CREATE INDEX IF NOT EXISTS idx_taxonomy_extras_scope_active
  ON taxonomy_extras(scope, sort_order)
  WHERE is_active = true;

-- Touch updated_at on UPDATE
CREATE OR REPLACE FUNCTION trg_taxonomy_extras_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_taxonomy_extras_updated ON taxonomy_extras;
CREATE TRIGGER trg_taxonomy_extras_updated
  BEFORE UPDATE ON taxonomy_extras
  FOR EACH ROW EXECUTE FUNCTION trg_taxonomy_extras_updated_at();

-- RLS: read open to authenticated; writes via service_role (API routes
-- enforce auth + per-scope rules — admin only for edit/delete).
ALTER TABLE taxonomy_extras ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS taxonomy_extras_read ON taxonomy_extras;
CREATE POLICY taxonomy_extras_read ON taxonomy_extras
  FOR SELECT TO authenticated USING (true);

COMMIT;
