-- =============================================================================
-- LEADS CRM SYSTEM — Full Schema
-- All tables prefixed with leads_
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. leads_contact_stages — Configurable contact lifecycle stages
-- -----------------------------------------------------------------------------
CREATE TABLE leads_contact_stages (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  description TEXT,
  color       TEXT NOT NULL DEFAULT '#6b7280',
  order_index INT NOT NULL DEFAULT 0,
  is_default  BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO leads_contact_stages (name, description, color, order_index, is_default) VALUES
  ('Lead',               'Contacto novo, ainda nao qualificado',      '#3b82f6', 0, true),
  ('Potencial Cliente',  'Qualificado, demonstra interesse',          '#f59e0b', 1, false),
  ('Cliente',            'Pelo menos 1 negocio activo ou fechado',    '#10b981', 2, false),
  ('Cliente Recorrente', '2 ou mais negocios fechados',               '#8b5cf6', 3, false),
  ('Inactivo',           'Sem actividade durante periodo prolongado', '#6b7280', 4, false);

-- -----------------------------------------------------------------------------
-- 2. leads_contacts — The unique person (deduplicated by phone/email/NIF)
-- -----------------------------------------------------------------------------
CREATE TABLE leads_contacts (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Identity
  full_name             TEXT NOT NULL,
  email                 TEXT,
  phone                 TEXT,
  secondary_phone       TEXT,
  nif                   TEXT,
  nationality           TEXT,
  date_of_birth         DATE,
  -- Identification document
  document_type         TEXT,  -- cc, passport, bi, etc.
  document_number       TEXT,
  document_expiry       DATE,
  document_country      TEXT,
  document_front_url    TEXT,
  document_back_url     TEXT,
  -- Address
  address               TEXT,
  postal_code           TEXT,
  city                  TEXT,
  -- Company (if applicable)
  has_company           BOOLEAN NOT NULL DEFAULT false,
  company_name          TEXT,
  company_nipc          TEXT,
  company_email         TEXT,
  company_phone         TEXT,
  company_address       TEXT,
  -- Lifecycle
  lifecycle_stage_id    UUID REFERENCES leads_contact_stages(id),
  tags                  TEXT[] NOT NULL DEFAULT '{}',
  -- Assignment
  assigned_consultant_id UUID REFERENCES dev_users(id),
  -- Source (first known source)
  first_source          TEXT,
  -- Notes
  notes                 TEXT,
  -- Meta
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for deduplication lookups
CREATE INDEX idx_leads_contacts_email ON leads_contacts(email) WHERE email IS NOT NULL;
CREATE INDEX idx_leads_contacts_phone ON leads_contacts(phone) WHERE phone IS NOT NULL;
CREATE INDEX idx_leads_contacts_nif ON leads_contacts(nif) WHERE nif IS NOT NULL;
CREATE INDEX idx_leads_contacts_lifecycle ON leads_contacts(lifecycle_stage_id);
CREATE INDEX idx_leads_contacts_consultant ON leads_contacts(assigned_consultant_id);

-- GIN index for tags array search
CREATE INDEX idx_leads_contacts_tags ON leads_contacts USING GIN(tags);

-- -----------------------------------------------------------------------------
-- 3. leads_campaigns — Campaign tracking (Meta, Google, organic, etc.)
-- -----------------------------------------------------------------------------
CREATE TABLE leads_campaigns (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                  TEXT NOT NULL,
  platform              TEXT NOT NULL,  -- meta, google, website, landing_page, other
  external_campaign_id  TEXT,           -- ID from Meta/Google
  external_adset_id     TEXT,
  external_ad_id        TEXT,
  status                TEXT NOT NULL DEFAULT 'active',  -- active, paused, ended
  budget                NUMERIC,
  start_date            DATE,
  end_date              DATE,
  notes                 TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_leads_campaigns_platform ON leads_campaigns(platform);
CREATE INDEX idx_leads_campaigns_status ON leads_campaigns(status);
CREATE INDEX idx_leads_campaigns_external ON leads_campaigns(external_campaign_id) WHERE external_campaign_id IS NOT NULL;

-- -----------------------------------------------------------------------------
-- 4. leads_partners — External referrers (magic link portal access)
-- -----------------------------------------------------------------------------
CREATE TABLE leads_partners (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                  TEXT NOT NULL,
  email                 TEXT,
  phone                 TEXT,
  company               TEXT,
  partner_type          TEXT NOT NULL DEFAULT 'outro',  -- advogado, banco, particular, agencia, construtor, outro
  -- Portal access
  magic_link_token      TEXT UNIQUE,
  magic_link_expires_at TIMESTAMPTZ,
  last_portal_access    TIMESTAMPTZ,
  -- Status
  is_active             BOOLEAN NOT NULL DEFAULT true,
  notes                 TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_leads_partners_email ON leads_partners(email) WHERE email IS NOT NULL;
CREATE INDEX idx_leads_partners_token ON leads_partners(magic_link_token) WHERE magic_link_token IS NOT NULL;

-- -----------------------------------------------------------------------------
-- 5. leads_entries — Each inbound event (form submission, call, referral, etc.)
-- -----------------------------------------------------------------------------
CREATE TABLE leads_entries (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id            UUID NOT NULL REFERENCES leads_contacts(id) ON DELETE CASCADE,
  -- Source
  source                TEXT NOT NULL,  -- meta_ads, google_ads, website, landing_page, partner, organic, walk_in, phone_call, social_media, other
  campaign_id           UUID REFERENCES leads_campaigns(id),
  partner_id            UUID REFERENCES leads_partners(id),
  -- UTM tracking
  utm_source            TEXT,
  utm_medium            TEXT,
  utm_campaign          TEXT,
  utm_content           TEXT,
  utm_term              TEXT,
  -- Raw form data
  form_data             JSONB,
  form_url              TEXT,           -- URL of the form/landing page
  -- Notes
  notes                 TEXT,
  -- Meta
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_leads_entries_contact ON leads_entries(contact_id);
CREATE INDEX idx_leads_entries_source ON leads_entries(source);
CREATE INDEX idx_leads_entries_campaign ON leads_entries(campaign_id) WHERE campaign_id IS NOT NULL;
CREATE INDEX idx_leads_entries_partner ON leads_entries(partner_id) WHERE partner_id IS NOT NULL;
CREATE INDEX idx_leads_entries_created ON leads_entries(created_at DESC);

-- -----------------------------------------------------------------------------
-- 6. leads_pipeline_stages — Configurable stages per pipeline type
-- -----------------------------------------------------------------------------
CREATE TABLE leads_pipeline_stages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_type   TEXT NOT NULL,  -- comprador, vendedor, arrendatario, arrendador
  name            TEXT NOT NULL,
  color           TEXT NOT NULL DEFAULT '#6b7280',
  order_index     INT NOT NULL DEFAULT 0,
  is_terminal     BOOLEAN NOT NULL DEFAULT false,
  terminal_type   TEXT,  -- 'won' or 'lost' (NULL if not terminal)
  probability_pct INT NOT NULL DEFAULT 0,  -- default probability for forecast
  sla_days        INT,  -- expected max days in this stage
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_terminal CHECK (
    (is_terminal = false AND terminal_type IS NULL) OR
    (is_terminal = true AND terminal_type IN ('won', 'lost'))
  )
);

CREATE INDEX idx_leads_pipeline_stages_type ON leads_pipeline_stages(pipeline_type, order_index);

-- Seed: Comprador pipeline (10 stages + won/lost)
INSERT INTO leads_pipeline_stages (pipeline_type, name, color, order_index, is_terminal, terminal_type, probability_pct, sla_days) VALUES
  ('comprador', 'Lead Recebida',    '#94a3b8', 0,  false, NULL,   5,  1),
  ('comprador', 'Contacto Inicial', '#3b82f6', 1,  false, NULL,  10,  2),
  ('comprador', 'Qualificacao',     '#6366f1', 2,  false, NULL,  20,  3),
  ('comprador', 'Pesquisa Activa',  '#8b5cf6', 3,  false, NULL,  30,  7),
  ('comprador', 'Visitas',          '#a855f7', 4,  false, NULL,  40, 14),
  ('comprador', 'Proposta',         '#f59e0b', 5,  false, NULL,  60,  5),
  ('comprador', 'Negociacao',       '#f97316', 6,  false, NULL,  75,  7),
  ('comprador', 'CPCV',             '#ef4444', 7,  false, NULL,  90, 14),
  ('comprador', 'Escritura',        '#10b981', 8,  false, NULL,  95, 30),
  ('comprador', 'Fechado',          '#059669', 9,  true,  'won', 100, NULL),
  ('comprador', 'Perdido',          '#6b7280', 10, true,  'lost',  0, NULL);

-- Seed: Vendedor pipeline (8 stages + won/lost)
INSERT INTO leads_pipeline_stages (pipeline_type, name, color, order_index, is_terminal, terminal_type, probability_pct, sla_days) VALUES
  ('vendedor', 'Lead Recebida',      '#94a3b8', 0,  false, NULL,   5,  1),
  ('vendedor', 'Contacto Inicial',   '#3b82f6', 1,  false, NULL,  10,  2),
  ('vendedor', 'Avaliacao',          '#6366f1', 2,  false, NULL,  25,  5),
  ('vendedor', 'Angariacao',         '#8b5cf6', 3,  false, NULL,  40,  7),
  ('vendedor', 'Promocao',           '#a855f7', 4,  false, NULL,  50, 30),
  ('vendedor', 'Proposta Recebida',  '#f59e0b', 5,  false, NULL,  70,  5),
  ('vendedor', 'Negociacao',         '#f97316', 6,  false, NULL,  85,  7),
  ('vendedor', 'Vendido',            '#059669', 7,  true,  'won', 100, NULL),
  ('vendedor', 'Perdido',            '#6b7280', 8,  true,  'lost',  0, NULL);

-- Seed: Arrendatario pipeline (tenant looking to rent)
INSERT INTO leads_pipeline_stages (pipeline_type, name, color, order_index, is_terminal, terminal_type, probability_pct, sla_days) VALUES
  ('arrendatario', 'Lead Recebida',    '#94a3b8', 0,  false, NULL,   5,  1),
  ('arrendatario', 'Contacto Inicial', '#3b82f6', 1,  false, NULL,  10,  2),
  ('arrendatario', 'Qualificacao',     '#6366f1', 2,  false, NULL,  20,  3),
  ('arrendatario', 'Pesquisa Activa',  '#8b5cf6', 3,  false, NULL,  30,  7),
  ('arrendatario', 'Visitas',          '#a855f7', 4,  false, NULL,  40, 10),
  ('arrendatario', 'Proposta',         '#f59e0b', 5,  false, NULL,  60,  3),
  ('arrendatario', 'Negociacao',       '#f97316', 6,  false, NULL,  75,  5),
  ('arrendatario', 'Contrato Assinado','#059669', 7,  true,  'won', 100, NULL),
  ('arrendatario', 'Perdido',          '#6b7280', 8,  true,  'lost',  0, NULL);

-- Seed: Arrendador pipeline (landlord renting out)
INSERT INTO leads_pipeline_stages (pipeline_type, name, color, order_index, is_terminal, terminal_type, probability_pct, sla_days) VALUES
  ('arrendador', 'Lead Recebida',      '#94a3b8', 0,  false, NULL,   5,  1),
  ('arrendador', 'Contacto Inicial',   '#3b82f6', 1,  false, NULL,  10,  2),
  ('arrendador', 'Avaliacao',          '#6366f1', 2,  false, NULL,  25,  5),
  ('arrendador', 'Angariacao',         '#8b5cf6', 3,  false, NULL,  40,  7),
  ('arrendador', 'Promocao',           '#a855f7', 4,  false, NULL,  50, 21),
  ('arrendador', 'Proposta Recebida',  '#f59e0b', 5,  false, NULL,  70,  3),
  ('arrendador', 'Negociacao',         '#f97316', 6,  false, NULL,  85,  5),
  ('arrendador', 'Arrendado',          '#059669', 7,  true,  'won', 100, NULL),
  ('arrendador', 'Perdido',            '#6b7280', 8,  true,  'lost',  0, NULL);

-- -----------------------------------------------------------------------------
-- 7. leads_negocios — Each deal, with its own pipeline position
-- -----------------------------------------------------------------------------
CREATE TABLE leads_negocios (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id              UUID NOT NULL REFERENCES leads_contacts(id) ON DELETE CASCADE,
  -- Pipeline
  pipeline_type           TEXT NOT NULL,  -- comprador, vendedor, arrendatario, arrendador
  pipeline_stage_id       UUID NOT NULL REFERENCES leads_pipeline_stages(id),
  stage_entered_at        TIMESTAMPTZ NOT NULL DEFAULT now(),  -- when entered current stage (for SLA tracking)
  -- Assignment
  assigned_consultant_id  UUID REFERENCES dev_users(id),
  -- Property link (optional)
  property_id             UUID REFERENCES dev_properties(id),
  -- Value & forecast
  expected_value          NUMERIC,        -- expected deal value
  probability_pct         INT,            -- override probability (NULL = use stage default)
  expected_close_date     DATE,
  -- Details (type-specific, stored as JSONB for flexibility)
  details                 JSONB NOT NULL DEFAULT '{}',
  -- Outcome
  lost_reason             TEXT,
  lost_notes              TEXT,
  won_date                TIMESTAMPTZ,
  lost_date               TIMESTAMPTZ,
  -- Notes
  notes                   TEXT,
  -- Meta
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_leads_negocios_contact ON leads_negocios(contact_id);
CREATE INDEX idx_leads_negocios_pipeline ON leads_negocios(pipeline_type, pipeline_stage_id);
CREATE INDEX idx_leads_negocios_consultant ON leads_negocios(assigned_consultant_id);
CREATE INDEX idx_leads_negocios_property ON leads_negocios(property_id) WHERE property_id IS NOT NULL;
CREATE INDEX idx_leads_negocios_created ON leads_negocios(created_at DESC);

-- -----------------------------------------------------------------------------
-- 8. leads_negocio_stage_history — Track time spent in each stage
-- -----------------------------------------------------------------------------
CREATE TABLE leads_negocio_stage_history (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  negocio_id      UUID NOT NULL REFERENCES leads_negocios(id) ON DELETE CASCADE,
  stage_id        UUID NOT NULL REFERENCES leads_pipeline_stages(id),
  entered_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  exited_at       TIMESTAMPTZ,
  moved_by        UUID REFERENCES dev_users(id)
);

CREATE INDEX idx_leads_stage_history_negocio ON leads_negocio_stage_history(negocio_id, entered_at DESC);

-- -----------------------------------------------------------------------------
-- 9. leads_activities — Unified 360 timeline
-- -----------------------------------------------------------------------------
CREATE TABLE leads_activities (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id      UUID NOT NULL REFERENCES leads_contacts(id) ON DELETE CASCADE,
  negocio_id      UUID REFERENCES leads_negocios(id) ON DELETE SET NULL,
  -- Activity
  activity_type   TEXT NOT NULL,  -- call, email, whatsapp, sms, note, visit, stage_change, assignment, lifecycle_change, system
  direction       TEXT,           -- inbound, outbound (NULL for notes/system)
  subject         TEXT,
  description     TEXT,
  -- Structured data
  metadata        JSONB,
  -- Author
  created_by      UUID REFERENCES dev_users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_leads_activities_contact ON leads_activities(contact_id, created_at DESC);
CREATE INDEX idx_leads_activities_negocio ON leads_activities(negocio_id, created_at DESC) WHERE negocio_id IS NOT NULL;
CREATE INDEX idx_leads_activities_type ON leads_activities(activity_type);

-- -----------------------------------------------------------------------------
-- 10. leads_referrals — Internal referrals + partner inbound
-- -----------------------------------------------------------------------------
CREATE TABLE leads_referrals (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id            UUID NOT NULL REFERENCES leads_contacts(id) ON DELETE CASCADE,
  negocio_id            UUID REFERENCES leads_negocios(id) ON DELETE SET NULL,
  entry_id              UUID REFERENCES leads_entries(id) ON DELETE SET NULL,
  -- Type
  referral_type         TEXT NOT NULL,  -- 'internal' or 'partner_inbound'
  -- Internal: consultant to consultant
  from_consultant_id    UUID REFERENCES dev_users(id),
  to_consultant_id      UUID REFERENCES dev_users(id),
  -- Partner inbound
  partner_id            UUID REFERENCES leads_partners(id),
  -- Status
  status                TEXT NOT NULL DEFAULT 'pending',  -- pending, accepted, rejected, converted, lost
  -- Notes
  notes                 TEXT,
  -- Meta
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_referral_type CHECK (
    (referral_type = 'internal' AND from_consultant_id IS NOT NULL AND to_consultant_id IS NOT NULL) OR
    (referral_type = 'partner_inbound' AND partner_id IS NOT NULL)
  )
);

CREATE INDEX idx_leads_referrals_contact ON leads_referrals(contact_id);
CREATE INDEX idx_leads_referrals_from ON leads_referrals(from_consultant_id) WHERE from_consultant_id IS NOT NULL;
CREATE INDEX idx_leads_referrals_to ON leads_referrals(to_consultant_id) WHERE to_consultant_id IS NOT NULL;
CREATE INDEX idx_leads_referrals_partner ON leads_referrals(partner_id) WHERE partner_id IS NOT NULL;

-- -----------------------------------------------------------------------------
-- 11. leads_tags — Predefined tags for segmentation
-- -----------------------------------------------------------------------------
CREATE TABLE leads_tags (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL UNIQUE,
  color       TEXT NOT NULL DEFAULT '#6b7280',
  category    TEXT,  -- lifecycle, interest, campaign, custom
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed some default tags
INSERT INTO leads_tags (name, color, category) VALUES
  ('VIP',                '#8b5cf6', 'lifecycle'),
  ('Investidor',         '#f59e0b', 'interest'),
  ('Primeira Habitacao', '#3b82f6', 'interest'),
  ('Urgente',            '#ef4444', 'custom'),
  ('Nao Responde',       '#6b7280', 'custom'),
  ('Reactivar',          '#f97316', 'campaign'),
  ('Financiamento',      '#10b981', 'interest'),
  ('Expatriado',         '#6366f1', 'interest');

-- -----------------------------------------------------------------------------
-- 12. leads_assignment_rules — Auto-assignment configuration
-- -----------------------------------------------------------------------------
CREATE TABLE leads_assignment_rules (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                  TEXT NOT NULL,
  -- Matching criteria
  source_match          TEXT[],           -- match these sources (NULL = any)
  campaign_id_match     UUID REFERENCES leads_campaigns(id),
  zone_match            TEXT[],           -- match these cities/zones (NULL = any)
  pipeline_type_match   TEXT[],           -- match these pipeline types (NULL = any)
  -- Assignment target
  consultant_id         UUID REFERENCES dev_users(id),
  -- Round-robin within team (if consultant_id is NULL)
  team_consultant_ids   UUID[],           -- rotate among these consultants
  -- Priority & status
  priority              INT NOT NULL DEFAULT 0,  -- higher = evaluated first
  is_active             BOOLEAN NOT NULL DEFAULT true,
  -- Meta
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- 13. Updated_at triggers
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION leads_update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_leads_contacts_updated
  BEFORE UPDATE ON leads_contacts
  FOR EACH ROW EXECUTE FUNCTION leads_update_updated_at();

CREATE TRIGGER trg_leads_negocios_updated
  BEFORE UPDATE ON leads_negocios
  FOR EACH ROW EXECUTE FUNCTION leads_update_updated_at();

CREATE TRIGGER trg_leads_campaigns_updated
  BEFORE UPDATE ON leads_campaigns
  FOR EACH ROW EXECUTE FUNCTION leads_update_updated_at();

CREATE TRIGGER trg_leads_partners_updated
  BEFORE UPDATE ON leads_partners
  FOR EACH ROW EXECUTE FUNCTION leads_update_updated_at();

CREATE TRIGGER trg_leads_referrals_updated
  BEFORE UPDATE ON leads_referrals
  FOR EACH ROW EXECUTE FUNCTION leads_update_updated_at();

-- -----------------------------------------------------------------------------
-- 14. Auto-set default lifecycle stage on contact insert
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION leads_set_default_lifecycle()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.lifecycle_stage_id IS NULL THEN
    SELECT id INTO NEW.lifecycle_stage_id
    FROM leads_contact_stages
    WHERE is_default = true
    LIMIT 1;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_leads_contacts_default_lifecycle
  BEFORE INSERT ON leads_contacts
  FOR EACH ROW EXECUTE FUNCTION leads_set_default_lifecycle();

-- -----------------------------------------------------------------------------
-- 15. Auto-record stage history on negocio stage change
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION leads_track_stage_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.pipeline_stage_id IS DISTINCT FROM NEW.pipeline_stage_id THEN
    -- Close previous stage history entry
    UPDATE leads_negocio_stage_history
    SET exited_at = now()
    WHERE negocio_id = NEW.id AND exited_at IS NULL;

    -- Open new stage history entry
    INSERT INTO leads_negocio_stage_history (negocio_id, stage_id, entered_at)
    VALUES (NEW.id, NEW.pipeline_stage_id, now());

    -- Update stage_entered_at
    NEW.stage_entered_at = now();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_leads_negocios_stage_change
  BEFORE UPDATE ON leads_negocios
  FOR EACH ROW EXECUTE FUNCTION leads_track_stage_change();

-- Also create initial history entry on insert
CREATE OR REPLACE FUNCTION leads_init_stage_history()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO leads_negocio_stage_history (negocio_id, stage_id, entered_at)
  VALUES (NEW.id, NEW.pipeline_stage_id, NEW.stage_entered_at);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_leads_negocios_init_history
  AFTER INSERT ON leads_negocios
  FOR EACH ROW EXECUTE FUNCTION leads_init_stage_history();

-- -----------------------------------------------------------------------------
-- 16. RLS Policies (basic — expand as needed)
-- -----------------------------------------------------------------------------
ALTER TABLE leads_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads_negocios ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads_referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads_partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads_pipeline_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads_contact_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads_assignment_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads_negocio_stage_history ENABLE ROW LEVEL SECURITY;

-- Service role bypass (for API route handlers using admin client)
CREATE POLICY "Service role full access" ON leads_contacts FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON leads_entries FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON leads_negocios FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON leads_activities FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON leads_referrals FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON leads_partners FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON leads_campaigns FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON leads_pipeline_stages FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON leads_contact_stages FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON leads_tags FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON leads_assignment_rules FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON leads_negocio_stage_history FOR ALL USING (true) WITH CHECK (true);
