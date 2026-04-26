-- =============================================================================
-- Pipeline stage colour tweak (follow-up to 20260426_pipeline_stage_colors).
--
--   • Pesquisa de Imóveis → light blue  (#38bdf8 — sky-400)
--   • CPCV                → blue        (#2563eb — blue-600, the previous
--                                        Pesquisa de Imóveis colour)
--   • Escritura           → dark orange (#c2410c — orange-700)
--   • Perdido             → red         (#dc2626 — red-600)
--
-- Applies to every pipeline (comprador / vendedor / arrendatario /
-- arrendador) where the stage name exists. Idempotent — safe to re-run.
-- =============================================================================

BEGIN;

UPDATE leads_pipeline_stages SET color = '#38bdf8' WHERE name = 'Pesquisa de Imóveis';
UPDATE leads_pipeline_stages SET color = '#2563eb' WHERE name = 'CPCV';
UPDATE leads_pipeline_stages SET color = '#c2410c' WHERE name = 'Escritura';
UPDATE leads_pipeline_stages SET color = '#dc2626' WHERE name = 'Perdido';

COMMIT;
