-- ============================================================================
-- Calendar V2 — Event enhancements, tasks, RSVP/attendance
-- Run in Supabase Dashboard > SQL Editor
-- ============================================================================

-- 1. Add new columns to calendar_events
ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS cover_image_url text;
ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS item_type text NOT NULL DEFAULT 'event';
ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS visibility_mode text NOT NULL DEFAULT 'all';
ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS visibility_user_ids uuid[] DEFAULT '{}';
ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS visibility_role_names text[] DEFAULT '{}';
ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS location text;
ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS requires_rsvp boolean NOT NULL DEFAULT false;

-- Constraint for item_type
ALTER TABLE calendar_events DROP CONSTRAINT IF EXISTS valid_item_type;
ALTER TABLE calendar_events ADD CONSTRAINT valid_item_type CHECK (item_type IN ('event', 'task'));

-- Constraint for visibility_mode
ALTER TABLE calendar_events DROP CONSTRAINT IF EXISTS valid_visibility_mode;
ALTER TABLE calendar_events ADD CONSTRAINT valid_visibility_mode CHECK (visibility_mode IN ('all', 'include', 'exclude'));

-- Index for faster filtering
CREATE INDEX IF NOT EXISTS idx_calendar_events_item_type ON calendar_events(item_type);
CREATE INDEX IF NOT EXISTS idx_calendar_events_category ON calendar_events(category);
CREATE INDEX IF NOT EXISTS idx_calendar_events_requires_rsvp ON calendar_events(requires_rsvp) WHERE requires_rsvp = true;

-- 2. Create RSVP / Attendance table
CREATE TABLE IF NOT EXISTS calendar_event_rsvp (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES calendar_events(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES dev_users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending',
  reason text,
  responded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(event_id, user_id),
  CONSTRAINT valid_rsvp_status CHECK (status IN ('pending', 'going', 'not_going'))
);

CREATE INDEX IF NOT EXISTS idx_calendar_event_rsvp_event ON calendar_event_rsvp(event_id);
CREATE INDEX IF NOT EXISTS idx_calendar_event_rsvp_user ON calendar_event_rsvp(user_id);
CREATE INDEX IF NOT EXISTS idx_calendar_event_rsvp_status ON calendar_event_rsvp(status);

-- 3. Disable RLS on rsvp table (same as calendar_events — internal ERP)
ALTER TABLE calendar_event_rsvp DISABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 4. Event links (livestream + custom)
-- Run this after the initial migration
-- ============================================================================
ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS livestream_url text;
ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS registration_url text;
ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS links jsonb DEFAULT '[]';
ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS reminders jsonb DEFAULT '[]';
