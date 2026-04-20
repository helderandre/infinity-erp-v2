-- ============================================================================
-- Public booking (cal.com-style visit request from public property link)
-- ============================================================================

-- Weekly availability rules per consultant (the base schedule).
-- Multiple rows per day allowed (e.g., 09:00-13:00 + 14:00-18:00).
CREATE TABLE IF NOT EXISTS consultant_availability_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  consultant_id uuid NOT NULL REFERENCES dev_users(id) ON DELETE CASCADE,
  day_of_week smallint NOT NULL CHECK (day_of_week BETWEEN 0 AND 6), -- 0=Sun ... 6=Sat
  start_time time NOT NULL,
  end_time time NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT consultant_rule_valid_range CHECK (end_time > start_time)
);

CREATE INDEX IF NOT EXISTS idx_consultant_availability_consultant
  ON consultant_availability_rules (consultant_id)
  WHERE active = true;

-- Per-consultant booking settings (1:1 with consultant).
CREATE TABLE IF NOT EXISTS consultant_booking_settings (
  consultant_id uuid PRIMARY KEY REFERENCES dev_users(id) ON DELETE CASCADE,
  slot_duration_minutes integer NOT NULL DEFAULT 30
    CHECK (slot_duration_minutes BETWEEN 5 AND 240),
  buffer_minutes integer NOT NULL DEFAULT 0
    CHECK (buffer_minutes BETWEEN 0 AND 240),
  advance_days integer NOT NULL DEFAULT 30
    CHECK (advance_days BETWEEN 1 AND 180),
  min_notice_hours integer NOT NULL DEFAULT 24
    CHECK (min_notice_hours BETWEEN 0 AND 168),
  public_booking_enabled boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Per-property availability overrides.
-- When any active row exists for a property, these REPLACE the consultant's
-- rules for that property (not intersect).
CREATE TABLE IF NOT EXISTS property_availability_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES dev_properties(id) ON DELETE CASCADE,
  day_of_week smallint NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time time NOT NULL,
  end_time time NOT NULL,
  active boolean NOT NULL DEFAULT true,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT property_rule_valid_range CHECK (end_time > start_time)
);

CREATE INDEX IF NOT EXISTS idx_property_availability_property
  ON property_availability_rules (property_id)
  WHERE active = true;

-- Extend visits for public booking traceability + cancel/reschedule tokens.
ALTER TABLE visits
  ADD COLUMN IF NOT EXISTS booking_source text NOT NULL DEFAULT 'internal'
    CHECK (booking_source IN ('internal', 'public')),
  ADD COLUMN IF NOT EXISTS public_token uuid;

-- Unique token when present (avoid collisions); nullable in general.
CREATE UNIQUE INDEX IF NOT EXISTS idx_visits_public_token
  ON visits (public_token)
  WHERE public_token IS NOT NULL;

-- Speeds up slot conflict detection when generating available slots
-- (looking for visits on a given consultant in a date range).
CREATE INDEX IF NOT EXISTS idx_visits_consultant_date_status
  ON visits (consultant_id, visit_date)
  WHERE status IN ('proposal', 'scheduled');
