-- =============================================================================
-- bulk_send_jobs — durable queue for staggered bulk sends.
--
-- Why: bulk WhatsApp / Email / property sends used to run synchronously
-- inside the request — a 10-contact send blocked the dialog for minutes
-- while we slept 8-20 s between WhatsApp messages, and the user couldn't
-- close the sheet without losing track of progress. This table moves
-- the work to a queue that an external cron drains, freeing the request
-- to return in milliseconds and letting us pace sends 1+ minute apart
-- without making the user stare at a spinner.
--
-- Design:
--   • One row per (target, channel) pair — each row is what the worker
--     would have done in one iteration of the old loop.
--   • `payload` is a self-contained JSON snapshot — the worker doesn't
--     need to look up anything else to execute.
--   • `kind` discriminates which executor to call:
--       - 'send_properties' → /api/negocios/[id]/properties/send
--       - 'send_message'    → contact-level message via internal helpers
--   • `scheduled_at` is when the worker is allowed to fire this row;
--     defaults to now() so untimed jobs run immediately on next tick.
--   • `batch_id` groups every row that came from the same submit so the
--     UI can show "5 envios agendados — ver progresso".
--   • `status` is a tiny state machine: pending → running → done|failed.
--     The transition pending→running is done with a guarded UPDATE so
--     concurrent workers can't double-execute the same row.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.bulk_send_jobs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id        uuid NOT NULL DEFAULT gen_random_uuid(),
  kind            text NOT NULL CHECK (kind IN ('send_properties', 'send_message')),
  payload         jsonb NOT NULL,
  scheduled_at    timestamptz NOT NULL DEFAULT now(),
  status          text NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'running', 'done', 'failed', 'cancelled')),
  created_by      uuid REFERENCES public.dev_users(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  started_at      timestamptz,
  completed_at    timestamptz,
  result          jsonb,
  error_message   text,
  attempts        int NOT NULL DEFAULT 0
);

-- Worker hot-path: "give me the next N due rows, oldest first".
CREATE INDEX IF NOT EXISTS bulk_send_jobs_pending_idx
  ON public.bulk_send_jobs (scheduled_at)
  WHERE status = 'pending';

-- UI: "show me everything I queued recently".
CREATE INDEX IF NOT EXISTS bulk_send_jobs_creator_idx
  ON public.bulk_send_jobs (created_by, created_at DESC);

-- UI: "load all rows for batch X to show progress".
CREATE INDEX IF NOT EXISTS bulk_send_jobs_batch_idx
  ON public.bulk_send_jobs (batch_id);

ALTER TABLE public.bulk_send_jobs ENABLE ROW LEVEL SECURITY;

-- Authenticated users can see their own jobs (UI listing). The worker
-- (service role) bypasses RLS so it sees and processes everything.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'bulk_send_jobs'
      AND policyname = 'bulk_send_jobs_select_own'
  ) THEN
    CREATE POLICY bulk_send_jobs_select_own
      ON public.bulk_send_jobs
      FOR SELECT TO authenticated
      USING (created_by = auth.uid());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'bulk_send_jobs'
      AND policyname = 'bulk_send_jobs_insert_authenticated'
  ) THEN
    CREATE POLICY bulk_send_jobs_insert_authenticated
      ON public.bulk_send_jobs
      FOR INSERT TO authenticated
      WITH CHECK (created_by = auth.uid());
  END IF;

  -- Cancellation by the original creator (sets status='cancelled').
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'bulk_send_jobs'
      AND policyname = 'bulk_send_jobs_update_own_pending'
  ) THEN
    CREATE POLICY bulk_send_jobs_update_own_pending
      ON public.bulk_send_jobs
      FOR UPDATE TO authenticated
      USING (created_by = auth.uid() AND status = 'pending')
      WITH CHECK (created_by = auth.uid());
  END IF;
END $$;
