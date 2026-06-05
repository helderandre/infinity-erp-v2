-- ─────────────────────────────────────────────────────────────────────────
-- 20260507_property_specs_extra_areas
--
-- Adiciona "Área Bruta Privativa" e "Área Total do Lote" a
-- dev_property_specifications. Os campos espelham a Caderneta Predial
-- (Aa = bruta privativa; área do lote/terreno) e complementam os já
-- existentes area_gross / area_util.
--
-- Aditiva, NULL-safe. Sem backfill — os valores ficam null até serem
-- preenchidos via UI ou extracção automática (Caderneta Predial).
--
-- Revert:
--   ALTER TABLE public.dev_property_specifications
--     DROP COLUMN IF EXISTS area_gross_private,
--     DROP COLUMN IF EXISTS area_total_lot;
-- ─────────────────────────────────────────────────────────────────────────

ALTER TABLE public.dev_property_specifications
  ADD COLUMN IF NOT EXISTS area_gross_private numeric,
  ADD COLUMN IF NOT EXISTS area_total_lot     numeric;

COMMENT ON COLUMN public.dev_property_specifications.area_gross_private IS
  'Área Bruta Privativa (Aa) em m². Tipicamente extraída da Caderneta Predial.';
COMMENT ON COLUMN public.dev_property_specifications.area_total_lot IS
  'Área Total do Lote / Terreno em m². Tipicamente extraída da Caderneta Predial.';
