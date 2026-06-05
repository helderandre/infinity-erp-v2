-- =============================================================================
-- Migration: company_documents
-- Repositório de documentos da empresa (templates, contratos, checklists, etc.)
-- =============================================================================

BEGIN;

-- 1. Tabela principal
CREATE TABLE IF NOT EXISTS company_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL CHECK (category IN (
    'angariacao', 'institucional', 'cliente', 'contratos',
    'kyc', 'fiscal', 'marketing', 'formacao', 'outro'
  )),
  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size INTEGER,
  mime_type TEXT,
  file_extension TEXT,
  download_count INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  uploaded_by UUID REFERENCES dev_users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Indices
CREATE INDEX idx_company_docs_category ON company_documents(category) WHERE is_active = true;
CREATE INDEX idx_company_docs_name ON company_documents USING gin(to_tsvector('portuguese', name));

-- 3. Trigger updated_at
CREATE OR REPLACE FUNCTION trg_company_docs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_company_documents_updated
  BEFORE UPDATE ON company_documents
  FOR EACH ROW EXECUTE FUNCTION trg_company_docs_updated_at();

-- 4. RLS
ALTER TABLE company_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read company documents"
  ON company_documents FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Admins can manage company documents"
  ON company_documents FOR ALL
  USING (true)
  WITH CHECK (true);

-- 5. RPC para incrementar download count atomicamente
CREATE OR REPLACE FUNCTION increment_download_count(doc_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE company_documents
  SET download_count = download_count + 1
  WHERE id = doc_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMIT;
