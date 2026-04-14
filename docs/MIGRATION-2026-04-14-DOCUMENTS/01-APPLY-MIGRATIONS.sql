-- =====================================================================
-- APPLY — Change `add-document-folders-ui`
-- Corre DEPOIS de 00-BACKUP-SNAPSHOT.sql.
-- Contém as 3 migrations consolidadas numa única transacção para que
-- falhas parciais não deixem o schema num estado inconsistente.
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- Migration 1 — doc_types.applies_to
-- Ver: supabase/migrations/20260414_doc_types_applies_to.sql
-- ---------------------------------------------------------------------
ALTER TABLE doc_types
  ADD COLUMN IF NOT EXISTS applies_to text[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN doc_types.applies_to IS
  'Domain scopes: ''properties'',''leads'',''negocios'',''processes''. Empty = global.';

UPDATE doc_types
   SET applies_to = ARRAY['properties']
 WHERE applies_to = '{}'
   AND lower(coalesce(category, '')) IN ('imóvel', 'imovel', 'jurídico', 'juridico', 'jurídico especial', 'juridico especial');

UPDATE doc_types
   SET applies_to = ARRAY['properties', 'negocios']
 WHERE applies_to = '{}'
   AND lower(coalesce(category, '')) = 'contratual';

UPDATE doc_types
   SET applies_to = ARRAY['properties', 'leads', 'negocios']
 WHERE applies_to = '{}'
   AND lower(coalesce(category, '')) IN ('proprietário', 'proprietario', 'proprietário empresa', 'proprietario empresa');


-- ---------------------------------------------------------------------
-- Migration 2 — lead_attachments.doc_type_id + metadata extras
-- Ver: supabase/migrations/20260414_lead_attachments_doc_type.sql
-- Aumentada aqui para também acomodar file_size, mime_type, valid_until,
-- notes usados pelo novo endpoint multipart.
-- ---------------------------------------------------------------------
ALTER TABLE lead_attachments
  ADD COLUMN IF NOT EXISTS doc_type_id uuid REFERENCES doc_types(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS file_size  bigint,
  ADD COLUMN IF NOT EXISTS mime_type  text,
  ADD COLUMN IF NOT EXISTS valid_until timestamptz,
  ADD COLUMN IF NOT EXISTS notes      text;

CREATE INDEX IF NOT EXISTS idx_lead_attachments_doc_type
  ON lead_attachments(doc_type_id);

COMMENT ON COLUMN lead_attachments.doc_type_id IS
  'Optional doc_types link. NULL = "Outros" folder in the UI.';


-- ---------------------------------------------------------------------
-- Migration 3 — negocio_documents (nova tabela)
-- Ver: supabase/migrations/20260414_negocio_documents.sql
-- ---------------------------------------------------------------------
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


-- ---------------------------------------------------------------------
-- Verificações pós-migration dentro da mesma transacção — se alguma
-- falhar, ROLLBACK.
-- ---------------------------------------------------------------------
DO $$
BEGIN
  -- doc_types.applies_to existe
  PERFORM 1 FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'doc_types' AND column_name = 'applies_to';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'doc_types.applies_to não criada — abortar';
  END IF;

  -- lead_attachments.doc_type_id existe
  PERFORM 1 FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'lead_attachments' AND column_name = 'doc_type_id';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'lead_attachments.doc_type_id não criada — abortar';
  END IF;

  -- negocio_documents existe
  PERFORM 1 FROM information_schema.tables
   WHERE table_schema = 'public' AND table_name = 'negocio_documents';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'negocio_documents não criada — abortar';
  END IF;
END $$;

COMMIT;


-- ---------------------------------------------------------------------
-- PÓS-COMMIT — validações não-transaccionais
-- ---------------------------------------------------------------------

-- Confirma colunas finais
SELECT column_name, data_type FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'doc_types'
  AND column_name = 'applies_to';

SELECT column_name, data_type FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'lead_attachments'
  AND column_name IN ('doc_type_id', 'file_size', 'mime_type', 'valid_until', 'notes')
ORDER BY column_name;

SELECT count(*) AS negocio_documents_rows FROM negocio_documents;

-- Re-run dos checksums — comparar com o backup de 00-BACKUP-SNAPSHOT.sql
SELECT md5(string_agg(id::text || coalesce(name, '') || coalesce(category, ''), '|'
                      ORDER BY id)) AS doc_types_fingerprint_after
FROM doc_types;

SELECT md5(string_agg(id::text || coalesce(url, '') || coalesce(name, ''), '|'
                      ORDER BY id)) AS lead_attachments_fingerprint_after
FROM lead_attachments;

-- Nota: os fingerprints só olham para colunas que EXISTIAM antes
-- (id, name, category, url). Portanto devem ficar IDÊNTICOS aos do backup.
