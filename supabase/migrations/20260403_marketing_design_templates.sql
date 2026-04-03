-- =============================================================================
-- Marketing design templates (Canva templates acessíveis pelos consultores)
-- Placas, Cartões, Badges, Assinaturas, Relatórios, etc.
-- =============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS marketing_design_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN (
    'placas', 'cartoes', 'badges', 'assinaturas',
    'relatorios', 'estudos', 'redes_sociais', 'outro'
  )),
  subcategory TEXT,
  description TEXT,
  canva_url TEXT,
  thumbnail_url TEXT,
  file_path TEXT,
  file_name TEXT,
  is_team_design BOOLEAN NOT NULL DEFAULT false,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  uploaded_by UUID REFERENCES dev_users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_mdt_category ON marketing_design_templates(category) WHERE is_active = true;

CREATE TRIGGER trg_marketing_design_templates_updated
  BEFORE UPDATE ON marketing_design_templates
  FOR EACH ROW EXECUTE FUNCTION trg_company_docs_updated_at();

ALTER TABLE marketing_design_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read marketing design templates"
  ON marketing_design_templates FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Admins can manage marketing design templates"
  ON marketing_design_templates FOR ALL
  USING (true)
  WITH CHECK (true);

-- Seed some examples matching the old app
INSERT INTO marketing_design_templates (name, category, is_team_design, sort_order) VALUES
  ('RE/MAX', 'placas', false, 1),
  ('RE/MAX Collection', 'placas', false, 2),
  ('RE/MAX', 'cartoes', false, 1),
  ('RE/MAX Collection', 'cartoes', false, 2),
  ('Assinatura', 'assinaturas', false, 1),
  ('Badge RE/MAX', 'badges', false, 1),
  ('Badge RE/MAX Collection', 'badges', false, 2);

-- Team designs (like the old "Designs da Equipa")
INSERT INTO marketing_design_templates (name, category, is_team_design, sort_order) VALUES
  ('Assinatura de Email', 'assinaturas', true, 1),
  ('Badge RE/MAX', 'badges', true, 2),
  ('Badge RE/MAX Collection', 'badges', true, 3),
  ('Cartão de Visita RE/MAX', 'cartoes', true, 4),
  ('Cartão de Visita RE/MAX Collection', 'cartoes', true, 5),
  ('Cartão Digital', 'cartoes', true, 6),
  ('Estudo de Mercado', 'estudos', true, 7),
  ('Placa de Venda RE/MAX', 'placas', true, 8),
  ('Placa de Venda RE/MAX Collection', 'placas', true, 9),
  ('Relatório de Imóvel', 'relatorios', true, 10);

COMMIT;
