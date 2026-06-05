-- =============================================================================
-- PDF Template Overlay System
-- Allows placing text fields on ANY PDF at specific coordinates
-- with AI-assisted field detection and default template per section
-- =============================================================================

-- 1. pdf_template_fields — positioned text overlays on PDF templates
CREATE TABLE IF NOT EXISTS pdf_template_fields (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id     UUID NOT NULL REFERENCES tpl_doc_library(id) ON DELETE CASCADE,
  -- Position (percentage-based for resolution independence)
  page_number     INT NOT NULL DEFAULT 1,
  x_percent       NUMERIC NOT NULL,  -- 0-100, left edge
  y_percent       NUMERIC NOT NULL,  -- 0-100, top edge
  width_percent   NUMERIC NOT NULL DEFAULT 20,
  height_percent  NUMERIC NOT NULL DEFAULT 3,
  -- Variable mapping
  variable_key    TEXT NOT NULL,       -- e.g. 'nome_completo', 'nif'
  display_label   TEXT,                -- human-readable label shown in editor
  -- Rendering
  font_size       INT NOT NULL DEFAULT 11,
  font_color      TEXT NOT NULL DEFAULT '#000000',
  text_align      TEXT NOT NULL DEFAULT 'left',  -- left, center, right
  transform       TEXT,                -- uppercase, lowercase, date_pt, currency_eur
  is_required     BOOLEAN NOT NULL DEFAULT false,
  -- AI detection metadata
  ai_detected     BOOLEAN NOT NULL DEFAULT false,
  ai_confidence   NUMERIC,            -- 0-1
  -- Ordering
  sort_order      INT NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_pdf_template_fields_tpl ON pdf_template_fields(template_id);

-- 2. template_defaults — default template per section/context
CREATE TABLE IF NOT EXISTS template_defaults (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  section         TEXT NOT NULL UNIQUE,  -- 'contrato_entrada', 'proposta_compra', etc.
  template_id     UUID NOT NULL REFERENCES tpl_doc_library(id) ON DELETE CASCADE,
  label           TEXT,                  -- human-readable: 'Contrato de Entrada'
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by      UUID REFERENCES dev_users(id)
);

CREATE INDEX idx_template_defaults_section ON template_defaults(section);

-- 3. RLS
ALTER TABLE pdf_template_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE template_defaults ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access" ON pdf_template_fields FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON template_defaults FOR ALL USING (true) WITH CHECK (true);

-- 4. Updated_at trigger for pdf_template_fields
CREATE TRIGGER trg_pdf_template_fields_updated
  BEFORE UPDATE ON pdf_template_fields
  FOR EACH ROW EXECUTE FUNCTION leads_update_updated_at();
