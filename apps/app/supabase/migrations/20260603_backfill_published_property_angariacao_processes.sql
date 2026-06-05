-- 20260603_backfill_published_property_angariacao_processes.sql
--
-- Backfill: every "published" imóvel (status ∈ {active, Ativo, reserved, sold})
-- gets a `proc_instances` row of `process_type='angariacao'` already at 100%
-- completion. The directive from the stakeholder: "make all imoveis have a
-- processo. if we have imóveis and the system that are publishd, create a
-- processo de angariação for them and put it at 100% completion".
--
-- Rules:
--   • Only properties WITHOUT an existing non-deleted angariacao process are
--     backfilled (idempotent — safe to re-run).
--   • `current_status='completed'`, `percent_complete=100`, `started_at` =
--     property created_at (kept for audit), `completed_at`/`approved_at` =
--     now().
--   • `requested_by` and `approved_by` derived from `dev_properties.consultant_id`;
--     left NULL when absent (FK is nullable, no orphan refs in current data).
--   • `tpl_process_id` left NULL — these are historical placeholders, not
--     instantiated from a template, so no tasks are populated.
--   • `external_ref` populated automatically by the BEFORE INSERT trigger
--     `trg_generate_proc_ref` (PROC-YYYY-XXXX).
--
-- Revert: `DELETE FROM proc_instances WHERE process_type='angariacao' AND
-- tpl_process_id IS NULL AND notes='Backfill 2026-06-03: angariação histórica
-- de imóvel publicado sem processo associado.'`. The `notes` discriminator
-- isolates these rows from any future manually-created template-less
-- processes.

INSERT INTO proc_instances (
  property_id,
  process_type,
  tpl_process_id,
  current_status,
  percent_complete,
  requested_by,
  approved_by,
  approved_at,
  started_at,
  completed_at,
  notes
)
SELECT
  p.id,
  'angariacao',
  NULL,
  'completed',
  100,
  p.consultant_id,
  p.consultant_id,
  now(),
  COALESCE(p.created_at, now()),
  now(),
  'Backfill 2026-06-03: angariação histórica de imóvel publicado sem processo associado.'
FROM dev_properties p
WHERE p.status IN ('active','Ativo','reserved','sold')
  AND NOT EXISTS (
    SELECT 1 FROM proc_instances pi
    WHERE pi.property_id = p.id
      AND pi.process_type = 'angariacao'
      AND pi.deleted_at IS NULL
  );
