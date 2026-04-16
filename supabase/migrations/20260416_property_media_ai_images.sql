-- Add AI-generated image URLs to dev_property_media
ALTER TABLE dev_property_media
  ADD COLUMN IF NOT EXISTS ai_enhanced_url text,
  ADD COLUMN IF NOT EXISTS ai_staged_url text,
  ADD COLUMN IF NOT EXISTS ai_staged_style text;
