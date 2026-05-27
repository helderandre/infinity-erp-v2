-- ============================================================================
-- Lost reason on lead entries
--
-- The Leads pipeline "Perdido" column captures why a lead was discarded
-- (LOST_REASONS + free notes), mirroring the negócios LostReasonDialog.
-- Aditiva, nullable. Revert no fim.
-- ============================================================================

ALTER TABLE leads_entries
  ADD COLUMN IF NOT EXISTS lost_reason TEXT,
  ADD COLUMN IF NOT EXISTS lost_notes  TEXT;

-- ============================================================================
-- REVERT
-- ALTER TABLE leads_entries DROP COLUMN IF EXISTS lost_notes, DROP COLUMN IF EXISTS lost_reason;
-- ============================================================================
