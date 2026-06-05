-- =============================================================================
-- CRM Lead Distribution & SLA System
-- Adds: entry_id on negocios, SLA tracking on entries, sector support,
--        notifications table, campaign sector, assignment rule improvements
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Add entry_id to negocios — link deals to the entry that generated them
-- -----------------------------------------------------------------------------
ALTER TABLE negocios ADD COLUMN IF NOT EXISTS entry_id UUID REFERENCES leads_entries(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_negocios_entry ON negocios(entry_id) WHERE entry_id IS NOT NULL;

COMMENT ON COLUMN negocios.entry_id IS 'The lead entry (acquisition event) that originated this deal. Used for campaign attribution and conversion tracking.';

-- -----------------------------------------------------------------------------
-- 2. Add SLA & assignment fields to leads_entries
-- -----------------------------------------------------------------------------
ALTER TABLE leads_entries ADD COLUMN IF NOT EXISTS assigned_agent_id UUID REFERENCES dev_users(id);
ALTER TABLE leads_entries ADD COLUMN IF NOT EXISTS sector TEXT;
ALTER TABLE leads_entries ADD COLUMN IF NOT EXISTS is_reactivation BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE leads_entries ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'new';
ALTER TABLE leads_entries ADD COLUMN IF NOT EXISTS sla_deadline TIMESTAMPTZ;
ALTER TABLE leads_entries ADD COLUMN IF NOT EXISTS first_contact_at TIMESTAMPTZ;
ALTER TABLE leads_entries ADD COLUMN IF NOT EXISTS sla_status TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE leads_entries ADD COLUMN IF NOT EXISTS priority TEXT NOT NULL DEFAULT 'medium';

CREATE INDEX IF NOT EXISTS idx_leads_entries_agent ON leads_entries(assigned_agent_id) WHERE assigned_agent_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_leads_entries_sector ON leads_entries(sector) WHERE sector IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_leads_entries_sla ON leads_entries(sla_status, sla_deadline) WHERE sla_status != 'completed';
CREATE INDEX IF NOT EXISTS idx_leads_entries_status ON leads_entries(status);

COMMENT ON COLUMN leads_entries.sector IS 'Business sector: real_estate_buy, real_estate_sell, real_estate_rent, recruitment, credit, other';
COMMENT ON COLUMN leads_entries.is_reactivation IS 'True if the contact already existed when this entry was created';
COMMENT ON COLUMN leads_entries.status IS 'Entry lifecycle: new, contacted, qualified, converted, archived, expired';
COMMENT ON COLUMN leads_entries.sla_status IS 'SLA tracking: pending, on_time, warning, breached, completed';

-- -----------------------------------------------------------------------------
-- 3. Add sector to leads_campaigns
-- -----------------------------------------------------------------------------
ALTER TABLE leads_campaigns ADD COLUMN IF NOT EXISTS sector TEXT;
ALTER TABLE leads_campaigns ADD COLUMN IF NOT EXISTS description TEXT;

COMMENT ON COLUMN leads_campaigns.sector IS 'Default sector for leads from this campaign';

-- -----------------------------------------------------------------------------
-- 4. Enhance leads_assignment_rules
-- -----------------------------------------------------------------------------
ALTER TABLE leads_assignment_rules ADD COLUMN IF NOT EXISTS sector_match TEXT[];
ALTER TABLE leads_assignment_rules ADD COLUMN IF NOT EXISTS overflow_threshold INT;
ALTER TABLE leads_assignment_rules ADD COLUMN IF NOT EXISTS fallback_action TEXT NOT NULL DEFAULT 'gestora_pool';
ALTER TABLE leads_assignment_rules ADD COLUMN IF NOT EXISTS round_robin_index INT NOT NULL DEFAULT 0;
ALTER TABLE leads_assignment_rules ADD COLUMN IF NOT EXISTS description TEXT;

COMMENT ON COLUMN leads_assignment_rules.overflow_threshold IS 'Max active (uncontacted) leads per agent before overflow to next rule';
COMMENT ON COLUMN leads_assignment_rules.fallback_action IS 'What happens when no agent is available: gestora_pool, round_robin, skip';
COMMENT ON COLUMN leads_assignment_rules.round_robin_index IS 'Current position in team_consultant_ids rotation (auto-incremented)';

-- -----------------------------------------------------------------------------
-- 5. SLA configuration table
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS leads_sla_configs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  -- Matching criteria (NULL = match any)
  source_match    TEXT[],           -- match these entry sources
  sector_match    TEXT[],           -- match these sectors
  priority_match  TEXT[],           -- match these priorities
  -- SLA timing
  sla_minutes     INT NOT NULL DEFAULT 1440,  -- default 24h
  -- Warning thresholds (percentages of sla_minutes)
  warning_pct     INT NOT NULL DEFAULT 50,    -- notify agent at 50%
  critical_pct    INT NOT NULL DEFAULT 100,   -- notify gestora at 100%
  escalate_pct    INT NOT NULL DEFAULT 150,   -- auto-reassign at 150%
  -- Status
  is_active       BOOLEAN NOT NULL DEFAULT true,
  priority        INT NOT NULL DEFAULT 0,     -- higher = evaluated first
  -- Meta
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_leads_sla_configs_updated
  BEFORE UPDATE ON leads_sla_configs FOR EACH ROW EXECUTE FUNCTION leads_update_updated_at();

ALTER TABLE leads_sla_configs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access" ON leads_sla_configs FOR ALL USING (true) WITH CHECK (true);

-- Seed default SLA configs
INSERT INTO leads_sla_configs (name, source_match, priority_match, sla_minutes, warning_pct, critical_pct, escalate_pct, priority) VALUES
  ('Meta Ads — Urgente',  ARRAY['meta_ads'],  ARRAY['urgent'],  30,   50, 100, 150, 100),
  ('Meta Ads — Normal',   ARRAY['meta_ads'],  NULL,             120,  50, 100, 150, 90),
  ('Google Ads',          ARRAY['google_ads'], NULL,             240,  50, 100, 150, 80),
  ('Website / Landing',   ARRAY['website', 'landing_page'], NULL, 480, 50, 100, 150, 70),
  ('Parceiro',            ARRAY['partner'],   NULL,             1440, 50, 100, 150, 60),
  ('Default',             NULL,               NULL,             1440, 50, 100, 150, 0);

-- -----------------------------------------------------------------------------
-- 6. Notifications table
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS leads_notifications (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Recipient
  recipient_id    UUID NOT NULL REFERENCES dev_users(id) ON DELETE CASCADE,
  -- Content
  type            TEXT NOT NULL,  -- sla_warning, sla_breach, sla_escalation, new_lead, assignment, system
  title           TEXT NOT NULL,
  body            TEXT,
  -- Links
  link            TEXT,           -- in-app route, e.g. /dashboard/crm/contactos/uuid
  entry_id        UUID REFERENCES leads_entries(id) ON DELETE SET NULL,
  contact_id      UUID REFERENCES leads(id) ON DELETE SET NULL,
  negocio_id      UUID REFERENCES negocios(id) ON DELETE SET NULL,
  -- State
  is_read         BOOLEAN NOT NULL DEFAULT false,
  read_at         TIMESTAMPTZ,
  is_email_sent   BOOLEAN NOT NULL DEFAULT false,
  is_push_sent    BOOLEAN NOT NULL DEFAULT false,
  -- Meta
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_leads_notifications_recipient ON leads_notifications(recipient_id, is_read, created_at DESC);
CREATE INDEX idx_leads_notifications_entry ON leads_notifications(entry_id) WHERE entry_id IS NOT NULL;
CREATE INDEX idx_leads_notifications_unread ON leads_notifications(recipient_id, created_at DESC) WHERE is_read = false;

ALTER TABLE leads_notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access" ON leads_notifications FOR ALL USING (true) WITH CHECK (true);

-- Users can read their own notifications
CREATE POLICY "Users read own notifications" ON leads_notifications
  FOR SELECT USING (auth.uid() = recipient_id);
CREATE POLICY "Users update own notifications" ON leads_notifications
  FOR UPDATE USING (auth.uid() = recipient_id);

-- -----------------------------------------------------------------------------
-- 7. Campaign metrics cache (for Meta/Google API data)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS leads_campaign_metrics (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id     UUID NOT NULL REFERENCES leads_campaigns(id) ON DELETE CASCADE,
  -- Time period
  date            DATE NOT NULL,
  -- Platform metrics (from Meta/Google API)
  impressions     INT,
  clicks          INT,
  spend           NUMERIC,        -- in EUR
  platform_leads  INT,            -- leads reported by platform
  ctr             NUMERIC,        -- click-through rate
  cpl             NUMERIC,        -- cost per lead (platform-reported)
  -- ERP-derived metrics (calculated by our system)
  erp_entries     INT,            -- actual entries received in ERP
  erp_contacted   INT,            -- entries where first_contact_at IS NOT NULL
  erp_qualified   INT,            -- entries with status = qualified
  erp_converted   INT,            -- entries with status = converted (became negocio)
  erp_won         INT,            -- negocios in terminal won stage
  erp_revenue     NUMERIC,        -- total expected_value of won deals
  -- Meta
  synced_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(campaign_id, date)
);

CREATE INDEX idx_leads_campaign_metrics_campaign ON leads_campaign_metrics(campaign_id, date DESC);

ALTER TABLE leads_campaign_metrics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access" ON leads_campaign_metrics FOR ALL USING (true) WITH CHECK (true);

-- -----------------------------------------------------------------------------
-- 8. Agent active lead counter (materialized for routing performance)
-- -----------------------------------------------------------------------------
ALTER TABLE dev_users ADD COLUMN IF NOT EXISTS active_lead_count INT NOT NULL DEFAULT 0;

COMMENT ON COLUMN dev_users.active_lead_count IS 'Count of uncontacted lead entries assigned to this agent. Updated by triggers/cron for routing decisions.';

-- Function to recalculate active lead count for an agent
CREATE OR REPLACE FUNCTION recalc_agent_lead_count(agent_uuid UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE dev_users
  SET active_lead_count = (
    SELECT COUNT(*)
    FROM leads_entries
    WHERE assigned_agent_id = agent_uuid
      AND status = 'new'
      AND first_contact_at IS NULL
  )
  WHERE id = agent_uuid;
END;
$$ LANGUAGE plpgsql;

-- Trigger: update count when entry is assigned or status changes
CREATE OR REPLACE FUNCTION leads_entries_update_agent_count()
RETURNS TRIGGER AS $$
BEGIN
  -- Recalc for old agent (if changed)
  IF TG_OP = 'UPDATE' AND OLD.assigned_agent_id IS DISTINCT FROM NEW.assigned_agent_id THEN
    IF OLD.assigned_agent_id IS NOT NULL THEN
      PERFORM recalc_agent_lead_count(OLD.assigned_agent_id);
    END IF;
  END IF;
  -- Recalc for current agent
  IF NEW.assigned_agent_id IS NOT NULL THEN
    PERFORM recalc_agent_lead_count(NEW.assigned_agent_id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_leads_entries_agent_count ON leads_entries;
CREATE TRIGGER trg_leads_entries_agent_count
  AFTER INSERT OR UPDATE OF assigned_agent_id, status, first_contact_at ON leads_entries
  FOR EACH ROW EXECUTE FUNCTION leads_entries_update_agent_count();

-- Also handle deletes
CREATE OR REPLACE FUNCTION leads_entries_delete_agent_count()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.assigned_agent_id IS NOT NULL THEN
    PERFORM recalc_agent_lead_count(OLD.assigned_agent_id);
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_leads_entries_agent_count_delete ON leads_entries;
CREATE TRIGGER trg_leads_entries_agent_count_delete
  AFTER DELETE ON leads_entries
  FOR EACH ROW EXECUTE FUNCTION leads_entries_delete_agent_count();

-- -----------------------------------------------------------------------------
-- 9. Initialize active_lead_count for existing agents
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  agent RECORD;
BEGIN
  FOR agent IN SELECT DISTINCT assigned_agent_id FROM leads_entries WHERE assigned_agent_id IS NOT NULL LOOP
    PERFORM recalc_agent_lead_count(agent.assigned_agent_id);
  END LOOP;
END $$;
