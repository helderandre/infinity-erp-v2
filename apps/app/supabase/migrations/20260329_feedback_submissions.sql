-- ============================================================================
-- Migration: Feedback Submissions (Tickets + Ideias)
-- Unified table for bug reports and feature ideas submitted by consultores
-- ============================================================================

CREATE TABLE IF NOT EXISTS feedback_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Type: ticket (bug/issue) or ideia (feature request)
  type TEXT NOT NULL CHECK (type IN ('ticket', 'ideia')),

  -- Content
  title TEXT NOT NULL,
  description TEXT,
  voice_url TEXT,              -- R2 URL of voice recording (if submitted via voice)

  -- Pipeline status
  status TEXT NOT NULL DEFAULT 'novo' CHECK (status IN (
    'novo', 'em_analise', 'em_desenvolvimento', 'concluido', 'rejeitado'
  )),

  -- Priority (set by tech team, not submitter)
  priority INT DEFAULT 4 CHECK (priority BETWEEN 1 AND 4),

  -- Who submitted
  submitted_by UUID REFERENCES dev_users(id) ON DELETE SET NULL,

  -- Tech team notes
  tech_notes TEXT,
  assigned_to UUID REFERENCES dev_users(id) ON DELETE SET NULL,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- Indexes
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_feedback_type_status
  ON feedback_submissions(type, status);

CREATE INDEX IF NOT EXISTS idx_feedback_submitted_by
  ON feedback_submissions(submitted_by);

CREATE INDEX IF NOT EXISTS idx_feedback_assigned_to
  ON feedback_submissions(assigned_to) WHERE assigned_to IS NOT NULL;

-- ============================================================================
-- RLS
-- ============================================================================

ALTER TABLE feedback_submissions ENABLE ROW LEVEL SECURITY;

-- Service role full access
CREATE POLICY feedback_service_all ON feedback_submissions
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Anyone can submit (insert)
CREATE POLICY feedback_insert_auth ON feedback_submissions
  FOR INSERT TO authenticated
  WITH CHECK (submitted_by = auth.uid());

-- Submitters can see their own submissions
CREATE POLICY feedback_select_own ON feedback_submissions
  FOR SELECT TO authenticated
  USING (submitted_by = auth.uid());

-- ============================================================================
-- Updated_at trigger
-- ============================================================================

CREATE TRIGGER trg_feedback_updated_at
  BEFORE UPDATE ON feedback_submissions
  FOR EACH ROW
  EXECUTE FUNCTION update_tasks_updated_at();  -- reuse existing function
