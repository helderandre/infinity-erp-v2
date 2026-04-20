-- ============================================================================
-- Phase 2 of public booking:
--  · Booking windows (date ranges during which booking is open)
--  · Per-date overrides (block a specific day OR set custom hours)
--  · Classification of the prospect (private vs consultant of another agency)
-- ============================================================================

-- ─── Booking windows ────────────────────────────────────────────────────────
-- If ANY active row exists for a consultant (or a property), the booking date
-- MUST fall within at least one of those ranges to be allowed. If no rows exist
-- at that level, there is no window restriction.

CREATE TABLE IF NOT EXISTS consultant_booking_windows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  consultant_id uuid NOT NULL REFERENCES dev_users(id) ON DELETE CASCADE,
  start_date date NOT NULL,
  end_date date NOT NULL,
  note text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT consultant_window_valid_range CHECK (end_date >= start_date)
);

CREATE INDEX IF NOT EXISTS idx_consultant_windows_consultant
  ON consultant_booking_windows (consultant_id, start_date, end_date)
  WHERE active = true;

CREATE TABLE IF NOT EXISTS property_booking_windows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES dev_properties(id) ON DELETE CASCADE,
  start_date date NOT NULL,
  end_date date NOT NULL,
  note text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT property_window_valid_range CHECK (end_date >= start_date)
);

CREATE INDEX IF NOT EXISTS idx_property_windows_property
  ON property_booking_windows (property_id, start_date, end_date)
  WHERE active = true;

-- ─── Date-specific overrides ────────────────────────────────────────────────
-- Per-date rule that overrides the weekly recurring schedule for that day.
-- Can either fully block the day OR set a custom start/end window.
-- Property-level overrides, when present for a given date, REPLACE any
-- consultant-level override for that same date.

CREATE TABLE IF NOT EXISTS consultant_date_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  consultant_id uuid NOT NULL REFERENCES dev_users(id) ON DELETE CASCADE,
  override_date date NOT NULL,
  blocked boolean NOT NULL DEFAULT false,
  start_time time,
  end_time time,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT consultant_override_unique UNIQUE (consultant_id, override_date),
  CONSTRAINT consultant_override_hours_if_unblocked CHECK (
    (blocked = true AND start_time IS NULL AND end_time IS NULL)
    OR (blocked = false AND start_time IS NOT NULL AND end_time IS NOT NULL AND end_time > start_time)
  )
);

CREATE INDEX IF NOT EXISTS idx_consultant_overrides_consultant
  ON consultant_date_overrides (consultant_id, override_date);

CREATE TABLE IF NOT EXISTS property_date_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES dev_properties(id) ON DELETE CASCADE,
  override_date date NOT NULL,
  blocked boolean NOT NULL DEFAULT false,
  start_time time,
  end_time time,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT property_override_unique UNIQUE (property_id, override_date),
  CONSTRAINT property_override_hours_if_unblocked CHECK (
    (blocked = true AND start_time IS NULL AND end_time IS NULL)
    OR (blocked = false AND start_time IS NOT NULL AND end_time IS NOT NULL AND end_time > start_time)
  )
);

CREATE INDEX IF NOT EXISTS idx_property_overrides_property
  ON property_date_overrides (property_id, override_date);

-- ─── Prospect classification on visits ──────────────────────────────────────
-- For public bookings we need to distinguish a private prospect from a
-- consultant representing another agency (RE/MAX, ERA, etc.).
-- When client_type = 'consultant', client_agency should be filled.

ALTER TABLE visits
  ADD COLUMN IF NOT EXISTS client_type text NOT NULL DEFAULT 'private'
    CHECK (client_type IN ('private', 'consultant')),
  ADD COLUMN IF NOT EXISTS client_agency text;
