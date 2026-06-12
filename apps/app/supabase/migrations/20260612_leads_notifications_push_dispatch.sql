-- 20260612_leads_notifications_push_dispatch.sql
--
-- Durable Web Push fallback for CRM lead notifications.
--
-- Context: `leads_notifications` already has an `is_push_sent boolean DEFAULT
-- false` column (never populated until now). The consultant CRM push for new/
-- reassigned leads was sent EAGERLY inline in the API handlers — fire-and-forget,
-- with no retry: if the eager send failed transiently or the request died, the
-- push was lost forever (the cron `/api/cron/dispatch-pending-push` only covered
-- 4 owner/AI types in the `notifications` table, never `leads_notifications`).
--
-- This migration wires `is_push_sent` into a durable fallback (the cron now also
-- scans `leads_notifications`). Eager handlers set `is_push_sent=true` on success
-- so the cron only retries the ones that slipped through.
--
-- Aditiva. Revert: DROP INDEX idx_leads_notifications_push_pending;
--         (the backfill is data-only and irreversible but harmless).

-- 1. Backfill all historical rows as already-dispatched so the new cron does NOT
--    re-send pushes for notifications created before this mechanism existed.
UPDATE public.leads_notifications
SET is_push_sent = true
WHERE is_push_sent = false;

-- 2. Partial index so the cron cheaply finds the (normally tiny) pending set.
CREATE INDEX IF NOT EXISTS idx_leads_notifications_push_pending
  ON public.leads_notifications (created_at)
  WHERE is_push_sent = false;
