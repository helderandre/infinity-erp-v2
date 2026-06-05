-- ══════════════════════════════════════════════════════════════
-- Training — Completion source + resume position
-- ══════════════════════════════════════════════════════════════
-- Adds two columns to forma_training_lesson_progress:
--   * completion_source  — audit trail of HOW a lesson reached status='completed'
--   * last_video_position_seconds — resume-from-position (distinct from
--     video_watched_seconds which is the max cumulative).
--
-- Both are additive and NULL-safe for historical rows.

ALTER TABLE forma_training_lesson_progress
  ADD COLUMN IF NOT EXISTS completion_source TEXT NULL,
  ADD COLUMN IF NOT EXISTS last_video_position_seconds INTEGER NOT NULL DEFAULT 0;

-- CHECK: allowed values for completion_source (or NULL for historical rows)
ALTER TABLE forma_training_lesson_progress
  DROP CONSTRAINT IF EXISTS forma_training_lesson_progress_completion_source_check;

ALTER TABLE forma_training_lesson_progress
  ADD CONSTRAINT forma_training_lesson_progress_completion_source_check
  CHECK (
    completion_source IS NULL
    OR completion_source IN ('auto_watch', 'manual', 'admin_override', 'quiz_pass')
  );

-- Index to speed up course-wide aggregations (GROUP BY lesson_id).
-- Existing UNIQUE(user_id, lesson_id) index is leading with user_id so doesn't
-- serve lesson_id-first queries efficiently.
CREATE INDEX IF NOT EXISTS idx_forma_lesson_progress_lesson
  ON forma_training_lesson_progress (lesson_id);

COMMENT ON COLUMN forma_training_lesson_progress.completion_source IS
  'How the lesson reached status=completed: auto_watch (>=90% via heartbeat), manual (user clicked Concluir with >=90%), admin_override (broker forced completion), quiz_pass (quiz-type lesson passed). NULL for historical rows.';

COMMENT ON COLUMN forma_training_lesson_progress.last_video_position_seconds IS
  'Last playback position (seconds). Used to resume video on return. Distinct from video_watched_seconds which is the max cumulative progress.';
