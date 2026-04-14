-- lead_attachments.doc_type_id — optional link to a doc_types row so the
-- folders UI can group attachments by type. Legacy rows stay NULL and are
-- shown in the "Outros" folder. Aditive migration, zero-downtime.

ALTER TABLE lead_attachments
  ADD COLUMN IF NOT EXISTS doc_type_id uuid REFERENCES doc_types(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_lead_attachments_doc_type
  ON lead_attachments(doc_type_id);

COMMENT ON COLUMN lead_attachments.doc_type_id IS
  'Optional doc_types link. Used by the folder UI to group attachments. NULL = "Outros".';
