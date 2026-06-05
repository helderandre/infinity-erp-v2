-- Goal Activity Tracking: Verified vs Declared
-- Adds origin_type, direction, and quantity to support bulk declarations
-- and distinguish system-verified from manually declared activities.

ALTER TABLE temp_goal_activity_log
  ADD COLUMN IF NOT EXISTS origin_type TEXT NOT NULL DEFAULT 'system'
    CHECK (origin_type IN ('system', 'declared'));

ALTER TABLE temp_goal_activity_log
  ADD COLUMN IF NOT EXISTS direction TEXT
    CHECK (direction IN ('inbound', 'outbound'));

ALTER TABLE temp_goal_activity_log
  ADD COLUMN IF NOT EXISTS quantity INT NOT NULL DEFAULT 1;

-- Index for summary queries (breakdown by origin_type)
CREATE INDEX IF NOT EXISTS idx_goal_activity_origin
  ON temp_goal_activity_log(consultant_id, activity_type, origin_type, activity_date);
