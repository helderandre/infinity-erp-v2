-- Add proposal/approval workflow to temp_partners
ALTER TABLE temp_partners
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'approved'
    CHECK (status IN ('pending', 'approved', 'rejected')),
  ADD COLUMN IF NOT EXISTS submitted_by UUID REFERENCES dev_users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES dev_users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

UPDATE temp_partners
SET submitted_by = created_by
WHERE submitted_by IS NULL AND created_by IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_temp_partners_status ON temp_partners(status);
CREATE INDEX IF NOT EXISTS idx_temp_partners_submitted_by ON temp_partners(submitted_by);

COMMENT ON COLUMN temp_partners.status IS 'Proposal state: pending (submitted by consultor, awaiting staff), approved (visible per visibility), rejected (review failed)';
COMMENT ON COLUMN temp_partners.submitted_by IS 'User who proposed the partner. For staff-created partners, usually equals created_by.';
COMMENT ON COLUMN temp_partners.reviewed_by IS 'Staff user who approved or rejected the proposal.';
COMMENT ON COLUMN temp_partners.rejection_reason IS 'Reason surfaced to the submitter when status = rejected.';
