-- negocio_documents — first-class document table for "negocios" entities.
-- Mirrors the doc_registry pattern but scoped per deal so we can attach
-- contracts, ID copies, proof of funds, etc. with metadata.

CREATE TABLE IF NOT EXISTS negocio_documents (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  negocio_id   uuid NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
  doc_type_id  uuid REFERENCES doc_types(id) ON DELETE SET NULL,
  file_url     text NOT NULL,
  file_name    text NOT NULL,
  file_size    bigint,
  mime_type    text,
  uploaded_by  uuid REFERENCES dev_users(id) ON DELETE SET NULL,
  valid_until  timestamptz,
  notes        text,
  label        text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_negocio_documents_negocio
  ON negocio_documents(negocio_id);

CREATE INDEX IF NOT EXISTS idx_negocio_documents_doc_type
  ON negocio_documents(doc_type_id);

CREATE INDEX IF NOT EXISTS idx_negocio_documents_uploaded_by
  ON negocio_documents(uploaded_by);

-- Touch updated_at on changes
CREATE OR REPLACE FUNCTION touch_negocio_documents_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_touch_negocio_documents_updated_at ON negocio_documents;
CREATE TRIGGER trg_touch_negocio_documents_updated_at
  BEFORE UPDATE ON negocio_documents
  FOR EACH ROW EXECUTE FUNCTION touch_negocio_documents_updated_at();

COMMENT ON TABLE negocio_documents IS
  'Per-deal documents (contracts, IDs, proofs). Files live in R2; this table stores metadata.';
