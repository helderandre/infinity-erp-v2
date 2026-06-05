-- Per-agent weekly reflection on the new v2 funnel.
-- One row per (agent_id, week_start). week_start is the Monday of the ISO week.

CREATE TABLE IF NOT EXISTS public.agent_weekly_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES public.dev_users(id) ON DELETE CASCADE,
  week_start DATE NOT NULL,
  notes_wins TEXT,
  notes_challenges TEXT,
  notes_next_week TEXT,
  ai_summary TEXT,
  ai_advice JSONB,
  ai_generated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT agent_weekly_reports_unique UNIQUE (agent_id, week_start)
);

CREATE INDEX IF NOT EXISTS idx_agent_weekly_reports_agent_week
  ON public.agent_weekly_reports(agent_id, week_start DESC);

CREATE OR REPLACE FUNCTION public.set_agent_weekly_reports_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_agent_weekly_reports_updated_at ON public.agent_weekly_reports;
CREATE TRIGGER trg_agent_weekly_reports_updated_at
  BEFORE UPDATE ON public.agent_weekly_reports
  FOR EACH ROW
  EXECUTE FUNCTION public.set_agent_weekly_reports_updated_at();

ALTER TABLE public.agent_weekly_reports DISABLE ROW LEVEL SECURITY;
