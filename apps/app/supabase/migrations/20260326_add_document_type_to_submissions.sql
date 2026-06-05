-- Add document_type to entry submissions
ALTER TABLE recruitment_entry_submissions
  ADD COLUMN IF NOT EXISTS document_type TEXT DEFAULT 'Cartão de Cidadão';

-- Backfill existing rows
UPDATE recruitment_entry_submissions
SET document_type = 'Cartão de Cidadão'
WHERE document_type IS NULL;
