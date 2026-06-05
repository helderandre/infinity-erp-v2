-- =============================================================================
-- Migration: marketing_design_categories + agent_personal_designs
-- Dynamic taxonomy for marketing designs (Team + Personal tabs) and a workspace
-- for consultant-uploaded personal designs.
-- =============================================================================

BEGIN;

-- 1. marketing_design_categories -------------------------------------------

CREATE TABLE IF NOT EXISTS marketing_design_categories (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug        TEXT NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9_-]+$'),
  label       TEXT NOT NULL,
  icon        TEXT,
  color       TEXT,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  is_system   BOOLEAN NOT NULL DEFAULT false,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_by  UUID REFERENCES dev_users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mkt_design_cats_order
  ON marketing_design_categories(sort_order)
  WHERE is_active = true;

DROP TRIGGER IF EXISTS trg_mkt_design_cats_updated ON marketing_design_categories;
CREATE TRIGGER trg_mkt_design_cats_updated
  BEFORE UPDATE ON marketing_design_categories
  FOR EACH ROW EXECUTE FUNCTION trg_company_docs_updated_at();

-- Seed the 8 system categories that match the legacy DESIGN_CATEGORIES map.
INSERT INTO marketing_design_categories (slug, label, sort_order, is_system, is_active)
VALUES
  ('placas',        'Placas',             10, true, true),
  ('cartoes',       'Cartões',            20, true, true),
  ('badges',        'Badges',             30, true, true),
  ('assinaturas',   'Assinaturas',        40, true, true),
  ('relatorios',    'Relatórios',         50, true, true),
  ('estudos',       'Estudos de Mercado', 60, true, true),
  ('redes_sociais', 'Redes Sociais',      70, true, true),
  ('outro',         'Outros',             80, true, true)
ON CONFLICT (slug) DO NOTHING;

-- 2. Link marketing_design_templates to dynamic taxonomy -------------------

ALTER TABLE marketing_design_templates
  ADD COLUMN IF NOT EXISTS category_id UUID
  REFERENCES marketing_design_categories(id) ON DELETE SET NULL;

UPDATE marketing_design_templates t
SET category_id = c.id
FROM marketing_design_categories c
WHERE t.category = c.slug
  AND t.category_id IS NULL;

-- Drop the legacy CHECK constraint — validation now lives in the API so new
-- dynamic categories (e.g. "flyers") can be created without a migration.
ALTER TABLE marketing_design_templates
  DROP CONSTRAINT IF EXISTS marketing_design_templates_category_check;

CREATE INDEX IF NOT EXISTS idx_mdt_category_id
  ON marketing_design_templates(category_id)
  WHERE is_active = true;

-- 3. agent_personal_designs -------------------------------------------------

CREATE TABLE IF NOT EXISTS agent_personal_designs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id        UUID NOT NULL REFERENCES dev_users(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  description     TEXT,
  category_id     UUID REFERENCES marketing_design_categories(id) ON DELETE SET NULL,
  file_path       TEXT,
  file_name       TEXT,
  file_size       INTEGER,
  mime_type       TEXT,
  thumbnail_path  TEXT,
  canva_url       TEXT,
  sort_order      INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT agent_personal_designs_source_check
    CHECK (file_path IS NOT NULL OR canva_url IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_agent_personal_designs_agent
  ON agent_personal_designs(agent_id);

CREATE INDEX IF NOT EXISTS idx_agent_personal_designs_agent_category
  ON agent_personal_designs(agent_id, category_id);

DROP TRIGGER IF EXISTS trg_agent_personal_designs_updated ON agent_personal_designs;
CREATE TRIGGER trg_agent_personal_designs_updated
  BEFORE UPDATE ON agent_personal_designs
  FOR EACH ROW EXECUTE FUNCTION trg_company_docs_updated_at();

-- 4. RLS --------------------------------------------------------------------

ALTER TABLE marketing_design_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read marketing design categories"
  ON marketing_design_categories;
CREATE POLICY "Authenticated users can read marketing design categories"
  ON marketing_design_categories FOR SELECT
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Service role can manage marketing design categories"
  ON marketing_design_categories;
CREATE POLICY "Service role can manage marketing design categories"
  ON marketing_design_categories FOR ALL
  USING (true)
  WITH CHECK (true);

ALTER TABLE agent_personal_designs ENABLE ROW LEVEL SECURITY;

-- Agents read their own; admins (via user_roles join) read everything.
DROP POLICY IF EXISTS "Agents read own personal designs" ON agent_personal_designs;
CREATE POLICY "Agents read own personal designs"
  ON agent_personal_designs FOR SELECT
  USING (
    agent_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM user_roles ur
      JOIN roles r ON r.id = ur.role_id
      WHERE ur.user_id = auth.uid()
        AND (
          lower(r.name) IN ('broker/ceo', 'admin')
          OR (r.permissions->>'settings')::boolean = true
        )
    )
  );

DROP POLICY IF EXISTS "Service role manages personal designs" ON agent_personal_designs;
CREATE POLICY "Service role manages personal designs"
  ON agent_personal_designs FOR ALL
  USING (true)
  WITH CHECK (true);

COMMENT ON TABLE marketing_design_categories IS
  'Dynamic taxonomy for marketing designs (team + personal). Managed from /dashboard/documentos by admins with settings permission. is_system rows are seeded on migration and cannot be deleted/deactivated.';

COMMENT ON TABLE agent_personal_designs IS
  'Per-consultant personal design workspace (image/PDF upload or Canva link) categorised via marketing_design_categories.';

COMMIT;
