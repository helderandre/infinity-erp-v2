-- doc_types.applies_to — domains where each doc type is valid.
-- Empty array means "global" (legacy behaviour, applies to all domains).
-- Future code SHOULD filter via `applies_to @> ARRAY['<domain>']` when scoping.

ALTER TABLE doc_types
  ADD COLUMN IF NOT EXISTS applies_to text[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN doc_types.applies_to IS
  'Domain scopes: ''properties'',''leads'',''negocios'',''processes''. Empty = global.';

-- Backfill existing types with reasonable defaults inferred from category.
-- Property-centric types (Imóvel/Contratual/Jurídico*) → properties (+ negocios for contracts)
UPDATE doc_types
   SET applies_to = ARRAY['properties']
 WHERE applies_to = '{}'
   AND lower(coalesce(category, '')) IN ('imóvel', 'imovel', 'jurídico', 'juridico', 'jurídico especial', 'juridico especial');

UPDATE doc_types
   SET applies_to = ARRAY['properties', 'negocios']
 WHERE applies_to = '{}'
   AND lower(coalesce(category, '')) = 'contratual';

-- Owner identification docs (CC, NIF, comprovativos) often shared across leads/negocios
UPDATE doc_types
   SET applies_to = ARRAY['properties', 'leads', 'negocios']
 WHERE applies_to = '{}'
   AND lower(coalesce(category, '')) IN ('proprietário', 'proprietario', 'proprietário empresa', 'proprietario empresa');

-- Anything else stays empty (treated as "global / pick anywhere") to preserve
-- legacy classify behaviour.
