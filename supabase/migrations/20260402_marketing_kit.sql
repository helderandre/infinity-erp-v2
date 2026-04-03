-- =============================================================================
-- Migration: marketing_kit
-- Sistema de Kit Marketing para consultores
-- Templates de Canva + materiais gerados por agente
-- =============================================================================

BEGIN;

-- 1. Templates de kit marketing (registados pelo admin/marketing)
CREATE TABLE IF NOT EXISTS marketing_kit_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN (
    'cartao_visita', 'cartao_digital', 'badge', 'placa_venda',
    'placa_arrendamento', 'assinatura_email', 'relatorio_imovel',
    'estudo_mercado', 'outro'
  )),
  description TEXT,
  canva_design_id TEXT,
  placeholders TEXT[] NOT NULL DEFAULT '{}',
  thumbnail_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_by UUID REFERENCES dev_users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Materiais gerados por agente
CREATE TABLE IF NOT EXISTS agent_materials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES dev_users(id) ON DELETE CASCADE,
  template_id UUID NOT NULL REFERENCES marketing_kit_templates(id) ON DELETE CASCADE,
  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size INTEGER,
  mime_type TEXT,
  thumbnail_path TEXT,
  uploaded_by UUID REFERENCES dev_users(id),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_agent_template UNIQUE (agent_id, template_id)
);

-- 3. Indices
CREATE INDEX idx_mkt_agent_materials ON agent_materials(agent_id);
CREATE INDEX idx_mkt_template_active ON marketing_kit_templates(is_active) WHERE is_active = true;

-- 4. Triggers updated_at
CREATE OR REPLACE FUNCTION trg_marketing_kit_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_marketing_kit_templates_updated
  BEFORE UPDATE ON marketing_kit_templates
  FOR EACH ROW EXECUTE FUNCTION trg_marketing_kit_updated_at();

CREATE TRIGGER trg_agent_materials_updated
  BEFORE UPDATE ON agent_materials
  FOR EACH ROW EXECUTE FUNCTION trg_marketing_kit_updated_at();

-- 5. RLS
ALTER TABLE marketing_kit_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_materials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read kit templates"
  ON marketing_kit_templates FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Admins can manage kit templates"
  ON marketing_kit_templates FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can read agent materials"
  ON agent_materials FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Admins can manage agent materials"
  ON agent_materials FOR ALL
  USING (true)
  WITH CHECK (true);

-- 6. Seed default templates
INSERT INTO marketing_kit_templates (name, category, placeholders, sort_order) VALUES
  ('Cartão de Visita RE/MAX', 'cartao_visita', ARRAY['NOME', 'EMAIL', 'PHONE', 'PHOTO', 'TITULO'], 1),
  ('Cartão de Visita RE/MAX Collection', 'cartao_visita', ARRAY['NOME', 'EMAIL', 'PHONE', 'PHOTO', 'TITULO'], 2),
  ('Cartão Digital', 'cartao_digital', ARRAY['NOME', 'EMAIL', 'PHONE', 'PHOTO', 'TITULO'], 3),
  ('Badge RE/MAX', 'badge', ARRAY['NOME', 'PHONE', 'PHOTO'], 4),
  ('Badge RE/MAX Collection', 'badge', ARRAY['NOME', 'PHONE', 'PHOTO'], 5),
  ('Placa de Venda RE/MAX', 'placa_venda', ARRAY['NOME', 'PHONE'], 6),
  ('Placa de Venda RE/MAX Collection', 'placa_venda', ARRAY['NOME', 'PHONE'], 7),
  ('Assinatura de Email', 'assinatura_email', ARRAY['NOME', 'EMAIL', 'PHONE', 'PHOTO', 'TITULO'], 8),
  ('Estudo de Mercado', 'estudo_mercado', ARRAY['NOME', 'PHOTO'], 9),
  ('Relatório de Imóvel', 'relatorio_imovel', ARRAY['NOME', 'PHOTO'], 10);

COMMIT;
