-- Simple table to store recruitment contract PDF templates
CREATE TABLE IF NOT EXISTS recruitment_contracts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  section     TEXT NOT NULL UNIQUE,  -- 'contrato_prestacao_servicos', 'contrato_rescisao'
  name        TEXT NOT NULL,
  file_url    TEXT,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE recruitment_contracts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access" ON recruitment_contracts FOR ALL USING (true) WITH CHECK (true);
