-- Add images array to feedback_submissions
ALTER TABLE feedback_submissions
  ADD COLUMN IF NOT EXISTS images TEXT[] DEFAULT '{}';
