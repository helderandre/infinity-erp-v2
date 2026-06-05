-- =============================================================================
-- Negócios overhaul:
-- 1. Rename first pipeline stage "Leads" → "Contactado" across all 4 pipelines
-- 2. Add temperatura column (Frio | Morno | Quente) to negocios
-- =============================================================================

BEGIN;

-- 1. Rename "Leads" stage to "Contactado" (idempotent)
UPDATE leads_pipeline_stages
SET name = 'Contactado'
WHERE name = 'Leads'
  AND order_index = 0
  AND pipeline_type IN ('comprador', 'vendedor', 'arrendatario', 'arrendador');

-- 2. Add temperatura column to negocios
ALTER TABLE negocios
  ADD COLUMN IF NOT EXISTS temperatura text;

-- Constraint: only allow Frio, Morno, Quente or NULL
DO $$ BEGIN
  ALTER TABLE negocios
    ADD CONSTRAINT negocios_temperatura_check
    CHECK (temperatura IS NULL OR temperatura IN ('Frio', 'Morno', 'Quente'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

COMMIT;
