-- Migration: Onboarding Pipeline & Form-Candidate Linking
-- Date: 2026-03-27

-- 1. Add candidate_id to entry submissions (link form → candidate)
ALTER TABLE recruitment_entry_submissions
  ADD COLUMN IF NOT EXISTS candidate_id UUID REFERENCES recruitment_candidates(id);

CREATE INDEX IF NOT EXISTS idx_entry_submissions_candidate
  ON recruitment_entry_submissions(candidate_id);

-- 2. Extend recruitment_onboarding with pipeline fields
ALTER TABLE recruitment_onboarding
  -- Contract tracking: Sede (two tracks)
  ADD COLUMN IF NOT EXISTS contract_sede_status TEXT DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS contract_sede_url TEXT,
  ADD COLUMN IF NOT EXISTS contract_sede_requested_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS contract_sede_signed_at TIMESTAMPTZ,
  -- Contract tracking: Ours
  ADD COLUMN IF NOT EXISTS contract_ours_status TEXT DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS contract_ours_url TEXT,
  ADD COLUMN IF NOT EXISTS contract_ours_generated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS contract_ours_signed_at TIMESTAMPTZ,
  -- Access creation
  ADD COLUMN IF NOT EXISTS accesses_created BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS remax_access_requested BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS remax_access_granted BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS app_access_created BOOLEAN DEFAULT false,
  -- Email & Materials
  ADD COLUMN IF NOT EXISTS email_created BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS email_address TEXT,
  ADD COLUMN IF NOT EXISTS email_signature_generated BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS materials_ready BOOLEAN DEFAULT false,
  -- Training
  ADD COLUMN IF NOT EXISTS initial_training_completed BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS initial_training_date DATE,
  ADD COLUMN IF NOT EXISTS plan_66_started BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS plan_66_start_date DATE,
  -- Current stage (auto-calculated but cached)
  ADD COLUMN IF NOT EXISTS current_stage TEXT DEFAULT 'form_submitted';
