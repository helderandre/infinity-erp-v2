-- =============================================================================
-- Pipeline stage colour tweak — second pass after 20260508_pipeline_stage_colors_tweak.
--
-- "Estudo de Mercado" was sharing #2563eb with CPCV after the previous
-- migration moved CPCV to blue. Move "Estudo de Mercado" to teal (#0d9488)
-- so it stays distinct from both cyan (Pré-Angariação, #0891b2) just before
-- it and violet (Angariação, #7c3aed) just after it, while never clashing
-- with the CPCV blue further down the pipeline.
--
-- Applies to every pipeline where the stage exists (vendedor, arrendador).
-- Idempotent.
-- =============================================================================

BEGIN;

UPDATE leads_pipeline_stages SET color = '#0d9488' WHERE name = 'Estudo de Mercado';

COMMIT;
