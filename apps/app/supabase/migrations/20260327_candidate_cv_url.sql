-- Add CV URL and photo URL to recruitment_candidates
ALTER TABLE recruitment_candidates ADD COLUMN IF NOT EXISTS cv_url TEXT;
ALTER TABLE recruitment_candidates ADD COLUMN IF NOT EXISTS photo_url TEXT;
