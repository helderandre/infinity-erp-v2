-- =============================================================================
-- REWIRE CRM: Use existing `leads` + `negocios` tables instead of new ones
-- =============================================================================

-- 1. Drop all the new tables that duplicate existing ones
DROP TABLE IF EXISTS leads_negocio_stage_history CASCADE;
DROP TABLE IF EXISTS leads_activities CASCADE;
DROP TABLE IF EXISTS leads_referrals CASCADE;
DROP TABLE IF EXISTS leads_entries CASCADE;
DROP TABLE IF EXISTS leads_negocios CASCADE;
DROP TABLE IF EXISTS leads_contacts CASCADE;

-- 2. Add CRM columns to existing `leads` table
ALTER TABLE leads ADD COLUMN IF NOT EXISTS lifecycle_stage_id UUID REFERENCES leads_contact_stages(id);
ALTER TABLE leads ADD COLUMN IF NOT EXISTS tags TEXT[] NOT NULL DEFAULT '{}';

UPDATE leads SET lifecycle_stage_id = (
  SELECT id FROM leads_contact_stages WHERE is_default = true LIMIT 1
) WHERE lifecycle_stage_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_leads_lifecycle ON leads(lifecycle_stage_id);
CREATE INDEX IF NOT EXISTS idx_leads_tags ON leads USING GIN(tags);

-- Default lifecycle trigger
CREATE OR REPLACE FUNCTION leads_set_default_lifecycle()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.lifecycle_stage_id IS NULL THEN
    SELECT id INTO NEW.lifecycle_stage_id
    FROM leads_contact_stages WHERE is_default = true LIMIT 1;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_leads_default_lifecycle ON leads;
CREATE TRIGGER trg_leads_default_lifecycle
  BEFORE INSERT ON leads FOR EACH ROW EXECUTE FUNCTION leads_set_default_lifecycle();

-- 3. Add pipeline columns to existing `negocios` table
ALTER TABLE negocios ADD COLUMN IF NOT EXISTS pipeline_stage_id UUID REFERENCES leads_pipeline_stages(id);
ALTER TABLE negocios ADD COLUMN IF NOT EXISTS stage_entered_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE negocios ADD COLUMN IF NOT EXISTS expected_value NUMERIC;
ALTER TABLE negocios ADD COLUMN IF NOT EXISTS probability_pct INT;
ALTER TABLE negocios ADD COLUMN IF NOT EXISTS expected_close_date DATE;
ALTER TABLE negocios ADD COLUMN IF NOT EXISTS won_date TIMESTAMPTZ;
ALTER TABLE negocios ADD COLUMN IF NOT EXISTS lost_date TIMESTAMPTZ;
ALTER TABLE negocios ADD COLUMN IF NOT EXISTS lost_notes TEXT;
ALTER TABLE negocios ADD COLUMN IF NOT EXISTS assigned_consultant_id UUID REFERENCES dev_users(id);
ALTER TABLE negocios ADD COLUMN IF NOT EXISTS property_id UUID REFERENCES dev_properties(id);
ALTER TABLE negocios ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_negocios_pipeline_stage ON negocios(pipeline_stage_id);
CREATE INDEX IF NOT EXISTS idx_negocios_consultant ON negocios(assigned_consultant_id);

-- Map existing negocios.tipo to pipeline_type for the stage lookup
-- Set initial pipeline_stage_id based on tipo
DO $$
DECLARE
  r RECORD;
  stage_id UUID;
  ptype TEXT;
BEGIN
  FOR r IN SELECT id, tipo, estado FROM negocios WHERE pipeline_stage_id IS NULL LOOP
    -- Map tipo to pipeline_type
    CASE r.tipo
      WHEN 'Compra' THEN ptype := 'comprador';
      WHEN 'Venda' THEN ptype := 'vendedor';
      WHEN 'Arrendatário' THEN ptype := 'arrendatario';
      WHEN 'Arrendador' THEN ptype := 'arrendador';
      WHEN 'Compra e Venda' THEN ptype := 'comprador';
      ELSE ptype := 'comprador';
    END CASE;

    -- Map estado to closest pipeline stage
    CASE r.estado
      WHEN 'Aberto' THEN
        SELECT id INTO stage_id FROM leads_pipeline_stages
        WHERE pipeline_type = ptype AND order_index = 0 LIMIT 1;
      WHEN 'Em Acompanhamento' THEN
        SELECT id INTO stage_id FROM leads_pipeline_stages
        WHERE pipeline_type = ptype AND order_index = 1 LIMIT 1;
      WHEN 'Em progresso' THEN
        SELECT id INTO stage_id FROM leads_pipeline_stages
        WHERE pipeline_type = ptype AND order_index = 3 LIMIT 1;
      WHEN 'Proposta' THEN
        SELECT id INTO stage_id FROM leads_pipeline_stages
        WHERE pipeline_type = ptype AND name ILIKE '%proposta%' AND is_terminal = false LIMIT 1;
      WHEN 'Fechado' THEN
        SELECT id INTO stage_id FROM leads_pipeline_stages
        WHERE pipeline_type = ptype AND terminal_type = 'won' LIMIT 1;
      WHEN 'Cancelado', 'Perdido' THEN
        SELECT id INTO stage_id FROM leads_pipeline_stages
        WHERE pipeline_type = ptype AND terminal_type = 'lost' LIMIT 1;
      ELSE
        SELECT id INTO stage_id FROM leads_pipeline_stages
        WHERE pipeline_type = ptype AND order_index = 0 LIMIT 1;
    END CASE;

    IF stage_id IS NOT NULL THEN
      UPDATE negocios SET pipeline_stage_id = stage_id, stage_entered_at = created_at WHERE id = r.id;
    END IF;
  END LOOP;
END $$;

-- Copy agent_id from lead to negocio where missing
UPDATE negocios n SET assigned_consultant_id = l.agent_id
FROM leads l WHERE n.lead_id = l.id AND n.assigned_consultant_id IS NULL;

-- Set expected_value from orcamento where available
UPDATE negocios SET expected_value = orcamento WHERE expected_value IS NULL AND orcamento IS NOT NULL;
UPDATE negocios SET expected_value = preco_venda WHERE expected_value IS NULL AND preco_venda IS NOT NULL;

-- Updated_at trigger for negocios
DROP TRIGGER IF EXISTS trg_leads_negocios_updated ON negocios;
CREATE TRIGGER trg_negocios_crm_updated
  BEFORE UPDATE ON negocios FOR EACH ROW EXECUTE FUNCTION leads_update_updated_at();

-- Stage change tracking trigger for negocios
DROP TRIGGER IF EXISTS trg_leads_negocios_stage_change ON negocios;

CREATE OR REPLACE FUNCTION negocios_track_stage_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.pipeline_stage_id IS DISTINCT FROM NEW.pipeline_stage_id AND NEW.pipeline_stage_id IS NOT NULL THEN
    UPDATE leads_negocio_stage_history
    SET exited_at = now()
    WHERE negocio_id = NEW.id AND exited_at IS NULL;

    INSERT INTO leads_negocio_stage_history (negocio_id, stage_id, entered_at)
    VALUES (NEW.id, NEW.pipeline_stage_id, now());

    NEW.stage_entered_at = now();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_negocios_stage_change
  BEFORE UPDATE ON negocios FOR EACH ROW EXECUTE FUNCTION negocios_track_stage_change();

CREATE OR REPLACE FUNCTION negocios_init_stage_history()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.pipeline_stage_id IS NOT NULL THEN
    INSERT INTO leads_negocio_stage_history (negocio_id, stage_id, entered_at)
    VALUES (NEW.id, NEW.pipeline_stage_id, COALESCE(NEW.stage_entered_at, now()));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_negocios_init_history
  AFTER INSERT ON negocios FOR EACH ROW EXECUTE FUNCTION negocios_init_stage_history();

-- 4. Recreate dependent tables with FK to leads(id) and negocios(id)

CREATE TABLE leads_negocio_stage_history (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  negocio_id      UUID NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
  stage_id        UUID NOT NULL REFERENCES leads_pipeline_stages(id),
  entered_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  exited_at       TIMESTAMPTZ,
  moved_by        UUID REFERENCES dev_users(id)
);
CREATE INDEX idx_leads_stage_history_negocio ON leads_negocio_stage_history(negocio_id, entered_at DESC);

CREATE TABLE leads_entries (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id      UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  source          TEXT NOT NULL,
  campaign_id     UUID REFERENCES leads_campaigns(id),
  partner_id      UUID REFERENCES leads_partners(id),
  utm_source      TEXT,
  utm_medium      TEXT,
  utm_campaign    TEXT,
  utm_content     TEXT,
  utm_term        TEXT,
  form_data       JSONB,
  form_url        TEXT,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_leads_entries_contact ON leads_entries(contact_id);
CREATE INDEX idx_leads_entries_source ON leads_entries(source);
CREATE INDEX idx_leads_entries_created ON leads_entries(created_at DESC);

CREATE TABLE leads_activities (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id      UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  negocio_id      UUID REFERENCES negocios(id) ON DELETE SET NULL,
  activity_type   TEXT NOT NULL,
  direction       TEXT,
  subject         TEXT,
  description     TEXT,
  metadata        JSONB,
  created_by      UUID REFERENCES dev_users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_leads_activities_contact ON leads_activities(contact_id, created_at DESC);
CREATE INDEX idx_leads_activities_negocio ON leads_activities(negocio_id, created_at DESC) WHERE negocio_id IS NOT NULL;

CREATE TABLE leads_referrals (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id            UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  negocio_id            UUID REFERENCES negocios(id) ON DELETE SET NULL,
  entry_id              UUID REFERENCES leads_entries(id) ON DELETE SET NULL,
  referral_type         TEXT NOT NULL,
  from_consultant_id    UUID REFERENCES dev_users(id),
  to_consultant_id      UUID REFERENCES dev_users(id),
  partner_id            UUID REFERENCES leads_partners(id),
  status                TEXT NOT NULL DEFAULT 'pending',
  notes                 TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_referral_type CHECK (
    (referral_type = 'internal' AND from_consultant_id IS NOT NULL AND to_consultant_id IS NOT NULL) OR
    (referral_type = 'partner_inbound' AND partner_id IS NOT NULL)
  )
);
CREATE INDEX idx_leads_referrals_contact ON leads_referrals(contact_id);

CREATE TRIGGER trg_leads_referrals_updated
  BEFORE UPDATE ON leads_referrals FOR EACH ROW EXECUTE FUNCTION leads_update_updated_at();

-- 5. RLS on new tables
ALTER TABLE leads_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads_negocio_stage_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads_referrals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access" ON leads_entries FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON leads_negocio_stage_history FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON leads_activities FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON leads_referrals FOR ALL USING (true) WITH CHECK (true);

-- 6. Seed initial stage history for existing negocios that now have pipeline_stage_id
INSERT INTO leads_negocio_stage_history (negocio_id, stage_id, entered_at)
SELECT id, pipeline_stage_id, COALESCE(stage_entered_at, created_at)
FROM negocios WHERE pipeline_stage_id IS NOT NULL;
