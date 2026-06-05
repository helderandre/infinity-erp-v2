-- Unify property_type / tipo_imovel taxonomy. Both columns now store the
-- LABEL directly (e.g. 'Apartamento', 'Prédio') — same convention the CRM
-- world already used. The imóveis world is migrated from slugs to labels.
--
-- After this, both forms share a single canonical list in code
-- (lib/constants.ts PROPERTY_TYPES) + a single taxonomy_extras scope
-- ('property_type'). Adding "Prédio" via "Outro…" anywhere reaches both.

BEGIN;

-- 1) dev_properties.property_type: slugs → labels + normalize edge cases
UPDATE dev_properties SET property_type = CASE
  WHEN property_type = 'apartamento' THEN 'Apartamento'
  WHEN property_type = 'moradia'     THEN 'Moradia'
  WHEN property_type = 'terreno'     THEN 'Terreno'
  WHEN property_type = 'escritorio'  THEN 'Escritório'
  WHEN property_type = 'loja'        THEN 'Loja'
  WHEN property_type = 'armazem'     THEN 'Armazém'
  WHEN property_type = 'garagem'     THEN 'Garagem'
  WHEN property_type = 'quintinha'   THEN 'Quintinha'
  WHEN property_type = ''            THEN NULL
  WHEN property_type = 'outro'       THEN NULL  -- meaningless legacy sentinel
  ELSE property_type  -- already a label or unknown free-text — keep
END;

-- 2) negocios.tipo_imovel: just collapse empty strings to NULL
UPDATE negocios SET tipo_imovel = NULL
WHERE tipo_imovel IS NOT NULL AND trim(tipo_imovel) = '';

-- 3) Convert the pre-existing slug-format extra (from earlier testing) to
--    label format. Uses upsert to be idempotent if rerun.
UPDATE taxonomy_extras
SET value = 'Prédio'
WHERE scope = 'property_type' AND value = 'predio';

-- 4) Seed taxonomy_extras for the 5 labels that lived in the legacy CRM list
--    but aren't in the canonical Nova Angariação set. They stay visible in
--    both worlds as "extras" so existing negocios.tipo_imovel rows continue
--    to surface a matching option. Admins can later deactivate any that
--    aren't desired.
INSERT INTO taxonomy_extras (scope, value, label, is_active, sort_order)
VALUES
  ('property_type', 'Prédio',           'Prédio',           true, 100),
  ('property_type', 'Quinta',           'Quinta',           true, 110),
  ('property_type', 'Comércio',         'Comércio',         true, 120),
  ('property_type', 'Terreno Urbano',   'Terreno Urbano',   true, 130),
  ('property_type', 'Terreno Rústico',  'Terreno Rústico',  true, 140)
ON CONFLICT (scope, value) DO NOTHING;

COMMIT;
