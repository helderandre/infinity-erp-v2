-- 20260603_proc_instances_is_synthetic.sql
--
-- `is_synthetic` distinguishes auto-created placeholder processes from real
-- workflow ones. Two sources currently flip it true:
--   1. The 2026-06-03 backfill of published imóveis without an existing
--      angariação (rows with notes LIKE 'Backfill 2026-06-03%').
--   2. Going forward, processes auto-created when an admin creates a property
--      directly via POST /api/properties (skipping the pedido de angariação
--      flow). Stored as completed at insert time.
--
-- Excluding `is_synthetic=true` from analytics (e.g. "média de tempo para
-- concluir um processo") keeps reports honest — these rows have no real
-- elapsed-time semantics: started_at/completed_at are the same instant or
-- mirror property metadata, not a real workflow.
--
-- The legitimate pedido-de-angariação flow (`POST /api/acquisitions`) keeps
-- the default false.
--
-- Revert: ALTER TABLE proc_instances DROP COLUMN is_synthetic;

ALTER TABLE proc_instances
  ADD COLUMN IF NOT EXISTS is_synthetic boolean NOT NULL DEFAULT false;

-- Flag the 59 rows from the 2026-06-03 backfill.
UPDATE proc_instances
SET is_synthetic = true
WHERE notes LIKE 'Backfill 2026-06-03%';

-- Partial index — analytics queries will filter is_synthetic=false; this lets
-- the planner skip synthetics cheaply when scanning by completion time.
CREATE INDEX IF NOT EXISTS idx_proc_instances_real_completed
  ON proc_instances (completed_at)
  WHERE is_synthetic = false AND current_status = 'completed';
