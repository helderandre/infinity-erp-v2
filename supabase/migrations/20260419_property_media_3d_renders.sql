-- Add source_media_id to dev_property_media to link 3D renders back to their source plan.
-- A row with media_type='planta_3d' MUST have source_media_id pointing to the planta it was generated from.
ALTER TABLE dev_property_media
  ADD COLUMN IF NOT EXISTS source_media_id uuid REFERENCES dev_property_media(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS render_3d_style text;

CREATE INDEX IF NOT EXISTS idx_property_media_source_media_id
  ON dev_property_media (source_media_id)
  WHERE source_media_id IS NOT NULL;
