-- =============================================================================
-- Migration: company_document_categories
-- Dynamic taxonomy for the company_documents library.
-- Admins with the `settings` permission can create/rename/deactivate categories
-- from /dashboard/documentos without code changes.
-- =============================================================================

BEGIN;

-- 1. Table ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS company_document_categories (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug        TEXT NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9-]+$'),
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

CREATE INDEX IF NOT EXISTS idx_company_doc_categories_order
  ON company_document_categories(sort_order)
  WHERE is_active = true;

-- 2. Trigger: touch updated_at -------------------------------------------------

CREATE OR REPLACE FUNCTION trg_company_doc_categories_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_company_doc_categories_updated ON company_document_categories;
CREATE TRIGGER trg_company_doc_categories_updated
  BEFORE UPDATE ON company_document_categories
  FOR EACH ROW EXECUTE FUNCTION trg_company_doc_categories_updated_at();

-- 3. Seed 9 system categories (match hardcoded CATEGORIES map) -----------------

INSERT INTO company_document_categories (slug, label, sort_order, is_system, is_active)
VALUES
  ('angariacao',    'Angariação',     10, true, true),
  ('institucional', 'Institucionais', 20, true, true),
  ('cliente',       'Cliente',        30, true, true),
  ('contratos',     'Contratos',      40, true, true),
  ('kyc',           'KYC',            50, true, true),
  ('fiscal',        'Fiscal',         60, true, true),
  ('marketing',     'Marketing',      70, true, true),
  ('formacao',      'Formação',       80, true, true),
  ('outro',         'Outros',         90, true, true)
ON CONFLICT (slug) DO NOTHING;

-- 4. Drop legacy CHECK constraint on company_documents.category ----------------
-- The CHECK (category IN (...)) on the legacy table would block new dynamic
-- categories from ever being inserted. Drop it; validation now lives in the API.

ALTER TABLE company_documents
  DROP CONSTRAINT IF EXISTS company_documents_category_check;

-- 5. Add category_id FK + backfill ---------------------------------------------

ALTER TABLE company_documents
  ADD COLUMN IF NOT EXISTS category_id UUID
  REFERENCES company_document_categories(id) ON DELETE SET NULL;

UPDATE company_documents cd
SET category_id = c.id
FROM company_document_categories c
WHERE cd.category = c.slug
  AND cd.category_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_company_docs_category_id
  ON company_documents(category_id)
  WHERE is_active = true;

-- 6. RLS: allow authenticated reads; service-role bypasses for API mutations. --

ALTER TABLE company_document_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read categories" ON company_document_categories;
CREATE POLICY "Authenticated users can read categories"
  ON company_document_categories FOR SELECT
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Service role can manage categories" ON company_document_categories;
CREATE POLICY "Service role can manage categories"
  ON company_document_categories FOR ALL
  USING (true)
  WITH CHECK (true);

COMMENT ON TABLE company_document_categories IS
  'Dynamic taxonomy for the company_documents library. Managed from /dashboard/documentos by admins with settings permission. is_system rows are seeded on migration and cannot be deleted/deactivated.';

COMMIT;
