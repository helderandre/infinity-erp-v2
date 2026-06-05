-- ============================================================================
-- Migration: Feedback — opt-in push notification on resolution
-- Adds 2 columns to feedback_submissions:
--   notify_on_resolution: user opt-in flag (set on submit)
--   resolution_notification_sent_at: idempotency guard (NULL = ainda não disparou)
-- Aditiva. Existing rows ficam com FALSE — não recebem notificações retroactivas.
-- ============================================================================

ALTER TABLE feedback_submissions
  ADD COLUMN IF NOT EXISTS notify_on_resolution BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS resolution_notification_sent_at TIMESTAMPTZ;

-- Revert:
-- ALTER TABLE feedback_submissions
--   DROP COLUMN IF EXISTS notify_on_resolution,
--   DROP COLUMN IF EXISTS resolution_notification_sent_at;
