-- Add presentation visibility toggles for AI-generated content.
--
-- Two boolean columns control whether the public /apresentacao/[slug] link
-- includes:
--   * presentation_show_staging       — virtual staging slides (per-image
--                                       AI redecoration of original photos)
--   * presentation_show_ai_plantas    — 3D renders generated from floor plans
--
-- Defaults are TRUE so behaviour for existing properties is unchanged.
-- Purely additive — no constraints, no backfill needed.
--
-- Revert:
--   ALTER TABLE dev_properties DROP COLUMN IF EXISTS presentation_show_staging;
--   ALTER TABLE dev_properties DROP COLUMN IF EXISTS presentation_show_ai_plantas;

ALTER TABLE dev_properties
  ADD COLUMN IF NOT EXISTS presentation_show_staging BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS presentation_show_ai_plantas BOOLEAN NOT NULL DEFAULT TRUE;

COMMENT ON COLUMN dev_properties.presentation_show_staging IS
  'When false, AI virtual-staging slides are hidden in /apresentacao/[slug].';
COMMENT ON COLUMN dev_properties.presentation_show_ai_plantas IS
  'When false, AI 3D-render slides (planta_3d) are hidden in /apresentacao/[slug]. Original plantas still show.';
