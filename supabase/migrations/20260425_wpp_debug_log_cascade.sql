-- ============================================================================
-- Migration: Fix wpp_debug_log FK so deleting an instance cascades
-- ============================================================================
-- Previously `wpp_debug_log.instance_id` referenced `auto_wpp_instances(id)`
-- with NO ACTION, which blocked any attempt to delete an instance whose
-- debug logs had not been cleaned up first. Debug logs are transient
-- diagnostics — drop them with the instance.
-- ============================================================================

ALTER TABLE wpp_debug_log
  DROP CONSTRAINT IF EXISTS wpp_debug_log_instance_id_fkey;

ALTER TABLE wpp_debug_log
  ADD CONSTRAINT wpp_debug_log_instance_id_fkey
  FOREIGN KEY (instance_id)
  REFERENCES auto_wpp_instances(id)
  ON DELETE CASCADE;
