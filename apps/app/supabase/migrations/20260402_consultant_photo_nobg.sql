-- Add no-background photo URL to consultant profiles
ALTER TABLE dev_consultant_profiles
  ADD COLUMN IF NOT EXISTS profile_photo_nobg_url TEXT;
