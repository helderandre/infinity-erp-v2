-- ─────────────────────────────────────────────────────────────────────────
-- 20260523_property_presentation_overrides.sql
--
-- Adds `dev_properties.presentation_overrides` (JSONB) to allow per-property
-- text and image overrides for the Apresentação 16:9 + Ficha A4 documents
-- without altering the underlying property record. Fields fall back to the
-- property values when not present.
--
-- Shape (validated server-side, never required to be present):
--   {
--     "cover":       { "title"?: string, "eyebrow"?: string, "cover_media_id"?: uuid },
--     "resumo":      { "title"?: string, "subtitle"?: string },
--     "descricao":   { "heading"?: string, "body"?: string },
--     "galeria":     { "heading"?: string, "media_ids"?: uuid[] },
--     "localizacao": { "heading"?: string },
--     "consultor":   { "tagline"?: string },
--     "closing":     { "headline"?: string, "eyebrow"?: string }
--   }
--
-- Aditiva. Revert: `ALTER TABLE dev_properties DROP COLUMN presentation_overrides;`
-- ─────────────────────────────────────────────────────────────────────────

ALTER TABLE public.dev_properties
  ADD COLUMN IF NOT EXISTS presentation_overrides jsonb;

COMMENT ON COLUMN public.dev_properties.presentation_overrides IS
  'Per-property text/image overrides for Apresentação 16:9 + Ficha A4. See migration 20260523 for shape.';
