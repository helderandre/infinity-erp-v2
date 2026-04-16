-- Add AI room classification columns to dev_property_media
ALTER TABLE dev_property_media
  ADD COLUMN IF NOT EXISTS ai_room_label text,
  ADD COLUMN IF NOT EXISTS ai_room_confidence numeric,
  ADD COLUMN IF NOT EXISTS ai_classified_at timestamptz;

-- Index for querying unclassified images
CREATE INDEX IF NOT EXISTS idx_property_media_ai_label
  ON dev_property_media (ai_room_label)
  WHERE ai_room_label IS NOT NULL;
