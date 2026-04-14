-- =====================================================================
-- ROLLBACK — Change `add-document-folders-ui`
-- Só usar se algo correr mal depois de aplicar 01-APPLY-MIGRATIONS.sql
-- ATENÇÃO: o rollback é destrutivo para a tabela `negocio_documents`
-- (se já houver dados lá, são perdidos). Fazer backup primeiro.
-- =====================================================================

BEGIN;

-- 3. Remover tabela negocio_documents + função + trigger
DROP TRIGGER IF EXISTS trg_touch_negocio_documents_updated_at ON negocio_documents;
DROP FUNCTION IF EXISTS touch_negocio_documents_updated_at();
DROP TABLE IF EXISTS negocio_documents;

-- 2. Remover colunas novas de lead_attachments
DROP INDEX IF EXISTS idx_lead_attachments_doc_type;
ALTER TABLE lead_attachments
  DROP COLUMN IF EXISTS doc_type_id,
  DROP COLUMN IF EXISTS file_size,
  DROP COLUMN IF EXISTS mime_type,
  DROP COLUMN IF EXISTS valid_until,
  DROP COLUMN IF EXISTS notes;

-- 1. Remover coluna applies_to de doc_types
ALTER TABLE doc_types
  DROP COLUMN IF EXISTS applies_to;

COMMIT;

-- Verificação
SELECT column_name FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'doc_types'
  AND column_name = 'applies_to';
-- ↑ deve vir vazio

SELECT EXISTS (
  SELECT 1 FROM information_schema.tables
  WHERE table_schema = 'public' AND table_name = 'negocio_documents'
);
-- ↑ deve ser false
