-- Allow kind='custom_event' in contact_automation_runs with proper consistency.
-- Bug introduced by commit a7a8ff4 (feat: custom commemorative events): Phase C of
-- the scheduler inserts rows with kind='custom_event' but the original CHECK
-- constraints only accepted 'manual' and 'virtual', causing every custom-event
-- spawn to fail silently (caught in the per-lead try/catch).

ALTER TABLE contact_automation_runs DROP CONSTRAINT IF EXISTS car_kind_values_check;
ALTER TABLE contact_automation_runs DROP CONSTRAINT IF EXISTS car_kind_consistency_check;

ALTER TABLE contact_automation_runs
  ADD CONSTRAINT car_kind_values_check
  CHECK (kind IN ('manual','virtual','custom_event'));

ALTER TABLE contact_automation_runs
  ADD CONSTRAINT car_kind_consistency_check
  CHECK (
    (kind = 'manual'       AND contact_automation_id IS NOT NULL) OR
    (kind = 'virtual'      AND lead_id IS NOT NULL AND event_type IS NOT NULL) OR
    (kind = 'custom_event' AND custom_event_id IS NOT NULL AND lead_id IS NOT NULL AND event_type IS NOT NULL)
  );
