-- 20260627_training_watched_segments.sql
--
-- Adds per-second watched-coverage tracking to training video lessons so that
-- the "Concluir" action only unlocks when the learner has actually played back
-- ~95% of the DISTINCT video content. Coverage is immune to seeking ahead
-- (skipped ranges stay uncovered) and to 2x playback speed (buckets are
-- content-seconds, not wall-clock). The merged [start,end) intervals are stored
-- so coverage accumulates across multiple sittings — the heartbeat endpoint
-- unions the new client intervals with whatever is already persisted.
--
-- Aditive / NULL-safe: existing rows default to '[]' and keep their current
-- video_watch_percent (now reinterpreted as coverage %, which only ever grows
-- via MAX, so nothing regresses).
--
-- Revert:
--   ALTER TABLE public.forma_training_lesson_progress DROP COLUMN IF EXISTS watched_segments;

ALTER TABLE public.forma_training_lesson_progress
  ADD COLUMN IF NOT EXISTS watched_segments jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.forma_training_lesson_progress.watched_segments IS
  'Merged [start,end) integer-second intervals of distinct video content actually watched. Drives the coverage %% completion gate (anti-skip, speed-proof). Accumulates across sessions via server-side union.';
