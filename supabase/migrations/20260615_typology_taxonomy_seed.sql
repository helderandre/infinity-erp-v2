-- Normalize and seed taxonomy_extras for `typology`. Canonical list lives in
-- code as T0..T6. Non-canonical legacy values become extras so the dropdown
-- still surfaces them (admins can deactivate later).

BEGIN;

-- Normalize empty strings to NULL (otherwise the picker shows '' as a value)
UPDATE dev_property_specifications
SET typology = NULL
WHERE typology IS NOT NULL AND trim(typology) = '';

-- Seed extras for the values present in DB that aren't in T0..T6
INSERT INTO taxonomy_extras (scope, value, label, is_active, sort_order)
VALUES
  ('typology', 'T6+',  'T6+',  true, 100),
  ('typology', 'T3+1', 'T3+1', true, 110)
ON CONFLICT (scope, value) DO NOTHING;

COMMIT;
