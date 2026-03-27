-- Weekly Reports: consultant weekly submissions + manager review + AI coaching
-- Supports the weekly accountability rhythm between consultants and managers

CREATE TABLE IF NOT EXISTS weekly_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  consultant_id UUID NOT NULL REFERENCES dev_users(id) ON DELETE CASCADE,
  goal_id UUID REFERENCES temp_consultant_goals(id) ON DELETE SET NULL,
  week_start DATE NOT NULL, -- always a Monday

  -- Consultant reflection
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'reviewed')),
  notes_wins TEXT,            -- "O que correu bem"
  notes_challenges TEXT,      -- "Dificuldades"
  notes_next_week TEXT,       -- "Plano próxima semana"
  submitted_at TIMESTAMPTZ,

  -- Manager review
  manager_feedback TEXT,
  manager_reviewed_at TIMESTAMPTZ,
  manager_reviewed_by UUID REFERENCES dev_users(id) ON DELETE SET NULL,

  -- AI-generated content
  ai_summary TEXT,            -- auto-generated week summary
  ai_advice TEXT,             -- personalised coaching advice

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- One report per consultant per week
  UNIQUE(consultant_id, week_start)
);

-- Index for manager team view (all reports for a given week)
CREATE INDEX IF NOT EXISTS idx_weekly_reports_week ON weekly_reports(week_start, status);
CREATE INDEX IF NOT EXISTS idx_weekly_reports_consultant ON weekly_reports(consultant_id, week_start DESC);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_weekly_reports_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_weekly_reports_updated_at
  BEFORE UPDATE ON weekly_reports
  FOR EACH ROW
  EXECUTE FUNCTION update_weekly_reports_updated_at();

-- RLS
ALTER TABLE weekly_reports ENABLE ROW LEVEL SECURITY;

-- Consultants can see their own reports
CREATE POLICY weekly_reports_select_own ON weekly_reports
  FOR SELECT USING (consultant_id = auth.uid());

-- Managers/admins can see all reports
CREATE POLICY weekly_reports_select_manager ON weekly_reports
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON r.id = ur.role_id
      WHERE ur.user_id = auth.uid()
        AND r.name IN ('admin', 'Broker/CEO', 'team_leader', 'Consultora Executiva')
    )
  );

-- Consultants can insert/update their own
CREATE POLICY weekly_reports_insert_own ON weekly_reports
  FOR INSERT WITH CHECK (consultant_id = auth.uid());

CREATE POLICY weekly_reports_update_own ON weekly_reports
  FOR UPDATE USING (consultant_id = auth.uid());

-- Managers can update any (for feedback)
CREATE POLICY weekly_reports_update_manager ON weekly_reports
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON r.id = ur.role_id
      WHERE ur.user_id = auth.uid()
        AND r.name IN ('admin', 'Broker/CEO', 'team_leader', 'Consultora Executiva')
    )
  );
